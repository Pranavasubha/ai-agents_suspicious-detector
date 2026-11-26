import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AccountDetailPanel } from './components/AccountDetailPanel';
import { AccountsTable } from './components/AccountsTable';
import { AlertHistoryPanel } from './components/AlertHistoryPanel';
import { DetectionRulesView } from './components/DetectionRulesView';
import { KpiStrip } from './components/KpiStrip';
import { MessageLogsView } from './components/MessageLogsView';
import { NewIdLoginPayload, NewIdLoginView } from './components/NewIdLoginView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import {
  DEFAULT_DETECTION_CONFIG,
  createAlertFromEvaluation,
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
  AlertRecord,
  DetectionConfig,
  LoginEvent,
  MessageLog,
  NavSection,
  SimulatedAccount,
} from './types/simulation';

interface EventNotice {
  type: 'alert' | 'info';
  title: string;
  detail: string;
}

export default function App() {
  const initialData = useMemo(
    () => generateInitialSyntheticData(DEFAULT_DETECTION_CONFIG),
    []
  );

  const [accounts, setAccounts] = useState<SimulatedAccount[]>(initialData.accounts);
  const [logs, setLogs] = useState<MessageLog[]>(initialData.logs);
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>(initialData.alerts);
  const [config, setConfig] = useState<DetectionConfig>(DEFAULT_DETECTION_CONFIG);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>('acc_02');
  const [statusFilter, setStatusFilter] = useState<'All' | AccountStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [eventNotice, setEventNotice] = useState<EventNotice | null>(null);

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

  function applyLogsAndCheckAlerts(
    nextAccounts: SimulatedAccount[],
    nextLogs: MessageLog[],
    nextLogins: LoginEvent[],
    targetAccount: SimulatedAccount,
    nextConfig: DetectionConfig,
    isHackAction: boolean
  ) {
    setLogs(nextLogs);
    const updatedEvaluations = evaluateAllAccounts(
      nextAccounts,
      nextLogs,
      nextConfig,
      nextLogins
    );
    const updatedTarget = updatedEvaluations.find(
      (e) => e.account.account_id === targetAccount.account_id
    );

    if (!updatedTarget) return;

    if (isHackAction && updatedTarget.suspicion_score >= nextConfig.flagThreshold) {
      const newAlert = createAlertFromEvaluation(
        updatedTarget,
        new Date().toISOString()
      );
      setAlerts((prev) => [newAlert, ...prev]);
      setEventNotice({
        type: 'alert',
        title: `Simulated compromise detected on ${targetAccount.handle} (Score: ${updatedTarget.suspicion_score}/100)`,
        detail: `Injected bulk phishing burst · Owner and Follower alerts recorded in Alert History.`,
      });
    } else if (isHackAction) {
      setEventNotice({
        type: 'info',
        title: `Simulated suspicious burst injected on ${targetAccount.handle} (Score: ${updatedTarget.suspicion_score}/100)`,
        detail: `Current status: ${updatedTarget.status}. Adjust thresholds or inject another burst to cross ${nextConfig.flagThreshold}.`,
      });
    } else {
      setEventNotice({
        type: 'info',
        title: `Normal DM logged for ${targetAccount.handle}`,
        detail: `Sent from trusted device ${targetAccount.trusted_device_id} in ${targetAccount.home_location} during baseline hours.`,
      });
    }
  }

  function handleSimulateHackEvent() {
    const nonFlagged = evaluations.filter((e) => e.status !== 'Flagged');
    const pool = nonFlagged.length > 0 ? nonFlagged : evaluations;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) return;

    const nextLogs = injectSimulatedHackBurst(chosen.account, logs);
    setSelectedAccountId(chosen.account.account_id);
    setStatusFilter('All');
    setActiveSection('overview');
    applyLogsAndCheckAlerts(accounts, nextLogs, loginEvents, chosen.account, config, true);
  }

  function handleInjectHackForAccount(accountId: string) {
    const target = accounts.find((a) => a.account_id === accountId);
    if (!target) return;
    const nextLogs = injectSimulatedHackBurst(target, logs);
    applyLogsAndCheckAlerts(accounts, nextLogs, loginEvents, target, config, true);
  }

  function handleInjectNormalForAccount(accountId: string) {
    const target = accounts.find((a) => a.account_id === accountId);
    if (!target) return;
    const nextLogs = injectNormalMessage(target, logs);
    applyLogsAndCheckAlerts(accounts, nextLogs, loginEvents, target, config, false);
  }

  function handleRunNewIdLogin(payload: NewIdLoginPayload) {
    let nextAccounts = accounts;
    let targetAccount: SimulatedAccount;

    if (payload.mode === 'new_account_id') {
      const newId = `acc_new_${Date.now().toString().slice(-5)}`;
      targetAccount = {
        account_id: newId,
        handle: payload.newHandle,
        display_name: payload.newDisplayName,
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
      findings.push(
        `Odd login hour (${String(payload.loginHour).padStart(2, '0')}:18)`
      );
    }

    let nextLogs = logs;
    if (payload.simulateAgentBurst) {
      // Inject simulated AI-agent burst using the incoming login device/location/hour
      const burstTemplates = [
        `Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:`,
        `Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:`,
        `Hi! Exclusive creator fan reward is open now — claim your bonus link before it closes:`,
        `Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:`,
        `Hey! Exclusive creator fan reward is open now — claim your bonus link before tonight:`,
      ];
      const injectedBurst: MessageLog[] = burstTemplates.map((text, idx) => {
        const msgTime = new Date(loginDate.getTime() + (idx + 1) * 35 * 1000);
        return {
          id: `msg_login_burst_${targetAccount.account_id}_${Date.now()}_${idx}`,
          account_id: targetAccount.account_id,
          follower_id: `fol_${41000 + idx * 73}`,
          message_text: text,
          link_url:
            idx % 2 === 0
              ? 'https://bit.ly/creator-bonus-claim'
              : 'https://verify-fan-reward.xyz/login',
          timestamp: msgTime.toISOString(),
          device_id: payload.loginDeviceId,
          location: payload.loginLocation,
          is_simulated_attack: true,
        };
      });
      nextLogs = [...injectedBurst, ...logs];
      findings.push('Automated AI-agent bulk DM burst + suspicious URLs');
    } else if (payload.mode === 'new_account_id') {
      // Log one baseline or login-session DM record if no burst is chosen so the log table reflects it
      nextLogs = [
        {
          id: `msg_newid_${targetAccount.account_id}_${Date.now()}`,
          account_id: targetAccount.account_id,
          follower_id: 'fol_10492',
          message_text: 'Thanks for following! Excited to share new updates here soon.',
          link_url: null,
          timestamp: loginIso,
          device_id: payload.loginDeviceId,
          location: payload.loginLocation,
          is_simulated_attack: findings.length > 0,
        },
        ...logs,
      ];
    }

    const preliminaryLogin = {
      account_id: targetAccount.account_id,
      device_id: payload.loginDeviceId,
      location: payload.loginLocation,
      timestamp: loginIso,
    };

    const updatedEvals = evaluateAllAccounts(
      nextAccounts,
      nextLogs,
      config,
      [preliminaryLogin, ...loginEvents]
    );
    const updatedAccEval = updatedEvals.find(
      (ev) => ev.account.account_id === targetAccount.account_id
    );

    const scoreAfter = updatedAccEval?.suspicion_score ?? 0;
    const statusAfter = updatedAccEval?.status ?? 'Normal';

    const newLoginEvent: LoginEvent = {
      id: `lgn_${targetAccount.account_id}_${Date.now()}`,
      account_id: targetAccount.account_id,
      handle: targetAccount.handle,
      login_mode: payload.mode,
      device_id: payload.loginDeviceId,
      location: payload.loginLocation,
      timestamp: loginIso,
      suspicious: findings.length > 0 || statusAfter !== 'Normal',
      findings,
      score_after_login: scoreAfter,
      status_after_login: statusAfter,
    };

    const nextLoginEvents = [newLoginEvent, ...loginEvents];
    setLoginEvents(nextLoginEvents);
    setLogs(nextLogs);
    setSelectedAccountId(targetAccount.account_id);

    if (updatedAccEval && scoreAfter >= config.flagThreshold) {
      const alert = createAlertFromEvaluation(updatedAccEval, new Date().toISOString());
      setAlerts((prev) => [alert, ...prev]);
      setEventNotice({
        type: 'alert',
        title: `New ID Login Flagged on ${targetAccount.handle} (Score: ${scoreAfter}/100)`,
        detail: `${findings.join(' · ')}. Owner & Follower alerts added to Alert History.`,
      });
    } else if (findings.length > 0) {
      setEventNotice({
        type: 'info',
        title: `New ID Login Suspicious Finding on ${targetAccount.handle} (${statusAfter}: ${scoreAfter}/100)`,
        detail: findings.join(' · '),
      });
    } else {
      setEventNotice({
        type: 'info',
        title: `New ID Login Verified Normal for ${targetAccount.handle} (0/100)`,
        detail: `Device (${payload.loginDeviceId}), location (${payload.loginLocation}), and hour matched baseline.`,
      });
    }
  }

  function handleResetDemo() {
    const fresh = generateInitialSyntheticData(config);
    setAccounts(fresh.accounts);
    setLogs(fresh.logs);
    setLoginEvents([]);
    setAlerts(fresh.alerts);
    setSelectedAccountId('acc_02');
    setStatusFilter('All');
    setSearchQuery('');
    setEventNotice({
      type: 'info',
      title: 'Synthetic simulation dataset reset',
      detail: 'Restored baseline accounts, synthetic message logs, and initial demonstration alerts.',
    });
  }

  function handleSelectAccountAndInspect(accountId: string) {
    setSelectedAccountId(accountId);
    setActiveSection('overview');
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
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          onSimulateHack={handleSimulateHackEvent}
          onResetDemo={handleResetDemo}
        />

        <main className="flex-1 p-6 max-w-[1360px] w-full mx-auto space-y-6">
          {/* Clear Demo Disclosure */}
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              <strong className="font-semibold text-slate-800">Security-Awareness Simulation:</strong>{' '}
              Uses synthetic JSON message logs and rule-based heuristics only — not connected to live social media APIs or real user accounts.
            </span>
            <span className="font-mono text-slate-500">
              Green = Normal · Yellow = Watch · Red = Flagged
            </span>
          </div>

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
              <KpiStrip
                evaluations={evaluations}
                alerts={alerts}
                totalMessages={logs.length}
              />

              <AccountsTable
                evaluations={evaluations}
                selectedAccountId={selectedEvaluation?.account.account_id ?? null}
                onSelectAccount={(id) => setSelectedAccountId(id)}
                statusFilter={statusFilter}
                onChangeStatusFilter={setStatusFilter}
                searchQuery={searchQuery}
                onChangeSearchQuery={setSearchQuery}
                config={config}
              />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="xl:col-span-2 min-w-0">
                  <AccountDetailPanel
                    evaluation={selectedEvaluation}
                    config={config}
                    onInjectHackForAccount={handleInjectHackForAccount}
                    onInjectNormalForAccount={handleInjectNormalForAccount}
                  />
                </div>

                <div className="xl:col-span-1 min-w-0">
                  <AlertHistoryPanel
                    alerts={alerts}
                    onSelectAccount={handleSelectAccountAndInspect}
                    compact
                  />
                </div>
              </div>
            </>
          )}

          {activeSection === 'login' && (
            <NewIdLoginView
              accounts={accounts}
              loginEvents={loginEvents}
              onRunNewIdLogin={handleRunNewIdLogin}
              onSelectAccount={handleSelectAccountAndInspect}
            />
          )}

          {activeSection === 'logs' && (
            <MessageLogsView
              evaluations={evaluations}
              onSelectAccount={handleSelectAccountAndInspect}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertHistoryPanel
              alerts={alerts}
              onSelectAccount={handleSelectAccountAndInspect}
            />
          )}

          {activeSection === 'rules' && (
            <DetectionRulesView
              config={config}
              onChangeConfig={(next) => setConfig(next)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

