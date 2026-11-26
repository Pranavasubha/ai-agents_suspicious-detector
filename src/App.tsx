import { AlertCircle, CheckCircle2, Lock, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountInspectModal } from './components/AccountInspectModal';
import { AccountsTable } from './components/AccountsTable';
import { AdminAccessModal } from './components/AdminAccessModal';
import { AlertHistoryPanel } from './components/AlertHistoryPanel';
import { DemoSection } from './components/DemoSection';
import { DetectionRulesView } from './components/DetectionRulesView';
import { ImportLogsView, ImportedMessageRow } from './components/ImportLogsView';
import { IntegrationsView } from './components/IntegrationsView';
import { KpiStrip } from './components/KpiStrip';
import { LinkedAccountInput, LinkedAccountPanel } from './components/LinkedAccountPanel';
import { MessageLogsView } from './components/MessageLogsView';
import { NewIdLoginPayload, NewIdLoginView } from './components/NewIdLoginView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import {
  DEFAULT_DETECTION_CONFIG,
  createAlertFromEvaluation,
  evaluateAccount,
  evaluateAllAccounts,
  isUnusualHour,
} from './engine/detectionEngine';
import {
  generateInitialSyntheticData,
  injectNormalMessage,
  injectSimulatedHackBurst,
} from './engine/syntheticData';
import {
  AccountStatus,
  AiAccountAnalysis,
  AlertRecord,
  DashboardStatePayload,
  DetectionConfig,
  LoginEvent,
  MessageLog,
  NavSection,
  OutboundWebhook,
  SimulatedAccount,
} from './types/simulation';

interface EventNotice {
  type: 'alert' | 'info';
  title: string;
  detail: string;
}

