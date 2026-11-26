import 'dotenv/config';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import { isIP } from 'node:net';
import path from 'node:path';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DEFAULT_DETECTION_CONFIG,
  createAlertFromEvaluation,
  evaluateAccount,
  evaluateAllAccounts,
  isUnusualHour,
} from './src/engine/detectionEngine.ts';
import {
  generateInitialSyntheticData,
  injectNormalMessage,
  injectSimulatedHackBurst,
} from './src/engine/syntheticData.ts';
import type {
  AiAccountAnalysis,
  AlertRecord,
  DetectionConfig,
  LoginEvent,
  MessageLog,
  OutboundWebhook,
  SimulatedAccount,
} from './src/types/simulation.ts';

interface AdminCredential {
  salt: string;
  hash: string;
}

interface PersistedStore {
  adminCredential: AdminCredential | null;
  ingestApiKey: string;
  accounts: SimulatedAccount[];
  logs: MessageLog[];
  loginEvents: LoginEvent[];
  alerts: AlertRecord[];
  config: DetectionConfig;
  outboundWebhooks: OutboundWebhook[];
  aiAnalyses: Record<string, AiAccountAnalysis>;
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

function createDefaultStore(): PersistedStore {
  const seeded = generateInitialSyntheticData(DEFAULT_DETECTION_CONFIG);
  return {
    adminCredential: null,
    ingestApiKey: `sadk_${crypto.randomBytes(20).toString('hex')}`,
    accounts: seeded.accounts,
    logs: seeded.logs,
    loginEvents: [],
    alerts: seeded.alerts,
    config: DEFAULT_DETECTION_CONFIG,
    outboundWebhooks: [],
    aiAnalyses: {},
  };
}

function loadStore(): PersistedStore {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial = createDefaultStore();
    saveStore(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    const defaults = createDefaultStore();
    return {
      adminCredential: parsed.adminCredential ?? null,
      ingestApiKey: parsed.ingestApiKey || defaults.ingestApiKey,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : defaults.accounts,
      logs: Array.isArray(parsed.logs) ? parsed.logs : defaults.logs,
      loginEvents: Array.isArray(parsed.loginEvents) ? parsed.loginEvents : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : defaults.alerts,
      config: parsed.config ?? DEFAULT_DETECTION_CONFIG,
      outboundWebhooks: Array.isArray(parsed.outboundWebhooks)
        ? parsed.outboundWebhooks
        : [],
      aiAnalyses: parsed.aiAnalyses ?? {},
    };
  } catch {
    const fallback = createDefaultStore();
    saveStore(fallback);
    return fallback;
  }
}

function saveStore(nextStore: PersistedStore): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(nextStore, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

let store: PersistedStore = loadStore();

function getEnvPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function hashPasscode(passcode: string, salt: string): string {
  return crypto.scryptSync(passcode, salt, 64).toString('hex');
}

function verifyAdminPasscode(candidate: string): boolean {
  const envPass = getEnvPasscode();
  if (envPass.length > 0) {
    return timingSafeStringEqual(candidate, envPass);
  }
  if (!store.adminCredential) return false;
  const candidateHash = hashPasscode(candidate, store.adminCredential.salt);
  return crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(store.adminCredential.hash, 'hex')
  );
}

function issueSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000,
      jti: crypto.randomBytes(8).toString('hex'),
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  if (!timingSafeStringEqual(sigB64, expectedSig)) return false;
  try {
    const decoded = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as { exp?: number; role?: string };
    return (
      decoded.role === 'admin' &&
      typeof decoded.exp === 'number' &&
      decoded.exp > Date.now()
    );
  } catch {
    return false;
  }
}

function extractBearerToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const token = extractBearerToken(req);
  if (!token || !verifySessionToken(token)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

function requireIngestOrAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const bearer = extractBearerToken(req);
  if (bearer && verifySessionToken(bearer)) {
    next();
    return;
  }
  const ingestHeader = req.headers['x-ingest-key'];
  const key = typeof ingestHeader === 'string' ? ingestHeader.trim() : '';
  if (key && timingSafeStringEqual(key, store.ingestApiKey)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Invalid or missing x-ingest-key or Bearer token' });
}

function isPrivateOrBlockedIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) {
    return true;
  }
  const v4 = normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
  if (isIP(v4) !== 4) {
    // Reject unknown/non-v4 non-public IPv6 literals by default for safety
    return isIP(normalized) === 0;
  }
  const parts = v4.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

