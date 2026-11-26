import { LogIn, RotateCcw, Send, Zap } from 'lucide-react';
import { AccountEvaluation } from '../types/simulation';

interface DemoSectionProps {
  evaluations: AccountEvaluation[];
  selectedAccountId: string | null;
  onSimulateRandomHack: () => void;
  onSimulateHackOnSelected: (accountId: string) => void;
  onSendNormalOnSelected: (accountId: string) => void;
  onOpenNewIdLogin: () => void;
  onResetSampleDemo: () => void;
}

export function DemoSection({
  evaluations,
  selectedAccountId,
  onSimulateRandomHack,
  onSimulateHackOnSelected,
  onSendNormalOnSelected,
  onOpenNewIdLogin,
  onResetSampleDemo,
}: DemoSectionProps) {
  const target =
    evaluations.find((e) => e.account.account_id === selectedAccountId) ??
    evaluations[0] ??
    null;

  return (
    <section
      aria-label="Interactive security awareness demo"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Interactive Demo Section
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Test compromise scenarios, new-ID login anomalies, and dual owner/follower alerts safely with synthetic events.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetSampleDemo}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Reset Demo Dataset</span>
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-900">
              01. Simulate Bulk Phishing Hack
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Injects 5–6 near-identical DMs with shortened/risky URLs at 3 AM from an unrecognized device to trigger Flagged alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSimulateRandomHack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-medium whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Random Account Hack</span>
            </button>

            {target && (
              <button
                type="button"
                onClick={() => onSimulateHackOnSelected(target.account.account_id)}
                className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-medium truncate max-w-[170px]"
              >
                Hack {target.account.handle}
              </button>
            )}
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-900">
              02. New ID Login &amp; AI Agent Check
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Create a fresh synthetic ID or test logging in from an unfamiliar city and device with English &amp; Tanglish AI-agent explanations.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={onOpenNewIdLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Open New ID Login Demo</span>
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-900">
              03. Send Normal Baseline DM
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Logs a normal creator reply from the trusted device, home city, and active hours to contrast Normal (Green) vs Flagged (Red).
            </p>
          </div>

          <div>
            <button
              type="button"
              disabled={!target}
              onClick={() => target && onSendNormalOnSelected(target.account.account_id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-800 text-xs font-medium whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>
                {target ? `Normal DM (${target.account.handle})` : 'Add an account first'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