export default function App() {
  const fallbackSeed = useMemo(
    () => generateInitialSyntheticData(DEFAULT_DETECTION_CONFIG),
    []
  );

  // Admin session token held strictly in JS memory
  const [token, setToken] = useState<string | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const [accounts, setAccounts] = useState<SimulatedAccount[]>(fallbackSeed.accounts);
  const [logs, setLogs] = useState<MessageLog[]>(fallbackSeed.logs);
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>(fallbackSeed.alerts);
  const [config, setConfig] = useState<DetectionConfig>(DEFAULT_DETECTION_CONFIG);
  const [outboundWebhooks, setOutboundWebhooks] = useState<OutboundWebhook[]>([]);
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, AiAccountAnalysis>>({});
  const [ingestApiKey, setIngestApiKey] = useState('');

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    fallbackSeed.accounts[0]?.account_id ?? null
  );
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'All' | AccountStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [eventNotice, setEventNotice] = useState<EventNotice | null>(null);

  const applyPublicWorkspace = useCallback(
    (data: Omit<DashboardStatePayload, 'outboundWebhooks' | 'ingestApiKey'>) => {
      setAccounts(data.accounts);
      setLogs(data.logs);
      setLoginEvents(data.loginEvents);
      setAlerts(data.alerts);
      setConfig(data.config);
      setAiAnalyses(data.aiAnalyses);
    },
    []
  );

  const applyFullServerState = useCallback((state: DashboardStatePayload) => {
    setAccounts(state.accounts);
    setLogs(state.logs);
    setLoginEvents(state.loginEvents);
    setAlerts(state.alerts);
    setConfig(state.config);
    setOutboundWebhooks(state.outboundWebhooks);
    setAiAnalyses(state.aiAnalyses);
    setIngestApiKey(state.ingestApiKey);
  }, []);

  const authedFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...options, headers });
      const data = (await res.json()) as T & { error?: string };
      if (res.status === 401) {
        setToken(null);
        setAdminModalOpen(true);
        throw new Error(data.error || 'Admin session required. Please unlock with passcode.');
      }
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    },
    [token]
  );

  // Load sanitized workspace immediately on startup (no login wall)
  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      try {
        const res = await fetch('/api/v1/workspace');
        if (!res.ok) return;
        const data = (await res.json()) as Omit<
          DashboardStatePayload,
          'outboundWebhooks' | 'ingestApiKey'
        >;
        if (!cancelled) {
          applyPublicWorkspace(data);
          if (data.accounts.length > 0) {
            setSelectedAccountId((prev) => prev ?? data.accounts[0].account_id);
          }
        }
      } catch {
        // Fallback seed remains active if server is unreachable
      }
    }
    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [applyPublicWorkspace]);

  // When Admin Passcode is unlocked, hydrate full protected state (webhooks + ingest key)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authedFetch<DashboardStatePayload>('/api/v1/state')
      .then((state) => {
        if (!cancelled) applyFullServerState(state);
      })
      .catch(() => {
        // Handled by authedFetch
      });
    return () => {
      cancelled = true;
    };
  }, [token, authedFetch, applyFullServerState]);

  const evaluations = useMemo(
    () => evaluateAllAccounts(accounts, logs, config, loginEvents),
    [accounts, logs, config, loginEvents]
  );

  const selectedEvaluation = useMemo(
    () =>
      evaluations.find((ev) => ev.account.account_id === selectedAccountId) ??
      evaluations[0] ??
      null,
    [evaluations, selectedAccountId]
  );

  const flaggedCount = evaluations.filter((e) => e.status === 'Flagged').length;

  async function handleAddLinkedAccount(payload: LinkedAccountInput) {
    if (token) {
      const res = await authedFetch<{
        account: SimulatedAccount;
        state: DashboardStatePayload;
      }>('/api/v1/accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      applyFullServerState(res.state);
      setSelectedAccountId(res.account.account_id);
      setEventNotice({
        type: 'info',
        title: `Linked & saved ${res.account.handle} (${res.account.platform})`,
        detail: `Baseline: ${res.account.trusted_device_id} · ${res.account.home_location}`,
      });
      return;
    }

    // Immediate interactive workspace mode before Admin Passcode unlock
    const normalizedHandle = payload.handle.startsWith('@')
      ? payload.handle
      : `@${payload.handle}`;
    if (
      accounts.some(
        (a) => a.handle.toLowerCase() === normalizedHandle.toLowerCase()
      )
    ) {
      throw new Error(`Account ${normalizedHandle} is already in your workspace.`);
    }

    const localAcc: SimulatedAccount = {
      account_id: `acc_local_${Date.now().toString().slice(-5)}`,
      handle: normalizedHandle,
      display_name: payload.display_name,
      platform: payload.platform,
      category: payload.category,
      follower_count: payload.follower_count,
      normal_hours_start: payload.normal_hours_start,
      normal_hours_end: payload.normal_hours_end,
      trusted_device_id: payload.trusted_device_id,
      home_location: payload.home_location,
    };

    setAccounts((prev) => [localAcc, ...prev]);
    setSelectedAccountId(localAcc.account_id);
    setEventNotice({
      type: 'info',
      title: `Linked ${localAcc.handle} (${localAcc.platform}) in live workspace`,
      detail: 'Click the row to open the full View All modal, or unlock Admin Passcode to persist to server.',
    });
  }

  async function handleSimulateHackEvent(specificAccountId?: string) {
    if (token) {
      try {
        const res = await authedFetch<{
          targetAccountId: string;
          evaluation: { account: SimulatedAccount; suspicion_score: number; status: AccountStatus };
          alert: AlertRecord | null;
          state: DashboardStatePayload;
        }>('/api/v1/simulate/hack', {
          method: 'POST',
          body: JSON.stringify(
            specificAccountId ? { account_id: specificAccountId } : {}
          ),
        });
        applyFullServerState(res.state);
        setSelectedAccountId(res.targetAccountId);
        setInspectModalOpen(true);
        setEventNotice({
          type: res.alert ? 'alert' : 'info',
          title: `Attack burst detected on ${res.evaluation.account.handle} (Score: ${res.evaluation.suspicion_score}/100)`,
          detail: res.alert
            ? 'Owner & Follower alerts recorded and dispatched to configured webhooks.'
            : `Current status: ${res.evaluation.status}.`,
        });
        return;
      } catch (err) {
        setEventNotice({
          type: 'alert',
          title: 'Simulation failed',
          detail: err instanceof Error ? err.message : 'Unable to trigger event.',
        });
        return;
      }
    }

    // Interactive Demo Mode when Admin Mode is locked
    const targetAcc = specificAccountId
      ? accounts.find((a) => a.account_id === specificAccountId)
      : (() => {
          const nonFlagged = evaluations.filter((e) => e.status !== 'Flagged');
          const pool = nonFlagged.length > 0 ? nonFlagged : evaluations;
          return pool[Math.floor(Math.random() * pool.length)]?.account;
        })();

    if (!targetAcc) {
      setEventNotice({
        type: 'info',
        title: 'No linked accounts available',
        detail: 'Add a linked account in the top panel first to test an attack burst.',
      });
      return;
    }

    const nextLogs = injectSimulatedHackBurst(targetAcc, logs);
    setLogs(nextLogs);
    const updatedEval = evaluateAccount(
      targetAcc,
      nextLogs.filter((l) => l.account_id === targetAcc.account_id),
      config,
      loginEvents.filter((ln) => ln.account_id === targetAcc.account_id)
    );

    if (updatedEval.suspicion_score >= config.flagThreshold) {
      const alert = createAlertFromEvaluation(updatedEval, new Date().toISOString());
      setAlerts((prev) => [alert, ...prev]);
    }
    setSelectedAccountId(targetAcc.account_id);
    setInspectModalOpen(true);
    setEventNotice({
      type: 'alert',
      title: `Demo attack detected on ${targetAcc.handle} (Score: ${updatedEval.suspicion_score}/100)`,
      detail: 'Opened full inspector modal with feature breakdown, Owner alert, and Follower warning.',
    });
  }

  async function handleInjectNormalForAccount(accountId: string) {
    if (token) {
      try {
        const res = await authedFetch<{ state: DashboardStatePayload }>(
          '/api/v1/simulate/normal',
          { method: 'POST', body: JSON.stringify({ account_id: accountId }) }
        );
        applyFullServerState(res.state);
        setEventNotice({
          type: 'info',
          title: 'Normal DM logged',
          detail: 'Baseline activity saved to persistent store.',
        });
      } catch (err) {
        setEventNotice({
          type: 'alert',
          title: 'Error logging normal DM',
          detail: err instanceof Error ? err.message : 'Failed.',
        });
      }
      return;
    }

    const target = accounts.find((a) => a.account_id === accountId);
    if (!target) return;
    setLogs((prev) => injectNormalMessage(target, prev));
    setEventNotice({
      type: 'info',
      title: `Demo normal DM logged for ${target.handle}`,
      detail: `Sent from trusted device ${target.trusted_device_id} in ${target.home_location}.`,
    });
  }

  async function handleRunNewIdLogin(payload: NewIdLoginPayload) {
    if (token) {
      try {
        const res = await authedFetch<{
          account: SimulatedAccount;
          loginEvent: LoginEvent;
          alertTriggered: AlertRecord | null;
          state: DashboardStatePayload;
        }>('/api/v1/login-check', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        applyFullServerState(res.state);
        setSelectedAccountId(res.account.account_id);
        setEventNotice({
          type: res.alertTriggered ? 'alert' : 'info',
          title: `New ID Login on ${res.account.handle}: ${res.loginEvent.status_after_login} (${res.loginEvent.score_after_login}/100)`,
          detail:
            res.loginEvent.findings.length > 0
              ? res.loginEvent.findings.join(' · ')
              : 'Matched baseline device, location, and active hours.',
        });
      } catch (err) {
        setEventNotice({
          type: 'alert',
          title: 'Login check failed',
          detail: err instanceof Error ? err.message : 'Failed.',
        });
      }
      return;
    }

    // Interactive Demo Mode when Admin Mode is locked
    let nextAccounts = accounts;
    let targetAccount: SimulatedAccount;
    if (payload.mode === 'new_account_id') {
      targetAccount = {
        account_id: `acc_new_${Date.now().toString().slice(-5)}`,
        handle: payload.newHandle,
        display_name: payload.newDisplayName,
        platform: 'Instagram',
        category: payload.newCategory,
        follower_count: 42500,
        normal_hours_start: 8,
        normal_hours_end: 21,
        trusted_device_id: payload.trustedDeviceId,
        home_location: payload.homeLocation,
      };
      nextAccounts = [targetAccount, ...accounts];
      setAccounts(nextAccounts);
    } else {
      const found = accounts.find((a) => a.account_id === payload.existingAccountId);
      if (!found) return;
      targetAccount = found;
    }

    const loginDate = new Date();
    loginDate.setHours(payload.loginHour, 18, 0, 0);
    const loginIso = loginDate.toISOString();
    const findings: string[] = [];
    if (payload.loginDeviceId !== targetAccount.trusted_device_id) {
      findings.push(`Unrecognized device (${payload.loginDeviceId})`);
    }
    if (payload.loginLocation !== targetAccount.home_location) {
      findings.push(`Unfamiliar location (${payload.loginLocation})`);
    }
    if (
      isUnusualHour(
        loginIso,
        targetAccount.normal_hours_start,
        targetAccount.normal_hours_end
      )
    ) {
      findings.push(`Odd login hour (${String(payload.loginHour).padStart(2, '0')}:18)`);
    }

    let nextLogs = logs;
    if (payload.simulateAgentBurst) {
      const burstTemplates = [
        'Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:',
        'Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:',
        'Hi! Exclusive creator fan reward is open now — claim your bonus link before it closes:',
        'Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:',
        'Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:',
      ];
      const injectedBurst: MessageLog[] = burstTemplates.map((text, idx) => ({
        id: `msg_lgn_${Date.now()}_${idx}`,
        account_id: targetAccount.account_id,
        follower_id: `fol_${41000 + idx * 73}`,
        message_text: text,
        link_url:
          idx % 2 === 0
            ? 'https://bit.ly/creator-bonus-claim'
            : 'https://verify-fan-reward.xyz/login',
        timestamp: new Date(loginDate.getTime() + (idx + 1) * 35 * 1000).toISOString(),
        device_id: payload.loginDeviceId,
        location: payload.loginLocation,
        is_simulated_attack: true,
      }));
      nextLogs = [...injectedBurst, ...logs];
      findings.push('Automated AI-agent bulk DM burst + suspicious URLs');
    }

    const prelimLogins = [
      {
        account_id: targetAccount.account_id,
        device_id: payload.loginDeviceId,
        location: payload.loginLocation,
        timestamp: loginIso,
      },
      ...loginEvents.filter((ln) => ln.account_id === targetAccount.account_id),
    ];
    const evalRes = evaluateAccount(
      targetAccount,
      nextLogs.filter((l) => l.account_id === targetAccount.account_id),
      config,
      prelimLogins
    );

    const newLoginEvent: LoginEvent = {
      id: `lgn_${Date.now()}`,
      account_id: targetAccount.account_id,
      handle: targetAccount.handle,
      login_mode: payload.mode,
      device_id: payload.loginDeviceId,
      location: payload.loginLocation,
      timestamp: loginIso,
      suspicious: findings.length > 0 || evalRes.status !== 'Normal',
      findings,
      score_after_login: evalRes.suspicion_score,
      status_after_login: evalRes.status,
    };

    setLogs(nextLogs);
    setLoginEvents((prev) => [newLoginEvent, ...prev]);
    setSelectedAccountId(targetAccount.account_id);

    if (evalRes.suspicion_score >= config.flagThreshold) {
      const alert = createAlertFromEvaluation(evalRes, new Date().toISOString());
      setAlerts((prev) => [alert, ...prev]);
      setEventNotice({
        type: 'alert',
        title: `New ID Login Flagged on ${targetAccount.handle} (${evalRes.suspicion_score}/100)`,
        detail: findings.join(' · '),
      });
    } else {
      setEventNotice({
        type: 'info',
        title: `New ID Login Checked on ${targetAccount.handle}: ${evalRes.status} (${evalRes.suspicion_score}/100)`,
        detail: findings.length > 0 ? findings.join(' · ') : 'Matched baseline.',
      });
    }
  }

  async function handleDeleteAccount(accountId: string) {
    if (token) {
      const res = await authedFetch<{ state: DashboardStatePayload }>(
        `/api/v1/accounts/${encodeURIComponent(accountId)}`,
        { method: 'DELETE' }
      );
      applyFullServerState(res.state);
      setSelectedAccountId(res.state.accounts[0]?.account_id ?? null);
      return;
    }
    setAccounts((prev) => prev.filter((a) => a.account_id !== accountId));
    setLogs((prev) => prev.filter((l) => l.account_id !== accountId));
    setAlerts((prev) => prev.filter((al) => al.account_id !== accountId));
    setSelectedAccountId(null);
  }

  async function handleUpdateConfig(nextConfig: DetectionConfig) {
    setConfig(nextConfig);
    if (!token) return;
    try {
      const res = await authedFetch<{ state: DashboardStatePayload }>('/api/v1/config', {
        method: 'PUT',
        body: JSON.stringify(nextConfig),
      });
      applyFullServerState(res.state);
    } catch {
      // authedFetch triggers Admin modal if expired
    }
  }

  async function handleRunAiAnalysis(accountId: string) {
    if (!token) {
      setAdminModalOpen(true);
      throw new Error('Unlock Admin Passcode first to run server-side Gemini AI audit.');
    }
    const res = await authedFetch<{
      analysis: AiAccountAnalysis;
      state: DashboardStatePayload;
    }>(`/api/v1/analyze/${encodeURIComponent(accountId)}`, { method: 'POST' });
    applyFullServerState(res.state);
  }

  async function handleRotateIngestKey() {
    const res = await authedFetch<{ state: DashboardStatePayload }>(
      '/api/v1/ingest-key/rotate',
      { method: 'POST' }
    );
    applyFullServerState(res.state);
  }

  async function handleAddWebhook(name: string, url: string) {
    const res = await authedFetch<{ state: DashboardStatePayload }>('/api/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({ name, url }),
    });
    applyFullServerState(res.state);
  }

  async function handleTestWebhook(id: string) {
    const res = await authedFetch<{ status: string; state: DashboardStatePayload }>(
      `/api/v1/webhooks/${encodeURIComponent(id)}/test`,
      { method: 'POST' }
    );
    applyFullServerState(res.state);
    setEventNotice({
      type: 'info',
      title: 'Webhook test dispatched',
      detail: `Response: ${res.status}`,
    });
  }

  async function handleDeleteWebhook(id: string) {
    const res = await authedFetch<{ state: DashboardStatePayload }>(
      `/api/v1/webhooks/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    applyFullServerState(res.state);
  }

  async function handleSendLiveTestMessage(payload: {
    handle: string;
    follower_id: string;
    message_text: string;
    link_url: string;
    device_id: string;
    location: string;
  }): Promise<string> {
    const res = await authedFetch<{
      evaluation: { suspicion_score: number; status: AccountStatus };
      alertTriggered: AlertRecord | null;
      state: DashboardStatePayload;
    }>('/api/v1/ingest/message', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    applyFullServerState(res.state);
    return `HTTP 201 Created · Score: ${res.evaluation.suspicion_score}/100 (${res.evaluation.status})${
      res.alertTriggered ? ' · Alert Triggered & Dispatched' : ''
    }`;
  }

  async function handleImportEntries(entries: ImportedMessageRow[]) {
    const res = await authedFetch<{
      importedCount: number;
      alertsCreated: number;
      state: DashboardStatePayload;
    }>('/api/v1/import', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    });
    applyFullServerState(res.state);
    return {
      importedCount: res.importedCount,
      alertsCreated: res.alertsCreated,
    };
  }

  async function handleResetSampleDemo() {
    if (token) {
      const res = await authedFetch<{ state: DashboardStatePayload }>(
        '/api/v1/data/seed-sample',
        { method: 'POST' }
      );
      applyFullServerState(res.state);
      setSelectedAccountId(res.state.accounts[0]?.account_id ?? null);
      setEventNotice({
        type: 'info',
        title: 'Demo dataset reset on server',
        detail: 'Restored starter accounts and synthetic attack examples.',
      });
      return;
    }

    const fresh = generateInitialSyntheticData(config);
    setAccounts(fresh.accounts);
    setLogs(fresh.logs);
    setLoginEvents([]);
    setAlerts(fresh.alerts);
    setSelectedAccountId(fresh.accounts[0]?.account_id ?? null);
    setEventNotice({
      type: 'info',
      title: 'Demo dataset reset',
      detail: 'Restored starter accounts and synthetic attack examples.',
    });
  }

  function handleOpenInspectorModal(accountId: string) {
    setSelectedAccountId(accountId);
    setInspectModalOpen(true);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        flaggedCount={flaggedCount}
        alertCount={alerts.length}
        messageCount={logs.length}
        loginCount={loginEvents.length}
        webhookCount={outboundWebhooks.length}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          isAdminUnlocked={Boolean(token)}
          onOpenAdminModal={() => setAdminModalOpen(true)}
          onSimulateHack={() => handleSimulateHackEvent()}
        />

        <main className="flex-1 p-6 max-w-[1360px] w-full mx-auto space-y-6">
          {eventNotice && (
            <div
              role="status"
              className={`border rounded-xl px-4 py-3 flex items-start justify-between gap-3 ${
                eventNotice.type === 'alert'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {eventNotice.type === 'alert' ? (
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="text-xs">
                  <div className="font-semibold">{eventNotice.title}</div>
                  <div className="opacity-85 mt-0.5">{eventNotice.detail}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEventNotice(null)}
                aria-label="Dismiss notification"
                className="p-1 rounded hover:bg-black/5 text-current shrink-0"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {activeSection === 'overview' && (
            <>
              {/* 1. First Window: Link & Add Social Media Account */}
              <LinkedAccountPanel
                isAdminUnlocked={Boolean(token)}
                onAddLinkedAccount={handleAddLinkedAccount}
                onOpenAdminModal={() => setAdminModalOpen(true)}
              />

              {/* 2. Summary Metrics */}
              <KpiStrip
                evaluations={evaluations}
                alerts={alerts}
                totalMessages={logs.length}
              />

              {/* 3. Monitored Accounts Table (click row to open Full View Modal) + Alert History */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="xl:col-span-2 min-w-0">
                  <AccountsTable
                    evaluations={evaluations}
                    selectedAccountId={selectedEvaluation?.account.account_id ?? null}
                    onSelectAccount={handleOpenInspectorModal}
                    statusFilter={statusFilter}
                    onChangeStatusFilter={setStatusFilter}
                    searchQuery={searchQuery}
                    onChangeSearchQuery={setSearchQuery}
                    config={config}
                  />
                </div>

                <div className="xl:col-span-1 min-w-0">
                  <AlertHistoryPanel
                    alerts={alerts}
                    onSelectAccount={handleOpenInspectorModal}
                    compact
                  />
                </div>
              </div>

              {/* 4. Bottom Demo Section */}
              <DemoSection
                evaluations={evaluations}
                selectedAccountId={selectedEvaluation?.account.account_id ?? null}
                onSimulateRandomHack={() => handleSimulateHackEvent()}
                onSimulateHackOnSelected={(id) => handleSimulateHackEvent(id)}
                onSendNormalOnSelected={handleInjectNormalForAccount}
                onOpenNewIdLogin={() => setActiveSection('login')}
                onResetSampleDemo={handleResetSampleDemo}
              />
            </>
          )}

          {activeSection === 'login' && (
            <NewIdLoginView
              accounts={accounts}
              loginEvents={loginEvents}
              onRunNewIdLogin={handleRunNewIdLogin}
              onSelectAccount={handleOpenInspectorModal}
            />
          )}

          {activeSection === 'integrations' && (
            token ? (
              <IntegrationsView
                ingestApiKey={ingestApiKey}
                outboundWebhooks={outboundWebhooks}
                accounts={accounts}
                onRotateKey={handleRotateIngestKey}
                onAddWebhook={handleAddWebhook}
                onTestWebhook={handleTestWebhook}
                onDeleteWebhook={handleDeleteWebhook}
                onSendLiveTestMessage={handleSendLiveTestMessage}
              />
            ) : (
              <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                <Lock className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Admin Passcode Required for API Keys &amp; Webhooks
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Unlock Admin Mode to view or rotate your live webhook ingestion key and manage outbound Slack/Discord alert webhooks.
                </p>
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Enter Admin Passcode</span>
                </button>
              </section>
            )
          )}

          {activeSection === 'import' && (
            token ? (
              <ImportLogsView onImportEntries={handleImportEntries} />
            ) : (
              <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                <Lock className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Admin Passcode Required to Import Server Logs
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Unlock Admin Mode to import real CSV/JSON platform DM logs into persistent storage.
                </p>
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Enter Admin Passcode</span>
                </button>
              </section>
            )
          )}

          {activeSection === 'logs' && (
            <MessageLogsView
              evaluations={evaluations}
              onSelectAccount={handleOpenInspectorModal}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertHistoryPanel
              alerts={alerts}
              onSelectAccount={handleOpenInspectorModal}
            />
          )}

          {activeSection === 'rules' && (
            <DetectionRulesView
              config={config}
              onChangeConfig={handleUpdateConfig}
            />
          )}
        </main>
      </div>

      {/* View-Everything Account Inspection Modal */}
      <AccountInspectModal
        evaluation={selectedEvaluation}
        open={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        config={config}
        aiAnalysis={
          selectedEvaluation
            ? aiAnalyses[selectedEvaluation.account.account_id]
            : undefined
        }
        onInjectHackForAccount={(id) => handleSimulateHackEvent(id)}
        onInjectNormalForAccount={handleInjectNormalForAccount}
        onRunAiAnalysis={handleRunAiAnalysis}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Admin Passcode Modal */}
      <AdminAccessModal
        open={adminModalOpen}
        isUnlocked={Boolean(token)}
        onClose={() => setAdminModalOpen(false)}
        onAuthenticated={(newToken) => {
          setToken(newToken);
          setEventNotice({
            type: 'info',
            title: 'Admin Mode unlocked',
            detail: 'Full server persistence, webhook keys, CSV/JSON import, and Gemini AI audits are active.',
          });
        }}
        onLock={() => {
          setToken(null);
          setOutboundWebhooks([]);
          setIngestApiKey('');
        }}
      />
    </div>
  );
}
