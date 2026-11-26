import {
  AccountEvaluation,
  AccountStatus,
  AlertRecord,
  DetectionConfig,
  MessageFlagDetail,
  MessageLog,
  SignalBreakdown,
  SimulatedAccount,
} from '../types/simulation';

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  bulkMinMessages: 4,
  bulkWindowMinutes: 15,
  similarityThreshold: 0.72,
  watchThreshold: 35,
  flagThreshold: 65,
};

export const OWNER_ALERT_TEXT =
  'Unusual activity detected on your account — possible compromise';

export const FOLLOWER_ALERT_TEXT =
  'This message shows signs of being automated/suspicious';

export const URL_SHORTENER_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'rb.gy',
  'is.gd',
  'cutt.ly',
  'short.io',
  'ow.ly',
];

export const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.ru', '.tk', '.gq', '.biz'];

export const SUSPICIOUS_KEYWORDS = [
  'claim',
  'airdrop',
  'verify',
  'bonus',
  'giveaway',
  'reward',
  'urgent',
  'wallet',
  'login',
  'promo',
  'prize',
];

function tokenize(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  return new Set(cleaned);
}

export function computeTextSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function inspectLinkUrl(linkUrl: string | null): {
  suspicious: boolean;
  reason: string | null;
} {
  if (!linkUrl) {
    return { suspicious: false, reason: null };
  }

  let hostname = '';
  let fullLower = linkUrl.toLowerCase();
  try {
    const parsed = new URL(linkUrl);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    hostname = fullLower;
  }

  const matchedShortener = URL_SHORTENER_DOMAINS.find(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
  if (matchedShortener) {
    return {
      suspicious: true,
      reason: `URL shortener (${matchedShortener})`,
    };
  }

  const matchedTld = SUSPICIOUS_TLDS.find((tld) => hostname.endsWith(tld));
  const matchedKeyword = SUSPICIOUS_KEYWORDS.find((kw) => fullLower.includes(kw));

  if (matchedTld && matchedKeyword) {
    return {
      suspicious: true,
      reason: `Unfamiliar domain (${hostname}) with phishing keyword "${matchedKeyword}"`,
    };
  }

  if (matchedTld) {
    return {
      suspicious: true,
      reason: `High-risk TLD domain (${hostname})`,
    };
  }

  if (matchedKeyword && !hostname.endsWith('.example')) {
    return {
      suspicious: true,
      reason: `Suspicious lure link (${hostname})`,
    };
  }

  return { suspicious: false, reason: null };
}

export function isUnusualHour(timestamp: string, startHour: number, endHour: number): boolean {
  const date = new Date(timestamp);
  const hour = date.getHours();
  if (startHour <= endHour) {
    return hour < startHour || hour > endHour;
  }
  // Wrap-around window if applicable
  return hour < startHour && hour > endHour;
}

export function formatHourRange(start: number, end: number): string {
  const pad = (n: number) => `${String(n).padStart(2, '0')}:00`;
  return `${pad(start)}–${pad(end)}`;
}

export function evaluateAccount(
  account: SimulatedAccount,
  accountLogs: MessageLog[],
  config: DetectionConfig = DEFAULT_DETECTION_CONFIG,
  accountLogins: { device_id: string; location: string; timestamp: string }[] = []
): AccountEvaluation {
  const sortedLogs = [...accountLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const messageFlags: Record<string, MessageFlagDetail> = {};
  for (const log of sortedLogs) {
    messageFlags[log.id] = {
      message_id: log.id,
      reasons: [],
      has_suspicious_link: false,
      has_unusual_hour: false,
      has_new_device_or_location: false,
      is_part_of_bulk_burst: false,
    };
  }

  // Signal A: Bulk near-identical messages within short time window (max 35 pts)
  const bulkMessageIds = new Set<string>();
  let maxClusterSize = 0;
  let sampleBulkText = '';
  let clusterSpanMinutes = 0;

  const chronoLogs = [...sortedLogs].reverse();
  const windowMs = config.bulkWindowMinutes * 60 * 1000;

  for (let i = 0; i < chronoLogs.length; i++) {
    const anchor = chronoLogs[i];
    const anchorTime = new Date(anchor.timestamp).getTime();
    const cluster: MessageLog[] = [anchor];

    for (let j = i + 1; j < chronoLogs.length; j++) {
      const candidate = chronoLogs[j];
      const candidateTime = new Date(candidate.timestamp).getTime();
      if (candidateTime - anchorTime <= windowMs) {
        const sim = computeTextSimilarity(anchor.message_text, candidate.message_text);
        if (sim >= config.similarityThreshold) {
          cluster.push(candidate);
        }
      }
    }

    if (cluster.length >= config.bulkMinMessages && cluster.length > maxClusterSize) {
      maxClusterSize = cluster.length;
      sampleBulkText = anchor.message_text;
      const firstTime = new Date(cluster[0].timestamp).getTime();
      const lastTime = new Date(cluster[cluster.length - 1].timestamp).getTime();
      clusterSpanMinutes = Math.max(1, Math.round((lastTime - firstTime) / 60000));
      cluster.forEach((m) => bulkMessageIds.add(m.id));
    }
  }

  for (const id of bulkMessageIds) {
    messageFlags[id].is_part_of_bulk_burst = true;
    messageFlags[id].reasons.push('Bulk near-identical burst');
  }

  const bulkTriggered = maxClusterSize >= config.bulkMinMessages;
  const bulkPoints = bulkTriggered ? 35 : maxClusterSize >= 2 ? 10 : 0;
  const bulkEvidence = bulkTriggered
    ? `${maxClusterSize} near-identical messages sent within ${clusterSpanMinutes} min (threshold: ≥${config.bulkMinMessages} in ${config.bulkWindowMinutes} min). Sample: "${sampleBulkText.slice(0, 62)}${sampleBulkText.length > 62 ? '...' : ''}"`
    : `No bulk repetition burst detected (threshold: ≥${config.bulkMinMessages} similar messages in ${config.bulkWindowMinutes} min).`;

  // Signal B: Suspicious / shortened links (max 25 pts)
  const suspiciousLinkReasons: string[] = [];
  let suspiciousLinkCount = 0;

  for (const log of sortedLogs) {
    const check = inspectLinkUrl(log.link_url);
    if (check.suspicious && check.reason) {
      suspiciousLinkCount += 1;
      messageFlags[log.id].has_suspicious_link = true;
      messageFlags[log.id].reasons.push(check.reason);
      if (!suspiciousLinkReasons.includes(check.reason)) {
        suspiciousLinkReasons.push(check.reason);
      }
    }
  }

  const linksTriggered = suspiciousLinkCount > 0;
  const linkPoints =
    suspiciousLinkCount >= 3 ? 25 : suspiciousLinkCount === 2 ? 20 : suspiciousLinkCount === 1 ? 15 : 0;
  const linkEvidence = linksTriggered
    ? `${suspiciousLinkCount} message${suspiciousLinkCount > 1 ? 's' : ''} contained risky links: ${suspiciousLinkReasons.slice(0, 2).join('; ')}.`
    : 'All shared links use trusted or clean domains.';

  // Signal C: Activity at unusual hours (max 20 pts)
  let unusualHourCount = 0;
  const unusualTimestamps: string[] = [];

  for (const log of sortedLogs) {
    if (isUnusualHour(log.timestamp, account.normal_hours_start, account.normal_hours_end)) {
      unusualHourCount += 1;
      messageFlags[log.id].has_unusual_hour = true;
      messageFlags[log.id].reasons.push('Unusual sending hour');
      const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      if (!unusualTimestamps.includes(timeStr)) {
        unusualTimestamps.push(timeStr);
      }
    }
  }

  let unusualLoginHourCount = 0;
  for (const login of accountLogins) {
    if (isUnusualHour(login.timestamp, account.normal_hours_start, account.normal_hours_end)) {
      unusualLoginHourCount += 1;
      const timeStr = new Date(login.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      if (!unusualTimestamps.includes(timeStr)) {
        unusualTimestamps.push(timeStr);
      }
    }
  }

  const totalUnusualCount = unusualHourCount + unusualLoginHourCount;
  const hoursTriggered = totalUnusualCount > 0;
  const hourPoints = totalUnusualCount >= 3 ? 20 : totalUnusualCount > 0 ? 15 : 0;
  const normalRange = formatHourRange(account.normal_hours_start, account.normal_hours_end);
  const hoursEvidence = hoursTriggered
    ? `${totalUnusualCount} event${totalUnusualCount > 1 ? 's' : ''} occurred outside baseline hours (${normalRange}), including ${unusualTimestamps.slice(0, 3).join(', ')}.`
    : `All activity falls within account baseline hours (${normalRange}).`;

  // Signal D: New device / location anomaly (max 20 pts)
  const newDevices = new Set<string>();
  const newLocations = new Set<string>();

  for (const log of sortedLogs) {
    const devMismatch = log.device_id !== account.trusted_device_id;
    const locMismatch = log.location !== account.home_location;

    if (devMismatch) newDevices.add(log.device_id);
    if (locMismatch) newLocations.add(log.location);

    if (devMismatch || locMismatch) {
      messageFlags[log.id].has_new_device_or_location = true;
      if (devMismatch && locMismatch) {
        messageFlags[log.id].reasons.push(`New device (${log.device_id}) & location (${log.location})`);
      } else if (devMismatch) {
        messageFlags[log.id].reasons.push(`New device (${log.device_id})`);
      } else {
        messageFlags[log.id].reasons.push(`New location (${log.location})`);
      }
    }
  }

  for (const login of accountLogins) {
    if (login.device_id !== account.trusted_device_id) {
      newDevices.add(login.device_id);
    }
    if (login.location !== account.home_location) {
      newLocations.add(login.location);
    }
  }

  const devicePoints =
    (newDevices.size > 0 ? 10 : 0) + (newLocations.size > 0 ? 10 : 0);
  const deviceTriggered = devicePoints > 0;
  const deviceEvidence = deviceTriggered
    ? `Unrecognized activity from ${
        newDevices.size > 0 ? `device ${Array.from(newDevices).join(', ')}` : 'trusted device'
      } in ${
        newLocations.size > 0 ? Array.from(newLocations).join(', ') : account.home_location
      } (baseline: ${account.trusted_device_id} · ${account.home_location}).`
    : `Consistent with trusted device (${account.trusted_device_id}) and home location (${account.home_location}).`;

  const signals: SignalBreakdown[] = [
    {
      id: 'bulk_similarity',
      label: 'Bulk Near-Identical Messages',
      description: `Detects ≥${config.bulkMinMessages} highly similar DMs sent within ${config.bulkWindowMinutes} minutes.`,
      points: bulkPoints,
      max_points: 35,
      triggered: bulkTriggered,
      evidence: bulkEvidence,
    },
    {
      id: 'suspicious_links',
      label: 'Suspicious / Shortened URLs',
      description: 'Flags URL shorteners, unfamiliar TLDs, and phishing lure keywords.',
      points: linkPoints,
      max_points: 25,
      triggered: linksTriggered,
      evidence: linkEvidence,
    },
    {
      id: 'unusual_hours',
      label: 'Unusual Activity Hours',
      description: `Compares message & login timestamps against normal active window (${normalRange}).`,
      points: hourPoints,
      max_points: 20,
      triggered: hoursTriggered,
      evidence: hoursEvidence,
    },
    {
      id: 'new_device_location',
      label: 'New Device / Location',
      description: 'Identifies sudden logins from unrecognized devices or distant locations.',
      points: devicePoints,
      max_points: 20,
      triggered: deviceTriggered,
      evidence: deviceEvidence,
    },
  ];

  const totalScore = Math.min(
    100,
    signals.reduce((sum, s) => sum + s.points, 0)
  );

  let status: AccountStatus = 'Normal';
  if (totalScore >= config.flagThreshold) {
    status = 'Flagged';
  } else if (totalScore >= config.watchThreshold) {
    status = 'Watch';
  }

  const triggeredReasons = signals
    .filter((s) => s.triggered)
    .map((s) => s.label);

  const sortedLogins = [...accountLogins].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const latestMsg = sortedLogs[0];
  const latestLogin = sortedLogins[0];

  const latestEvent =
    latestMsg && latestLogin
      ? new Date(latestLogin.timestamp).getTime() >= new Date(latestMsg.timestamp).getTime()
        ? latestLogin
        : latestMsg
      : latestMsg || latestLogin;

  return {
    account,
    messages: sortedLogs,
    suspicion_score: totalScore,
    status,
    signals,
    message_flags: messageFlags,
    reasons: triggeredReasons,
    latest_device_id: latestEvent ? latestEvent.device_id : account.trusted_device_id,
    latest_location: latestEvent ? latestEvent.location : account.home_location,
    last_activity: latestEvent ? latestEvent.timestamp : new Date().toISOString(),
  };
}

export function evaluateAllAccounts(
  accounts: SimulatedAccount[],
  logs: MessageLog[],
  config: DetectionConfig = DEFAULT_DETECTION_CONFIG,
  logins: { account_id: string; device_id: string; location: string; timestamp: string }[] = []
): AccountEvaluation[] {
  return accounts
    .map((account) => {
      const accountLogs = logs.filter((l) => l.account_id === account.account_id);
      const accountLogins = logins.filter((ln) => ln.account_id === account.account_id);
      return evaluateAccount(account, accountLogs, config, accountLogins);
    })
    .sort((a, b) => b.suspicion_score - a.suspicion_score);
}

export function createAlertFromEvaluation(
  evaluation: AccountEvaluation,
  timestampOverride?: string
): AlertRecord {
  const suspiciousMsg =
    evaluation.messages.find(
      (m) => evaluation.message_flags[m.id]?.reasons.length > 0
    ) || evaluation.messages[0];

  const reasonSummary =
    evaluation.reasons.length > 0
      ? evaluation.reasons.join(' + ')
      : `Suspicion score crossed threshold (${evaluation.suspicion_score}/100)`;

  return {
    id: `alt_${evaluation.account.account_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: timestampOverride || evaluation.last_activity || new Date().toISOString(),
    account_id: evaluation.account.account_id,
    handle: evaluation.account.handle,
    score: evaluation.suspicion_score,
    status: evaluation.status,
    reason: reasonSummary,
    owner_alert: OWNER_ALERT_TEXT,
    follower_alert: FOLLOWER_ALERT_TEXT,
    sample_message_text: suspiciousMsg?.message_text || '',
    sample_link_url: suspiciousMsg?.link_url || null,
  };
}
