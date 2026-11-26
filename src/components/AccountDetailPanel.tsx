import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  MessageSquareWarning,
  Send,
  ShieldAlert,
  Trash2,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  FOLLOWER_ALERT_TEXT,
  OWNER_ALERT_TEXT,
  formatHourRange,
} from '../engine/detectionEngine';
import {
  AccountEvaluation,
  AiAccountAnalysis,
  DetectionConfig,
} from '../types/simulation';
import { StatusIndicator, getScoreColorClasses } from './StatusBadge';

interface AccountDetailPanelProps {
  evaluation: AccountEvaluation | null;
  config: DetectionConfig;
  aiAnalysis?: AiAccountAnalysis;
  onInjectHackForAccount: (accountId: string) => void;
  onInjectNormalForAccount: (accountId: string) => void;
  onRunAiAnalysis: (accountId: string) => Promise<void>;
  onDeleteAccount: (accountId: string) => Promise<void>;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AccountDetailPanel({
  evaluation,
  config,
  aiAnalysis,
  onInjectHackForAccount,
  onInjectNormalForAccount,
  onRunAiAnalysis,
  onDeleteAccount,
}: AccountDetailPanelProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!evaluation) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600">
          Add a monitored account or select an account from the table above to inspect its logs, rule breakdown, and AI analysis.
        </p>
      </section>
    );
  }

  const { account, messages, suspicion_score, status, signals, message_flags } = evaluation;
  const scoreColors = getScoreColorClasses(
    suspicion_score,
    config.watchThreshold,
    config.flagThreshold
  );
  const alertsActive = suspicion_score >= config.flagThreshold;
  const sampleFlaggedMessage =
    messages.find((m) => message_flags[m.id]?.reasons.length > 0) || messages[0];

  async function handleAiClick() {
    setAiError(null);
    setAiLoading(true);
    try {
      await onRunAiAnalysis(account.account_id);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to run Gemini AI analysis.'
      );
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <section
      aria-label={`Account forensics for ${account.handle}`}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Account Header & Quick Actions */}
      <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {account.handle}
            </h2>
            <StatusIndicator status={status} showSubLabel />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1.5">
            <span>{account.display_name}</span>
            <span aria-hidden="true">·</span>
            <span>{account.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {account.follower_count.toLocaleString()} followers
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-2">
            <span>
              Baseline hours:{' '}
              <span className="font-mono text-slate-800">
                {formatHourRange(account.normal_hours_start, account.normal_hours_end)}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Trusted device:{' '}
              <span className="font-mono text-slate-800">{account.trusted_device_id}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Home location:{' '}
              <span className="font-mono text-slate-800">{account.home_location}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onInjectNormalForAccount(account.account_id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Test Normal DM</span>
          </button>

          <button
            type="button"
            onClick={() => onInjectHackForAccount(account.account_id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
            <span>Inject Hack Burst</span>
          </button>

          <button
            type="button"
            onClick={() => onDeleteAccount(account.account_id)}
            aria-label={`Remove ${account.handle}`}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-slate-500 hover:text-red-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Suspicion Score Summary & Explainable 4-Rule Breakdown */}
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Detection Engine Feature Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Explainable rule-based score combining four behavioral and message-level signals.
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-slate-500">Suspicion Score</span>
            <span className={`font-mono text-2xl font-semibold tabular-nums ${scoreColors.text}`}>
              {suspicion_score}
            </span>
            <span className="font-mono text-xs text-slate-400">/ 100</span>
          </div>
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${scoreColors.bar}`}
            style={{ width: `${suspicion_score}%` }}
          />
        </div>

        <div className="divide-y divide-slate-200 border-t border-slate-200">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {signal.triggered ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-sm font-medium text-slate-900">{signal.label}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 pl-6 leading-relaxed">
                  {signal.evidence}
                </p>
              </div>

              <div className="pl-6 sm:pl-0 sm:text-right shrink-0">
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    signal.points > 0 ? 'text-red-700' : 'text-slate-500'
                  }`}
                >
                  +{signal.points}
                </span>
                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  {' '}
                  / {signal.max_points} pts
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gemini AI Semantic Phishing & Bot Analysis */}
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                AI Semantic Phishing &amp; Bot Analysis
              </h3>
              <p className="text-xs text-slate-500">
                Evaluates paraphrased social engineering, impersonation, and bot patterns on the server.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={aiLoading}
            onClick={handleAiClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{aiLoading ? 'Analyzing...' : aiAnalysis ? 'Re-run AI Audit' : 'Run AI Audit'}</span>
          </button>
        </div>

        {aiError && (
          <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 mb-3">
            {aiError}
          </div>
        )}

        {aiAnalysis ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-900">
                  Category: {aiAnalysis.phishing_category}
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-700">
                  Bot Likelihood: <strong>{aiAnalysis.automated_bot_likelihood}</strong>
                </span>
              </div>
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                AI Risk: {aiAnalysis.ai_risk_score}/100
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold text-slate-800 mb-1">English Assessment</div>
                <p className="text-slate-600 leading-relaxed">{aiAnalysis.summary_en}</p>
              </div>
              <div>
                <div className="font-semibold text-slate-800 mb-1">Tanglish Assessment</div>
                <p className="text-slate-600 leading-relaxed">{aiAnalysis.summary_tanglish}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-slate-700">
              <strong className="font-semibold text-slate-900">Recommended Action:</strong>{' '}
              {aiAnalysis.recommended_action}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Click “Run AI Audit” to evaluate this account’s message semantics with Gemini AI.
          </p>
        )}
      </div>

      {/* Dual Alert Output */}
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/60">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Alert Output
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Alert threshold: ≥{config.flagThreshold} pts
          </span>
        </div>

        {alertsActive ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 mb-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Owner Alert (Account Holder)</span>
              </div>
              <p className="text-sm font-medium text-slate-900">
                “{OWNER_ALERT_TEXT}”
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Prompting immediate session revocation, password reset, and review of outbound DMs sent from{' '}
                <span className="font-mono text-slate-700">{evaluation.latest_device_id}</span>.
              </p>
            </div>

            <div className="bg-white border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 mb-1.5">
                <MessageSquareWarning className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Follower-Facing Alert (DM Warning Banner)</span>
              </div>
              <p className="text-sm font-medium text-slate-900">
                “{FOLLOWER_ALERT_TEXT}”
              </p>
              {sampleFlaggedMessage && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  Attached to DM for <span className="font-mono">{sampleFlaggedMessage.follower_id}</span>:{' '}
                  <span className="text-slate-700">
                    “{sampleFlaggedMessage.message_text.slice(0, 72)}...”
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3 text-xs text-slate-600">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>
              Current score (<span className="font-mono font-semibold text-slate-900">{suspicion_score}/100</span>) is below the alert threshold ({config.flagThreshold}). No owner or follower warnings have been issued for this account.
            </span>
          </div>
        )}
      </div>

      {/* Message Log Table for Selected Account */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Account Message Log ({messages.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            DM entries inspected by the rule engine for {account.handle}.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="py-2.5 px-5 whitespace-nowrap">Timestamp</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Follower ID</th>
              <th className="py-2.5 px-3">Message Text &amp; Link</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Device &amp; Location</th>
              <th className="py-2.5 px-5 whitespace-nowrap">Triggered Rules</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-5 text-center text-slate-500">
                  No messages logged for this account yet. Send events via the Webhook Ingestion API, Import Logs, or test controls.
                </td>
              </tr>
            ) : (
              messages.map((msg) => {
                const flagInfo = message_flags[msg.id];
                const hasFlags = flagInfo && flagInfo.reasons.length > 0;
                return (
                  <tr
                    key={msg.id}
                    className={hasFlags ? 'bg-red-50/35' : 'bg-white'}
                  >
                    <td className="py-3 px-5 font-mono tabular-nums text-slate-600 whitespace-nowrap align-top">
                      {formatTimestamp(msg.timestamp)}
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap align-top">
                      {msg.follower_id}
                    </td>

                    <td className="py-3 px-3 max-w-md align-top">
                      <p className="text-slate-800 leading-relaxed">{msg.message_text}</p>
                      {msg.link_url ? (
                        <div className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 break-all">
                          <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                          <span
                            className={
                              flagInfo?.has_suspicious_link
                                ? 'text-red-700 font-medium'
                                : 'text-slate-600'
                            }
                          >
                            {msg.link_url}
                          </span>
                        </div>
                      ) : (
                        <span className="mt-1 block text-[11px] text-slate-400">No link attached</span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap align-top">
                      <div
                        className={`font-mono ${
                          flagInfo?.has_new_device_or_location &&
                          msg.device_id !== account.trusted_device_id
                            ? 'text-red-700 font-medium'
                            : 'text-slate-700'
                        }`}
                      >
                        {msg.device_id}
                      </div>
                      <div
                        className={
                          flagInfo?.has_new_device_or_location &&
                          msg.location !== account.home_location
                            ? 'text-red-700 font-medium'
                            : 'text-slate-500'
                        }
                      >
                        {msg.location}
                      </div>
                    </td>

                    <td className="py-3 px-5 align-top">
                      {hasFlags ? (
                        <ul className="space-y-0.5 text-red-700 font-medium">
                          {flagInfo.reasons.map((reason, idx) => (
                            <li key={idx} className="whitespace-nowrap">
                              · {reason}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-emerald-700">No anomaly</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
