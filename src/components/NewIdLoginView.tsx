import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  KeyRound,
  LogIn,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import {
  LoginEvent,
  SimulatedAccount,
} from '../types/simulation';
import { StatusIndicator } from './StatusBadge';

export interface NewIdLoginPayload {
  mode: 'new_account_id' | 'existing_account_login';
  existingAccountId: string;
  newHandle: string;
  newDisplayName: string;
  newCategory: string;
  trustedDeviceId: string;
  homeLocation: string;
  loginDeviceId: string;
  loginLocation: string;
  loginHour: number;
  simulateAgentBurst: boolean;
}

interface NewIdLoginViewProps {
  accounts: SimulatedAccount[];
  loginEvents: LoginEvent[];
  onRunNewIdLogin: (payload: NewIdLoginPayload) => void;
  onSelectAccount: (accountId: string) => void;
}

export function NewIdLoginView({
  accounts,
  loginEvents,
  onRunNewIdLogin,
  onSelectAccount,
}: NewIdLoginViewProps) {
  const [mode, setMode] = useState<'new_account_id' | 'existing_account_login'>(
    'new_account_id'
  );
  const [existingAccountId, setExistingAccountId] = useState<string>(
    accounts[0]?.account_id ?? 'acc_01'
  );
  const [newHandle, setNewHandle] = useState('@kiran.beats.demo');
  const [newDisplayName, setNewDisplayName] = useState('Kiran Raj (Demo)');
  const [newCategory, setNewCategory] = useState('Audio Production');
  const [trustedDeviceId, setTrustedDeviceId] = useState('dev_iphone15_kiran');
  const [homeLocation, setHomeLocation] = useState('Chennai, IN');

  const [loginDeviceId, setLoginDeviceId] = useState('dev_ai_agent_headless_512');
  const [loginLocation, setLoginLocation] = useState('Sofia, BG');
  const [loginHour, setLoginHour] = useState<number>(3);
  const [simulateAgentBurst, setSimulateAgentBurst] = useState<boolean>(true);

  const [explanationLang, setExplanationLang] = useState<'both' | 'en' | 'tanglish'>(
    'both'
  );

  function applySuspiciousPreset() {
    setMode('new_account_id');
    const randSuffix = Math.floor(100 + Math.random() * 899);
    setNewHandle(`@creator.demo.${randSuffix}`);
    setNewDisplayName(`Creator Demo ${randSuffix}`);
    setNewCategory('Lifestyle & Tech');
    setTrustedDeviceId(`dev_iphone15_${randSuffix}`);
    setHomeLocation('Bengaluru, IN');
    setLoginDeviceId(`dev_ai_agent_proxy_${randSuffix}`);
    setLoginLocation('Bucharest, RO');
    setLoginHour(3);
    setSimulateAgentBurst(true);
  }

  function applyNormalPreset() {
    setMode('new_account_id');
    const randSuffix = Math.floor(100 + Math.random() * 899);
    const dev = `dev_pixel9_${randSuffix}`;
    const loc = 'Chennai, IN';
    setNewHandle(`@studio.demo.${randSuffix}`);
    setNewDisplayName(`Studio Demo ${randSuffix}`);
    setNewCategory('Design Notes');
    setTrustedDeviceId(dev);
    setHomeLocation(loc);
    setLoginDeviceId(dev);
    setLoginLocation(loc);
    setLoginHour(14);
    setSimulateAgentBurst(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onRunNewIdLogin({
      mode,
      existingAccountId,
      newHandle: newHandle.trim().startsWith('@')
        ? newHandle.trim()
        : `@${newHandle.trim() || 'new.demo.id'}`,
      newDisplayName: newDisplayName.trim() || 'New Demo User',
      newCategory: newCategory.trim() || 'Creator Demo',
      trustedDeviceId: trustedDeviceId.trim() || 'dev_trusted_01',
      homeLocation: homeLocation.trim() || 'Austin, US',
      loginDeviceId: loginDeviceId.trim() || 'dev_unknown_01',
      loginLocation: loginLocation.trim() || 'Unknown City',
      loginHour,
      simulateAgentBurst,
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* New ID Login Process Form */}
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                New ID Login &amp; Suspicious Finding Simulator
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate creating a new account ID or logging into an account from a new device/location to test detection.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={applyNormalPreset}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
              >
                Fill Normal Login
              </button>
              <button
                type="button"
                onClick={applySuspiciousPreset}
                className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-medium text-red-800 whitespace-nowrap"
              >
                Fill Suspicious Login
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Process Mode Toggle */}
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-2">
                Login Process Type
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('new_account_id')}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border text-left transition-colors ${
                    mode === 'new_account_id'
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold">Create New ID &amp; Login</div>
                    <div className="text-[11px] text-slate-500">
                      Register a fresh simulated account ID and test its login session
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('existing_account_login')}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border text-left transition-colors ${
                    mode === 'existing_account_login'
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold">Login on Existing Account ID</div>
                    <div className="text-[11px] text-slate-500">
                      Simulate a new device/IP login on an existing monitored handle
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {mode === 'new_account_id' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label htmlFor="new-handle" className="block text-xs font-medium text-slate-700 mb-1">
                    New Account Handle
                  </label>
                  <input
                    id="new-handle"
                    type="text"
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  />
                </div>
                <div>
                  <label htmlFor="new-name" className="block text-xs font-medium text-slate-700 mb-1">
                    Display Name (Synthetic)
                  </label>
                  <input
                    id="new-name"
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  />
                </div>
                <div>
                  <label htmlFor="trusted-dev" className="block text-xs font-medium text-slate-700 mb-1">
                    Owner’s Baseline Device ID
                  </label>
                  <input
                    id="trusted-dev"
                    type="text"
                    value={trustedDeviceId}
                    onChange={(e) => setTrustedDeviceId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  />
                </div>
                <div>
                  <label htmlFor="home-loc" className="block text-xs font-medium text-slate-700 mb-1">
                    Owner’s Home Location
                  </label>
                  <input
                    id="home-loc"
                    type="text"
                    value={homeLocation}
                    onChange={(e) => setHomeLocation(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  />
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200">
                <label htmlFor="existing-acc" className="block text-xs font-medium text-slate-700 mb-1">
                  Target Monitored Account
                </label>
                <select
                  id="existing-acc"
                  value={existingAccountId}
                  onChange={(e) => setExistingAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                >
                  {accounts.map((acc) => (
                    <option key={acc.account_id} value={acc.account_id}>
                      {acc.handle} ({acc.trusted_device_id} · {acc.home_location})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Incoming Login Session Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label htmlFor="login-device" className="block text-xs font-medium text-slate-700 mb-1">
                  Incoming Login Device ID
                </label>
                <input
                  id="login-device"
                  type="text"
                  value={loginDeviceId}
                  onChange={(e) => setLoginDeviceId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                />
              </div>

              <div>
                <label htmlFor="login-location" className="block text-xs font-medium text-slate-700 mb-1">
                  Incoming Login Location
                </label>
                <input
                  id="login-location"
                  type="text"
                  value={loginLocation}
                  onChange={(e) => setLoginLocation(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                />
              </div>

              <div>
                <label htmlFor="login-hour" className="block text-xs font-medium text-slate-700 mb-1">
                  Login Hour (0–23)
                </label>
                <input
                  id="login-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={loginHour}
                  onChange={(e) => setLoginHour(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateAgentBurst}
                  onChange={(e) => setSimulateAgentBurst(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs text-slate-700">
                  <strong className="font-semibold text-slate-900">
                    Simulate automated AI-agent DM burst after login
                  </strong>
                  <span className="block text-slate-500 mt-0.5">
                    Emulates a compromised session where an automated bot sends bulk phishing DMs right after logging in.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Run New ID Login Check</span>
              </button>
            </div>
          </form>
        </section>

        {/* Bilingual Explanation Panel: English & Tanglish + AI Agent Link */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-slate-900">
                AI Agents &amp; New ID Link
              </h3>
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
              {(['both', 'en', 'tanglish'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setExplanationLang(lang)}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    explanationLang === lang
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'both' ? 'Both' : lang === 'en' ? 'English' : 'Tanglish'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-4 text-xs leading-relaxed">
            {(explanationLang === 'both' || explanationLang === 'en') && (
              <div className="space-y-2">
                <div className="font-semibold text-slate-900">
                  English Explanation
                </div>
                <p className="text-slate-600">
                  In real-world influencer hacks, attackers often use <strong>automated AI agents</strong> (LLM-driven bots or headless scripts) that log in using stolen session tokens from an unfamiliar <strong>device ID</strong> and <strong>location</strong> at odd hours (like 3 AM).
                </p>
                <p className="text-slate-600">
                  Once logged in, the AI agent rapidly sends personalized-looking spam/phishing DMs to followers with shortened links. Our <strong>rule-based detector</strong> does not need AI to catch it—it flags the sudden new-ID login mismatch, odd hour, risky link, and bulk similarity to warn both the owner and followers immediately.
                </p>
              </div>
            )}

            {explanationLang === 'both' && (
              <div className="border-t border-slate-200" />
            )}

            {(explanationLang === 'both' || explanationLang === 'tanglish') && (
              <div className="space-y-2">
                <div className="font-semibold text-slate-900">
                  Tanglish Explanation (தமிழ் + English)
                </div>
                <p className="text-slate-600">
                  Real life-la oru influencer account hack aagumbodhu, hackers <strong>automated AI agents</strong> (bot scripts) use panni, pudhu <strong>device_id</strong> matrum vera <strong>location</strong>-la irundhu odd time-la (example: night 3 AM) login pannuvanga.
                </p>
                <p className="text-slate-600">
                  Login aanadhum, andha AI agent followers-ku ore maadhiri phishing DMs + shortened links (bit.ly / .xyz) bulk-aa anuppum. Namma <strong>rule-based detector</strong> indha <strong>New ID Login</strong> mismatch, odd timing, suspicious link, and bulk messages-ah check panni score (0–100) calculate panni Owner &amp; Followers-ku udane alert kudukum.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* New ID Login Audit History */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Simulated Login Events &amp; Findings
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Recent New ID creation and login checks evaluated against account baselines.
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {loginEvents.length} login checks
          </span>
        </div>

        {loginEvents.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500">
            No manual New ID Login simulations run yet. Use the form above to test a Normal or Suspicious login.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6 whitespace-nowrap">Timestamp</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Account</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Process</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Login Device &amp; Location</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Findings</th>
                  <th className="py-2.5 px-6 whitespace-nowrap">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loginEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    className={ev.suspicious ? 'bg-red-50/35' : 'bg-white'}
                  >
                    <td className="py-3 px-6 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectAccount(ev.account_id)}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {ev.handle}
                      </button>
                      <div className="font-mono text-[11px] text-slate-400">{ev.account_id}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {ev.login_mode === 'new_account_id' ? 'New Account ID' : 'Existing ID Login'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-800">{ev.device_id}</div>
                      <div className="text-slate-500">{ev.location}</div>
                    </td>
                    <td className="py-3 px-4">
                      {ev.findings.length > 0 ? (
                        <ul className="space-y-0.5 text-red-700 font-medium">
                          {ev.findings.map((f, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              {ev.status_after_login === 'Flagged' ? (
                                <ShieldAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" aria-hidden="true" />
                              )}
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Matched baseline device, location &amp; hours</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={ev.status_after_login} />
                        <span className="font-mono tabular-nums text-slate-600">
                          ({ev.score_after_login}/100)
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
