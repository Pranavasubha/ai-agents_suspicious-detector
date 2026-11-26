import { AlertRecord, DetectionConfig, MessageLog, SimulatedAccount } from '../types/simulation';
import {
  DEFAULT_DETECTION_CONFIG,
  createAlertFromEvaluation,
  evaluateAllAccounts,
} from './detectionEngine';

export const SYNTHETIC_ACCOUNTS: SimulatedAccount[] = [
  {
    account_id: 'acc_01',
    handle: '@maya.lin.studio',
    display_name: 'Maya Lin (Demo)',
    category: 'Photography & Presets',
    follower_count: 142000,
    normal_hours_start: 8,
    normal_hours_end: 21,
    trusted_device_id: 'dev_iphone15_maya',
    home_location: 'Seattle, US',
  },
  {
    account_id: 'acc_02',
    handle: '@leo.vinyl.club',
    display_name: 'Leo Vance (Demo)',
    category: 'Music & Collecting',
    follower_count: 98400,
    normal_hours_start: 10,
    normal_hours_end: 23,
    trusted_device_id: 'dev_macbook_leo',
    home_location: 'Chicago, US',
  },
  {
    account_id: 'acc_03',
    handle: '@chef.mateo.kitchen',
    display_name: 'Mateo Silva (Demo)',
    category: 'Culinary & Recipes',
    follower_count: 315000,
    normal_hours_start: 7,
    normal_hours_end: 20,
    trusted_device_id: 'dev_pixel8_mateo',
    home_location: 'Austin, US',
  },
  {
    account_id: 'acc_04',
    handle: '@devon.sketchbook',
    display_name: 'Devon Brooks (Demo)',
    category: 'Digital Illustration',
    follower_count: 64500,
    normal_hours_start: 9,
    normal_hours_end: 22,
    trusted_device_id: 'dev_ipadpro_devon',
    home_location: 'Toronto, CA',
  },
  {
    account_id: 'acc_05',
    handle: '@nina.tech.notes',
    display_name: 'Nina Patel (Demo)',
    category: 'Hardware Reviews',
    follower_count: 210800,
    normal_hours_start: 8,
    normal_hours_end: 22,
    trusted_device_id: 'dev_thinkpad_nina',
    home_location: 'Boston, US',
  },
  {
    account_id: 'acc_06',
    handle: '@alex.runs.daily',
    display_name: 'Alex Mercer (Demo)',
    category: 'Marathon Training',
    follower_count: 87300,
    normal_hours_start: 6,
    normal_hours_end: 20,
    trusted_device_id: 'dev_iphone14_alex',
    home_location: 'Denver, US',
  },
  {
    account_id: 'acc_07',
    handle: '@sara.plant.home',
    display_name: 'Sara Lindqvist (Demo)',
    category: 'Botanical Interiors',
    follower_count: 119000,
    normal_hours_start: 8,
    normal_hours_end: 21,
    trusted_device_id: 'dev_galaxy24_sara',
    home_location: 'Portland, US',
  },
  {
    account_id: 'acc_08',
    handle: '@priya.code.lab',
    display_name: 'Priya Nair (Demo)',
    category: 'Creative Coding',
    follower_count: 74200,
    normal_hours_start: 9,
    normal_hours_end: 23,
    trusted_device_id: 'dev_mbp_priya',
    home_location: 'San Jose, US',
  },
];

const NORMAL_MESSAGE_TEMPLATES: Record<string, Array<{ text: string; link: string | null }>> = {
  acc_01: [
    { text: 'Thanks for joining the lightroom workshop! Here are the sample RAW files we discussed.', link: 'https://mayalinstudio.example/raw-samples' },
    { text: 'Appreciate the kind words on the misty coastline series! Shot on a 35mm prime.', link: null },
    { text: 'Yes, the weekend print drop opens Friday morning for newsletter subscribers.', link: 'https://mayalinstudio.example/prints' },
  ],
  acc_02: [
    { text: 'Good ear! That jazz pressing is the 1974 Japanese reissue with the obi strip intact.', link: null },
    { text: 'Uploaded tonight’s ambient crate-digging tracklist to my archive page.', link: 'https://leovinylclub.example/sessions/42' },
  ],
  acc_03: [
    { text: 'For the salsa macha, toast the sesame seeds on low heat for just 90 seconds so they stay nutty.', link: null },
    { text: 'Full printable recipe card for the charred sourdough flatbread is live now.', link: 'https://chefmateo.example/recipes/flatbread' },
    { text: 'Totally fine to swap ancho chilies for guajillo if you want a brighter finish!', link: null },
  ],
  acc_04: [
    { text: 'I use a textured 6B pencil brush with 15% opacity jitter for the cross-hatching.', link: null },
    { text: 'Shared the zine layout template here if you want to test print margins.', link: 'https://devonsketch.example/zine-guide' },
  ],
  acc_05: [
    { text: 'Battery benchmarks on the portable SSD dock were surprisingly steady under sustained 4K transfer.', link: 'https://ninatechnotes.example/ssd-bench' },
    { text: 'I’ll test Linux kernel compatibility on that mini-PC in next week’s follow-up.', link: null },
  ],
  acc_06: [
    { text: 'Keep your easy recovery miles genuinely conversational—aim for Zone 2 heart rate.', link: null },
    { text: 'Posted the 12-week half-marathon taper schedule on my training log.', link: 'https://alexruns.example/taper-plan' },
  ],
  acc_07: [
    { text: 'Bright indirect light near an east-facing window works best for variegated monstera.', link: null },
    { text: 'Here is the chunky aroid potting mix ratio I use for indoor repotting.', link: 'https://saraplanthome.example/soil-mix' },
  ],
  acc_08: [
    { text: 'Try clamping the shader time uniform before passing it into the noise octaves.', link: null },
    { text: 'Pushed the generative grid starter repo so you can fork and remix it.', link: 'https://priyacodelab.example/grid-starter' },
  ],
};