async function validateExternalWebhookUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid webhook URL format.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use https:// for secure delivery.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    throw new Error('Local or internal hostnames are not permitted.');
  }

  if (isIP(hostname) !== 0 && isPrivateOrBlockedIp(hostname)) {
    throw new Error('Private or loopback IP addresses are not permitted.');
  }

  const records = await dns.lookup(hostname, { all: true });
  if (!records || records.length === 0) {
    throw new Error('Unable to resolve webhook hostname.');
  }
  for (const rec of records) {
    if (isPrivateOrBlockedIp(rec.address)) {
      throw new Error('Webhook hostname resolves to a private or reserved network address.');
    }
  }

  return parsed;
}

async function dispatchOutboundWebhooks(alert: AlertRecord): Promise<void> {
  const activeHooks = store.outboundWebhooks.filter((h) => h.enabled);
  if (activeHooks.length === 0) return;

  const summaryText = `[${alert.status.toUpperCase()} · Score ${alert.score}/100] ${alert.handle}: ${alert.owner_alert} (${alert.reason})`;

  for (const hook of activeHooks) {
    try {
      const safeUrl = await validateExternalWebhookUrl(hook.url);
      const response = await fetch(safeUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Suspicious-Activity-Detector/1.0',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          text: summaryText, // Slack compatible
          content: summaryText, // Discord compatible
          event: 'suspicious_activity_alert',
          alert,
        }),
      });
      hook.last_status = response.ok
        ? `Delivered (${response.status})`
        : `HTTP ${response.status}`;
      hook.last_dispatched_at = new Date().toISOString();
    } catch (err) {
      hook.last_status =
        err instanceof Error ? `Failed: ${err.message}` : 'Delivery failed';
      hook.last_dispatched_at = new Date().toISOString();
    }
  }
  saveStore(store);
}

function getSafeStatePayload() {
  return {
    accounts: store.accounts,
    logs: store.logs,
    loginEvents: store.loginEvents,
    alerts: store.alerts,
    config: store.config,
    outboundWebhooks: store.outboundWebhooks,
    aiAnalyses: store.aiAnalyses,
    ingestApiKey: store.ingestApiKey,
  };
}