const SUSPICIOUS_SCENARIOS = [
  {
    messages: [
      'Hey! You were picked for my private creator fan giveaway — claim your $750 gift reward before it expires tonight:',
      'Hey! You were selected for my private creator fan giveaway — claim your $750 gift reward before it expires tonight:',
      'Hi! You were picked for my private creator fan giveaway — claim your $750 gift reward before it expires:',
      'Hey! You were picked for my private creator fan giveaway — claim your $750 gift reward before it expires tonight:',
      'Hey! You were selected for my private creator fan giveaway — claim your $750 gift reward before it expires tonight:',
      'Hey! You were picked for my private creator fan giveaway — claim your $750 gift reward before it expires tonight:',
    ],
    links: [
      'https://bit.ly/3xClaimBonus99',
      'https://creator-reward-claim.xyz/verify',
    ],
    device: 'dev_headless_bot_408',
    location: 'Bucharest, RO',
  },
  {
    messages: [
      'Urgent! My collab wallet airdrop closes in 20 mins. Verify your follower handle here to unlock your token bonus:',
      'Urgent! My collab wallet airdrop closes in 20 mins. Verify your follower handle now to unlock your token bonus:',
      'Urgent! My collab wallet airdrop closes in 20 mins. Verify your follower handle here to unlock your token bonus:',
      'Urgent! My collab wallet airdrop closes in 20 mins. Verify your follower handle here to unlock your token bonus:',
      'Urgent! My collab wallet airdrop closes in 20 mins. Verify your follower handle now to unlock your token bonus:',
    ],
    links: [
      'https://tinyurl.com/verify-airdrop-now',
      'https://collab-airdrop-promo.top/login',
    ],
    device: 'dev_android_emu_921',
    location: 'Lagos, NG',
  },
  {
    messages: [
      'Quick favor! I need your vote for the Creator Spotlight finalists — login with your handle here to claim a thank-you prize:',
      'Quick favor! I need your vote for the Creator Spotlight finalists — login with your handle here to claim a thank-you prize:',
      'Quick favor! Please vote for the Creator Spotlight finalists — login with your handle here to claim a thank-you prize:',
      'Quick favor! I need your vote for the Creator Spotlight finalists — login with your handle here to claim a thank-you prize:',
      'Quick favor! I need your vote for the Creator Spotlight finalists — login with your handle here to claim a thank-you prize:',
    ],
    links: [
      'https://rb.gy/vote-spotlight-login',
      'https://spotlight-verify-prize.click/auth',
    ],
    device: 'dev_proxy_win11_774',
    location: 'Frankfurt, DE',
  },
];

function makeDateAtLocalHour(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, Math.floor(Math.random() * 50), 0);
  return d.toISOString();
}

function randomFollowerId(seed?: number): string {
  const n = seed ?? Math.floor(10000 + Math.random() * 89999);
  return `fol_${n}`;
}

export function generateInitialSyntheticData(
  config: DetectionConfig = DEFAULT_DETECTION_CONFIG
): {
  accounts: SimulatedAccount[];
  logs: MessageLog[];
  alerts: AlertRecord[];
} {
  const logs: MessageLog[] = [];
  let seq = 1;

  // Populate clean baseline DMs for every account
  for (const acc of SYNTHETIC_ACCOUNTS) {
    const templates = NORMAL_MESSAGE_TEMPLATES[acc.account_id] || [];
    templates.forEach((tpl, idx) => {
      const hour = Math.min(
        acc.normal_hours_end - 1,
        acc.normal_hours_start + 2 + idx * 3
      );
      logs.push({
        id: `msg_init_${seq++}`,
        account_id: acc.account_id,
        follower_id: randomFollowerId(2100 + seq * 17),
        message_text: tpl.text,
        link_url: tpl.link,
        timestamp: makeDateAtLocalHour(idx === 0 ? 0 : 1, hour, 15 + idx * 12),
        device_id: acc.trusted_device_id,
        location: acc.home_location,
        is_simulated_attack: false,
      });
    });
  }

  // Pre-seed @leo.vinyl.club (acc_02) as Flagged so the dashboard shows an active compromised account immediately
  const leoBurstMessages = [
    'Hey! Exclusive Vinyl Club fan airdrop is live for 30 mins — verify your handle to claim your $500 reward:',
    'Hey! Exclusive Vinyl Club fan airdrop is live for 30 mins — verify your handle to claim your $500 reward:',
    'Hi! Exclusive Vinyl Club fan airdrop is live for 30 mins — verify your handle to claim your $500 reward:',
    'Hey! Exclusive Vinyl Club fan airdrop is live for 30 mins — verify your handle to claim your $500 reward:',
    'Hey! Exclusive Vinyl Club fan airdrop is live for 30 mins — verify your handle to claim your $500 reward:',
  ];

  leoBurstMessages.forEach((text, i) => {
    logs.push({
      id: `msg_seed_leo_${i + 1}`,
      account_id: 'acc_02',
      follower_id: `fol_${88410 + i * 29}`,
      message_text: text,
      link_url: i % 2 === 0 ? 'https://bit.ly/vinyl-claim-500' : 'https://vinyl-airdrop-claim.xyz/verify',
      timestamp: makeDateAtLocalHour(0, 3, 11 + i),
      device_id: 'dev_headless_bot_408',
      location: 'Bucharest, RO',
      is_simulated_attack: true,
    });
  });

  // Pre-seed @devon.sketchbook (acc_04) as Watch (Yellow) so all 3 states are immediately visible
  logs.push({
    id: 'msg_seed_devon_1',
    account_id: 'acc_04',
    follower_id: 'fol_55219',
    message_text: 'Checking out this limited brush pack promo link—grab it before tonight:',
    link_url: 'https://tinyurl.com/brush-promo-pack',
    timestamp: makeDateAtLocalHour(0, 2, 42),
    device_id: 'dev_web_unknown_31',
    location: 'Toronto, CA',
    is_simulated_attack: true,
  });

  const evaluations = evaluateAllAccounts(SYNTHETIC_ACCOUNTS, logs, config);
  const alerts: AlertRecord[] = evaluations
    .filter((ev) => ev.suspicion_score >= config.flagThreshold)
    .map((ev) => createAlertFromEvaluation(ev));

  return {
    accounts: SYNTHETIC_ACCOUNTS,
    logs,
    alerts,
  };
}

export function injectSimulatedHackBurst(
  targetAccount: SimulatedAccount,
  existingLogs: MessageLog[]
): MessageLog[] {
  const scenario =
    SUSPICIOUS_SCENARIOS[Math.floor(Math.random() * SUSPICIOUS_SCENARIOS.length)];

  // Choose an unusual hour outside the account's normal active window (e.g. 02:00 - 04:00 AM)
  let oddHour = 3;
  if (targetAccount.normal_hours_start <= 3 && targetAccount.normal_hours_end >= 3) {
    oddHour = 4;
  }

  const baseMinute = 10 + Math.floor(Math.random() * 25);
  const now = new Date();
  // Create timestamps in the most recent off-hours block (e.g. 03:xx AM today)
  const burstBase = new Date(now);
  burstBase.setHours(oddHour, baseMinute, 0, 0);
  if (burstBase.getTime() > now.getTime()) {
    burstBase.setDate(burstBase.getDate() - 1);
  }

  const newEntries: MessageLog[] = scenario.messages.map((text, index) => {
    const msgTime = new Date(burstBase.getTime() + index * 38 * 1000); // 38 seconds apart
    const link = scenario.links[index % scenario.links.length];
    return {
      id: `msg_hack_${targetAccount.account_id}_${Date.now()}_${index}`,
      account_id: targetAccount.account_id,
      follower_id: randomFollowerId(),
      message_text: text,
      link_url: link,
      timestamp: msgTime.toISOString(),
      device_id: scenario.device,
      location: scenario.location,
      is_simulated_attack: true,
    };
  });

  return [...newEntries, ...existingLogs];
}

export function injectNormalMessage(
  targetAccount: SimulatedAccount,
  existingLogs: MessageLog[]
): MessageLog[] {
  const templates = NORMAL_MESSAGE_TEMPLATES[targetAccount.account_id] || [
    { text: 'Thanks so much for the feedback on today’s post!', link: null },
  ];
  const chosen = templates[Math.floor(Math.random() * templates.length)];

  const midHour = Math.floor(
    (targetAccount.normal_hours_start + targetAccount.normal_hours_end) / 2
  );
  const timestamp = makeDateAtLocalHour(
    0,
    midHour,
    Math.floor(Math.random() * 55)
  );

  const entry: MessageLog = {
    id: `msg_norm_${targetAccount.account_id}_${Date.now()}`,
    account_id: targetAccount.account_id,
    follower_id: randomFollowerId(),
    message_text: chosen.text,
    link_url: chosen.link,
    timestamp,
    device_id: targetAccount.trusted_device_id,
    location: targetAccount.home_location,
    is_simulated_attack: false,
  };

  return [entry, ...existingLogs];
}