function resolveAccountByIdOrHandle(
  accountId?: string,
  handle?: string
): SimulatedAccount | undefined {
  if (accountId) {
    const byId = store.accounts.find((a) => a.account_id === accountId);
    if (byId) return byId;
  }
  if (handle) {
    const normalized = handle.trim().toLowerCase();
    return store.accounts.find(
      (a) =>
        a.handle.toLowerCase() === normalized ||
        a.handle.toLowerCase() === `@${normalized}`
    );
  }
  return undefined;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Auth routes
  app.get('/api/auth/status', (_req, res) => {
    const envPass = getEnvPasscode();
    res.json({
      configured: envPass.length > 0 || store.adminCredential !== null,
      envPasscodeActive: envPass.length > 0,
    });
  });

  app.post('/api/auth/claim', (req, res) => {
    const envPass = getEnvPasscode();
    if (envPass.length > 0 || store.adminCredential !== null) {
      res.status(409).json({ error: 'Admin passcode is already configured.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 6) {
      res.status(400).json({ error: 'Passcode must be at least 6 characters.' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPasscode(passcode, salt);
    store.adminCredential = { salt, hash };
    saveStore(store);
    res.json({ token: issueSessionToken() });
  });

  app.post('/api/auth/login', (req, res) => {
    const envPass = getEnvPasscode();
    if (envPass.length === 0 && !store.adminCredential) {
      res.status(400).json({ error: 'Workspace passcode has not been set up yet.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!passcode || !verifyAdminPasscode(passcode)) {
      res.status(401).json({ error: 'Invalid workspace passcode.' });
      return;
    }
    res.json({ token: issueSessionToken() });
  });

  // Sanitized Public Workspace Overview (omits API keys and webhook URLs)
  app.get('/api/v1/workspace', (_req, res) => {
    res.json({
      accounts: store.accounts,
      logs: store.logs,
      loginEvents: store.loginEvents,
      alerts: store.alerts,
      config: store.config,
      aiAnalyses: store.aiAnalyses,
    });
  });

  // Protected Full Dashboard State (includes ingestion API key & webhook URLs)
  app.get('/api/v1/state', requireAdmin, (_req, res) => {
    res.json(getSafeStatePayload());
  });

  // Add Monitored Account
  app.post('/api/v1/accounts', requireAdmin, (req, res) => {
    const rawHandle = typeof req.body?.handle === 'string' ? req.body.handle.trim() : '';
    const displayName =
      typeof req.body?.display_name === 'string' ? req.body.display_name.trim() : '';
    const platform =
      typeof req.body?.platform === 'string' ? req.body.platform.trim() : 'Instagram';
    const category =
      typeof req.body?.category === 'string' ? req.body.category.trim() : 'Creator Account';
    const trustedDevice =
      typeof req.body?.trusted_device_id === 'string'
        ? req.body.trusted_device_id.trim()
        : '';
    const homeLocation =
      typeof req.body?.home_location === 'string' ? req.body.home_location.trim() : '';
    const followerCount = Number(req.body?.follower_count) || 10000;
    const startHour = Math.min(23, Math.max(0, Number(req.body?.normal_hours_start ?? 8)));
    const endHour = Math.min(23, Math.max(0, Number(req.body?.normal_hours_end ?? 22)));

    if (!rawHandle || !trustedDevice || !homeLocation) {
      res.status(400).json({
        error: 'handle, trusted_device_id, and home_location are required.',
      });
      return;
    }

    const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
    if (
      store.accounts.some(
        (a) => a.handle.toLowerCase() === handle.toLowerCase()
      )
    ) {
      res.status(409).json({ error: `Account ${handle} is already monitored.` });
      return;
    }

    const newAccount: SimulatedAccount = {
      account_id: `acc_${crypto.randomBytes(4).toString('hex')}`,
      handle,
      display_name: displayName || handle.slice(1),
      platform: platform || 'Instagram',
      category: category || 'Creator Account',
      follower_count: followerCount,
      normal_hours_start: startHour,
      normal_hours_end: endHour,
      trusted_device_id: trustedDevice,
      home_location: homeLocation,
    };

    store.accounts = [newAccount, ...store.accounts];
    saveStore(store);
    res.status(201).json({ account: newAccount, state: getSafeStatePayload() });
  });

  app.delete('/api/v1/accounts/:accountId', requireAdmin, (req, res) => {
    const accountId = String(req.params.accountId);
    const exists = store.accounts.some((a) => a.account_id === accountId);
    if (!exists) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    store.accounts = store.accounts.filter((a) => a.account_id !== accountId);
    store.logs = store.logs.filter((l) => l.account_id !== accountId);
    store.loginEvents = store.loginEvents.filter((ln) => ln.account_id !== accountId);
    store.alerts = store.alerts.filter((al) => al.account_id !== accountId);
    delete store.aiAnalyses[accountId];
    saveStore(store);
    res.json({ state: getSafeStatePayload() });
  });

  // Update Detection Rules Config
  app.put('/api/v1/config', requireAdmin, (req, res) => {
    const next: DetectionConfig = {
      bulkMinMessages: Math.min(20, Math.max(2, Number(req.body?.bulkMinMessages) || 4)),
      bulkWindowMinutes: Math.min(120, Math.max(1, Number(req.body?.bulkWindowMinutes) || 15)),
      similarityThreshold: Math.min(
        0.95,
        Math.max(0.4, Number(req.body?.similarityThreshold) || 0.72)
      ),
      watchThreshold: Math.min(80, Math.max(10, Number(req.body?.watchThreshold) || 35)),
      flagThreshold: Math.min(95, Math.max(25, Number(req.body?.flagThreshold) || 65)),
    };
    if (next.watchThreshold >= next.flagThreshold) {
      next.watchThreshold = Math.max(10, next.flagThreshold - 10);
    }
    store.config = next;
    saveStore(store);
    res.json({ state: getSafeStatePayload() });
  });

  // Real-World Webhook Ingestion: Outbound DM / Message Event
  app.post('/api/v1/ingest/message', requireIngestOrAdmin, async (req, res) => {
    const {
      account_id,
      handle,
      follower_id,
      message_text,
      link_url,
      timestamp,
      device_id,
      location,
    } = req.body ?? {};

    if (typeof message_text !== 'string' || !message_text.trim()) {
      res.status(400).json({ error: 'message_text is required.' });
      return;
    }

    let target = resolveAccountByIdOrHandle(
      typeof account_id === 'string' ? account_id : undefined,
      typeof handle === 'string' ? handle : undefined
    );

    if (!target && typeof handle === 'string' && handle.trim()) {
      const normalizedHandle = handle.trim().startsWith('@')
        ? handle.trim()
        : `@${handle.trim()}`;
      target = {
        account_id:
          typeof account_id === 'string' && account_id.trim()
            ? account_id.trim()
            : `acc_${crypto.randomBytes(4).toString('hex')}`,
        handle: normalizedHandle,
        display_name: normalizedHandle.slice(1),
        category: 'Ingested Account',
        follower_count: 10000,
        normal_hours_start: 8,
        normal_hours_end: 22,
        trusted_device_id:
          typeof device_id === 'string' && device_id.trim()
            ? device_id.trim()
            : 'dev_baseline_unset',
        home_location:
          typeof location === 'string' && location.trim()
            ? location.trim()
            : 'Unknown',
      };
      store.accounts = [target, ...store.accounts];
    }

    if (!target) {
      res.status(404).json({
        error: 'Target account not found. Provide a valid account_id or handle.',
      });
      return;
    }

    const parsedTs =
      typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp))
        ? new Date(timestamp).toISOString()
        : new Date().toISOString();

    const newLog: MessageLog = {
      id: `msg_live_${crypto.randomBytes(5).toString('hex')}`,
      account_id: target.account_id,
      follower_id:
        typeof follower_id === 'string' && follower_id.trim()
          ? follower_id.trim()
          : `fol_${crypto.randomBytes(3).toString('hex')}`,
      message_text: message_text.trim().slice(0, 2000),
      link_url:
        typeof link_url === 'string' && link_url.trim() ? link_url.trim() : null,
      timestamp: parsedTs,
      device_id:
        typeof device_id === 'string' && device_id.trim()
          ? device_id.trim()
          : target.trusted_device_id,
      location:
        typeof location === 'string' && location.trim()
          ? location.trim()
          : target.home_location,
      is_simulated_attack: false,
    };

    store.logs = [newLog, ...store.logs];

    const accountLogs = store.logs.filter((l) => l.account_id === target!.account_id);
    const accountLogins = store.loginEvents.filter(
      (ln) => ln.account_id === target!.account_id
    );
    const evaluation = evaluateAccount(target, accountLogs, store.config, accountLogins);

    let alertRecord: AlertRecord | null = null;
    if (evaluation.suspicion_score >= store.config.flagThreshold) {
      alertRecord = createAlertFromEvaluation(evaluation, new Date().toISOString());
      store.alerts = [alertRecord, ...store.alerts];
      saveStore(store);
      await dispatchOutboundWebhooks(alertRecord);
    } else {
      saveStore(store);
    }

    res.status(201).json({
      ingested: newLog,
      evaluation,
      alertTriggered: alertRecord,
      state: getSafeStatePayload(),
    });
  });

  // Real-World Webhook Ingestion: Login Event
  app.post('/api/v1/ingest/login', requireIngestOrAdmin, async (req, res) => {
    const { account_id, handle, device_id, location, timestamp } = req.body ?? {};
    const target = resolveAccountByIdOrHandle(
      typeof account_id === 'string' ? account_id : undefined,
      typeof handle === 'string' ? handle : undefined
    );

    if (!target) {
      res.status(404).json({
        error: 'Target account not found. Register the account first or pass handle.',
      });
      return;
    }

    const dev =
      typeof device_id === 'string' && device_id.trim()
        ? device_id.trim()
        : 'dev_unknown';
    const loc =
      typeof location === 'string' && location.trim() ? location.trim() : 'Unknown';
    const loginIso =
      typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp))
        ? new Date(timestamp).toISOString()
        : new Date().toISOString();

    const findings: string[] = [];
    if (dev !== target.trusted_device_id) findings.push(`Unrecognized device (${dev})`);
    if (loc !== target.home_location) findings.push(`Unfamiliar location (${loc})`);
    if (isUnusualHour(loginIso, target.normal_hours_start, target.normal_hours_end)) {
      findings.push('Odd login hour');
    }

    const preliminaryLogins = [
      { account_id: target.account_id, device_id: dev, location: loc, timestamp: loginIso },
      ...store.loginEvents.filter((ln) => ln.account_id === target.account_id),
    ];
    const accountLogs = store.logs.filter((l) => l.account_id === target.account_id);
    const evaluation = evaluateAccount(target, accountLogs, store.config, preliminaryLogins);

    const loginEvent: LoginEvent = {
      id: `lgn_live_${crypto.randomBytes(5).toString('hex')}`,
      account_id: target.account_id,
      handle: target.handle,
      login_mode: 'existing_account_login',
      device_id: dev,
      location: loc,
      timestamp: loginIso,
      suspicious: findings.length > 0 || evaluation.status !== 'Normal',
      findings,
      score_after_login: evaluation.suspicion_score,
      status_after_login: evaluation.status,
    };

    store.loginEvents = [loginEvent, ...store.loginEvents];

    let alertRecord: AlertRecord | null = null;
    if (evaluation.suspicion_score >= store.config.flagThreshold) {
      alertRecord = createAlertFromEvaluation(evaluation, new Date().toISOString());
      store.alerts = [alertRecord, ...store.alerts];
      saveStore(store);
      await dispatchOutboundWebhooks(alertRecord);
    } else {
      saveStore(store);
    }

    res.status(201).json({
      loginEvent,
      evaluation,
      alertTriggered: alertRecord,
      state: getSafeStatePayload(),
    });
  });

  // In-App New ID Login & Suspicious Finding Check (persisted)
  app.post('/api/v1/login-check', requireAdmin, async (req, res) => {
    const {
      mode,
      existingAccountId,
      newHandle,
      newDisplayName,
      newCategory,
      trustedDeviceId,
      homeLocation,
      loginDeviceId,
      loginLocation,
      loginHour,
      simulateAgentBurst,
    } = req.body ?? {};

    let target: SimulatedAccount | undefined;
    if (mode === 'new_account_id') {
      const cleanHandle =
        typeof newHandle === 'string' && newHandle.trim()
          ? newHandle.trim().startsWith('@')
            ? newHandle.trim()
            : `@${newHandle.trim()}`
          : `@new.demo.${crypto.randomBytes(2).toString('hex')}`;

      target = {
        account_id: `acc_${crypto.randomBytes(4).toString('hex')}`,
        handle: cleanHandle,
        display_name:
          typeof newDisplayName === 'string' && newDisplayName.trim()
            ? newDisplayName.trim()
            : cleanHandle.slice(1),
        category:
          typeof newCategory === 'string' && newCategory.trim()
            ? newCategory.trim()
            : 'Creator Account',
        follower_count: 42500,
        normal_hours_start: 8,
        normal_hours_end: 21,
        trusted_device_id:
          typeof trustedDeviceId === 'string' && trustedDeviceId.trim()
            ? trustedDeviceId.trim()
            : 'dev_trusted_01',
        home_location:
          typeof homeLocation === 'string' && homeLocation.trim()
            ? homeLocation.trim()
            : 'Austin, US',
      };
      store.accounts = [target, ...store.accounts];
    } else {
      target = store.accounts.find((a) => a.account_id === existingAccountId);
      if (!target) {
        res.status(404).json({ error: 'Selected account not found.' });
        return;
      }
    }

    const hourNum = Math.min(23, Math.max(0, Number(loginHour ?? 12)));
    const loginDate = new Date();
    loginDate.setHours(hourNum, 18, 0, 0);
    const loginIso = loginDate.toISOString();

    const dev =
      typeof loginDeviceId === 'string' && loginDeviceId.trim()
        ? loginDeviceId.trim()
        : target.trusted_device_id;
    const loc =
      typeof loginLocation === 'string' && loginLocation.trim()
        ? loginLocation.trim()
        : target.home_location;

    const findings: string[] = [];
    if (dev !== target.trusted_device_id) findings.push(`Unrecognized device (${dev})`);
    if (loc !== target.home_location) findings.push(`Unfamiliar location (${loc})`);
    if (isUnusualHour(loginIso, target.normal_hours_start, target.normal_hours_end)) {
      findings.push(`Odd login hour (${String(hourNum).padStart(2, '0')}:18)`);
    }

    if (simulateAgentBurst) {
      const burstTemplates = [
        'Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:',
        'Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:',
        'Hi! Exclusive creator fan reward is open now — claim your bonus link before it closes:',
        'Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:',
        'Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:',
      ];
      const injectedBurst: MessageLog[] = burstTemplates.map((text, idx) => {
        const msgTime = new Date(loginDate.getTime() + (idx + 1) * 35 * 1000);
        return {
          id: `msg_lgn_${crypto.randomBytes(4).toString('hex')}_${idx}`,
          account_id: target!.account_id,
          follower_id: `fol_${41000 + idx * 73}`,
          message_text: text,
          link_url:
            idx % 2 === 0
              ? 'https://bit.ly/creator-bonus-claim'
              : 'https://verify-fan-reward.xyz/login',
          timestamp: msgTime.toISOString(),
          device_id: dev,
          location: loc,
          is_simulated_attack: true,
        };
      });
      store.logs = [...injectedBurst, ...store.logs];
      findings.push('Automated AI-agent bulk DM burst + suspicious URLs');
    } else if (mode === 'new_account_id') {
      store.logs = [
        {
          id: `msg_newid_${crypto.randomBytes(4).toString('hex')}`,
          account_id: target.account_id,
          follower_id: 'fol_10492',
          message_text: 'Thanks for following! Excited to share new updates here soon.',
          link_url: null,
          timestamp: loginIso,
          device_id: dev,
          location: loc,
          is_simulated_attack: findings.length > 0,
        },
        ...store.logs,
      ];
    }

    const preliminaryLogins = [
      { account_id: target.account_id, device_id: dev, location: loc, timestamp: loginIso },
      ...store.loginEvents.filter((ln) => ln.account_id === target!.account_id),
    ];
    const evaluation = evaluateAccount(
      target,
      store.logs.filter((l) => l.account_id === target!.account_id),
      store.config,
      preliminaryLogins
    );

    const loginEvent: LoginEvent = {
      id: `lgn_${crypto.randomBytes(4).toString('hex')}`,
      account_id: target.account_id,
      handle: target.handle,
      login_mode: mode === 'new_account_id' ? 'new_account_id' : 'existing_account_login',
      device_id: dev,
      location: loc,
      timestamp: loginIso,
      suspicious: findings.length > 0 || evaluation.status !== 'Normal',
      findings,
      score_after_login: evaluation.suspicion_score,
      status_after_login: evaluation.status,
    };

    store.loginEvents = [loginEvent, ...store.loginEvents];

    let alertRecord: AlertRecord | null = null;
    if (evaluation.suspicion_score >= store.config.flagThreshold) {
      alertRecord = createAlertFromEvaluation(evaluation, new Date().toISOString());
      store.alerts = [alertRecord, ...store.alerts];
      saveStore(store);
      await dispatchOutboundWebhooks(alertRecord);
    } else {
      saveStore(store);
    }

    res.status(201).json({
      account: target,
      loginEvent,
      evaluation,
      alertTriggered: alertRecord,
      state: getSafeStatePayload(),
    });
  });

  // Bulk JSON/CSV Import
  app.post('/api/v1/import', requireAdmin, async (req, res) => {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (entries.length === 0) {
      res.status(400).json({ error: 'No log entries provided for import.' });
      return;
    }

    const importedLogs: MessageLog[] = [];
    const touchedAccountIds = new Set<string>();

    for (const row of entries.slice(0, 500)) {
      if (!row || typeof row.message_text !== 'string' || !row.message_text.trim()) {
        continue;
      }
      const rawAccountId = typeof row.account_id === 'string' ? row.account_id.trim() : '';
      const rawHandle = typeof row.handle === 'string' ? row.handle.trim() : '';
      let target = resolveAccountByIdOrHandle(
        rawAccountId || undefined,
        rawHandle || undefined
      );

      if (!target) {
        const handleLabel = rawHandle
          ? rawHandle.startsWith('@')
            ? rawHandle
            : `@${rawHandle}`
          : `@${rawAccountId || 'imported.account'}`;
        target = {
          account_id: rawAccountId || `acc_${crypto.randomBytes(4).toString('hex')}`,
          handle: handleLabel,
          display_name: handleLabel.slice(1),
          category: 'Imported Log Account',
          follower_count: 10000,
          normal_hours_start: 8,
          normal_hours_end: 22,
          trusted_device_id:
            typeof row.device_id === 'string' && row.device_id.trim()
              ? row.device_id.trim()
              : 'dev_imported_baseline',
          home_location:
            typeof row.location === 'string' && row.location.trim()
              ? row.location.trim()
              : 'Unknown',
        };
        store.accounts = [target, ...store.accounts];
      }

      const parsedTs =
        typeof row.timestamp === 'string' && !Number.isNaN(Date.parse(row.timestamp))
          ? new Date(row.timestamp).toISOString()
          : new Date().toISOString();

      importedLogs.push({
        id: `msg_imp_${crypto.randomBytes(5).toString('hex')}`,
        account_id: target.account_id,
        follower_id:
          typeof row.follower_id === 'string' && row.follower_id.trim()
            ? row.follower_id.trim()
            : `fol_${crypto.randomBytes(3).toString('hex')}`,
        message_text: row.message_text.trim().slice(0, 2000),
        link_url:
          typeof row.link_url === 'string' && row.link_url.trim()
            ? row.link_url.trim()
            : null,
        timestamp: parsedTs,
        device_id:
          typeof row.device_id === 'string' && row.device_id.trim()
            ? row.device_id.trim()
            : target.trusted_device_id,
        location:
          typeof row.location === 'string' && row.location.trim()
            ? row.location.trim()
            : target.home_location,
        is_simulated_attack: false,
      });
      touchedAccountIds.add(target.account_id);
    }

    if (importedLogs.length === 0) {
      res.status(400).json({ error: 'No valid rows containing message_text were found.' });
      return;
    }

    store.logs = [...importedLogs, ...store.logs];

    const evaluations = evaluateAllAccounts(
      store.accounts,
      store.logs,
      store.config,
      store.loginEvents
    );

    const newAlerts: AlertRecord[] = [];
    for (const accId of touchedAccountIds) {
      const ev = evaluations.find((e) => e.account.account_id === accId);
      if (ev && ev.suspicion_score >= store.config.flagThreshold) {
        const alert = createAlertFromEvaluation(ev, new Date().toISOString());
        newAlerts.push(alert);
        store.alerts = [alert, ...store.alerts];
      }
    }

    saveStore(store);
    for (const alert of newAlerts) {
      await dispatchOutboundWebhooks(alert);
    }

    res.status(201).json({
      importedCount: importedLogs.length,
      alertsCreated: newAlerts.length,
      state: getSafeStatePayload(),
    });
  });

  // Server-side Gemini AI Semantic Phishing & Bot Analysis
  app.post('/api/v1/analyze/:accountId', requireAdmin, async (req, res) => {
    const accountId = String(req.params.accountId);
    const target = store.accounts.find((a) => a.account_id === accountId);
    if (!target) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(400).json({
        error:
          'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets to run live AI semantic analysis.',
      });
      return;
    }

    const accountLogs = store.logs
      .filter((l) => l.account_id === target.account_id)
      .slice(0, 20);
    const accountLogins = store.loginEvents
      .filter((ln) => ln.account_id === target.account_id)
      .slice(0, 10);

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Analyze this social media account's baseline profile, recent direct messages, and recent login events for signs of account compromise, automated bot/AI phishing campaigns, social engineering lures, or credential theft.

Account Baseline:
- Handle: ${target.handle}
- Category: ${target.category}
- Normal Active Hours: ${target.normal_hours_start}:00 to ${target.normal_hours_end}:00
- Trusted Device: ${target.trusted_device_id}
- Home Location: ${target.home_location}

Recent Messages (up to 20):
${JSON.stringify(accountLogs, null, 2)}

Recent Login Events:
${JSON.stringify(accountLogins, null, 2)}

Provide:
- ai_risk_score (0-100 integer)
- phishing_category (short label like "Giveaway / Airdrop Phishing", "Account Takeover Lure", "Benign Creator Reply", etc.)
- automated_bot_likelihood ("Low", "Medium", or "High")
- summary_en (concise 2-sentence plain English security assessment)
- summary_tanglish (concise 2-sentence Tanglish [Tamil words in English script + English] explanation of the finding)
- recommended_action (concrete next security step for owner/team)`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a trust & safety security analyst evaluating social media account takeover and automated phishing DM telemetry. Be accurate, concise, and never invent evidence not present in the logs.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ai_risk_score: { type: Type.INTEGER },
              phishing_category: { type: Type.STRING },
              automated_bot_likelihood: {
                type: Type.STRING,
                enum: ['Low', 'Medium', 'High'],
              },
              summary_en: { type: Type.STRING },
              summary_tanglish: { type: Type.STRING },
              recommended_action: { type: Type.STRING },
            },
            required: [
              'ai_risk_score',
              'phishing_category',
              'automated_bot_likelihood',
              'summary_en',
              'summary_tanglish',
              'recommended_action',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as Omit<
        AiAccountAnalysis,
        'account_id' | 'analyzed_at'
      >;

      const result: AiAccountAnalysis = {
        account_id: target.account_id,
        analyzed_at: new Date().toISOString(),
        ai_risk_score: Math.min(100, Math.max(0, Math.round(parsed.ai_risk_score))),
        phishing_category: parsed.phishing_category,
        automated_bot_likelihood: parsed.automated_bot_likelihood,
        summary_en: parsed.summary_en,
        summary_tanglish: parsed.summary_tanglish,
        recommended_action: parsed.recommended_action,
      };

      store.aiAnalyses[target.account_id] = result;
      saveStore(store);
      res.json({ analysis: result, state: getSafeStatePayload() });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Gemini AI analysis failed.';
      res.status(502).json({ error: message });
    }
  });

  // Outbound Webhook Endpoints (Slack / Discord / Custom HTTPS)
  app.post('/api/v1/webhooks', requireAdmin, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

    if (!name || !rawUrl) {
      res.status(400).json({ error: 'Webhook name and https:// URL are required.' });
      return;
    }

    try {
      const validated = await validateExternalWebhookUrl(rawUrl);
      const hook: OutboundWebhook = {
        id: `wh_${crypto.randomBytes(4).toString('hex')}`,
        name,
        url: validated.toString(),
        enabled: true,
        created_at: new Date().toISOString(),
      };
      store.outboundWebhooks = [hook, ...store.outboundWebhooks];
      saveStore(store);
      res.status(201).json({ webhook: hook, state: getSafeStatePayload() });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid webhook URL.',
      });
    }
  });

  app.post('/api/v1/webhooks/:id/test', requireAdmin, async (req, res) => {
    const hook = store.outboundWebhooks.find((h) => h.id === String(req.params.id));
    if (!hook) {
      res.status(404).json({ error: 'Webhook not found.' });
      return;
    }
    try {
      const safeUrl = await validateExternalWebhookUrl(hook.url);
      const response = await fetch(safeUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Suspicious-Activity-Detector/1.0',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          text: '[TEST] Suspicious Activity Detector webhook connection verified.',
          content: '[TEST] Suspicious Activity Detector webhook connection verified.',
          event: 'webhook_test',
          timestamp: new Date().toISOString(),
        }),
      });
      hook.last_status = response.ok
        ? `Test OK (${response.status})`
        : `HTTP ${response.status}`;
      hook.last_dispatched_at = new Date().toISOString();
      saveStore(store);
      res.json({ ok: response.ok, status: hook.last_status, state: getSafeStatePayload() });
    } catch (err) {
      hook.last_status =
        err instanceof Error ? `Failed: ${err.message}` : 'Delivery failed';
      hook.last_dispatched_at = new Date().toISOString();
      saveStore(store);
      res.status(502).json({ error: hook.last_status, state: getSafeStatePayload() });
    }
  });

  app.delete('/api/v1/webhooks/:id', requireAdmin, (req, res) => {
    const id = String(req.params.id);
    store.outboundWebhooks = store.outboundWebhooks.filter((h) => h.id !== id);
    saveStore(store);
    res.json({ state: getSafeStatePayload() });
  });

  app.post('/api/v1/ingest-key/rotate', requireAdmin, (_req, res) => {
    store.ingestApiKey = `sadk_${crypto.randomBytes(20).toString('hex')}`;
    saveStore(store);
    res.json({ state: getSafeStatePayload() });
  });

  // Simulation / Test Controls (backed by server persistence)
  app.post('/api/v1/simulate/hack', requireAdmin, async (req, res) => {
    const requestedId =
      typeof req.body?.account_id === 'string' ? req.body.account_id : undefined;

    const currentEvals = evaluateAllAccounts(
      store.accounts,
      store.logs,
      store.config,
      store.loginEvents
    );
    let target: SimulatedAccount | undefined;
    if (requestedId) {
      target = store.accounts.find((a) => a.account_id === requestedId);
    } else {
      const nonFlagged = currentEvals.filter((e) => e.status !== 'Flagged');
      const pool = nonFlagged.length > 0 ? nonFlagged : currentEvals;
      target = pool[Math.floor(Math.random() * pool.length)]?.account;
    }

    if (!target) {
      res.status(400).json({ error: 'No monitored accounts available. Add an account first.' });
      return;
    }

    store.logs = injectSimulatedHackBurst(target, store.logs);
    const updatedEval = evaluateAccount(
      target,
      store.logs.filter((l) => l.account_id === target!.account_id),
      store.config,
      store.loginEvents.filter((ln) => ln.account_id === target!.account_id)
    );

    let alert: AlertRecord | null = null;
    if (updatedEval.suspicion_score >= store.config.flagThreshold) {
      alert = createAlertFromEvaluation(updatedEval, new Date().toISOString());
      store.alerts = [alert, ...store.alerts];
      saveStore(store);
      await dispatchOutboundWebhooks(alert);
    } else {
      saveStore(store);
    }

    res.json({ targetAccountId: target.account_id, evaluation: updatedEval, alert, state: getSafeStatePayload() });
  });

  app.post('/api/v1/simulate/normal', requireAdmin, (req, res) => {
    const accountId = typeof req.body?.account_id === 'string' ? req.body.account_id : '';
    const target = store.accounts.find((a) => a.account_id === accountId);
    if (!target) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    store.logs = injectNormalMessage(target, store.logs);
    saveStore(store);
    res.json({ state: getSafeStatePayload() });
  });

  app.post('/api/v1/data/clear', requireAdmin, (_req, res) => {
    store.accounts = [];
    store.logs = [];
    store.loginEvents = [];
    store.alerts = [];
    store.aiAnalyses = {};
    saveStore(store);
    res.json({ state: getSafeStatePayload() });
  });

  app.post('/api/v1/data/seed-sample', requireAdmin, (_req, res) => {
    const seeded = generateInitialSyntheticData(store.config);
    store.accounts = seeded.accounts;
    store.logs = seeded.logs;
    store.loginEvents = [];
    store.alerts = seeded.alerts;
    store.aiAnalyses = {};
    saveStore(store);
    res.json({ state: getSafeStatePayload() });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Suspicious Activity Detector server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
