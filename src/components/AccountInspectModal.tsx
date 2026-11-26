import { X } from 'lucide-react';
import { useEffect } from 'react';
import {
  AccountEvaluation,
  AiAccountAnalysis,
  DetectionConfig,
} from '../types/simulation';
import { AccountDetailPanel } from './AccountDetailPanel';

interface AccountInspectModalProps {
  evaluation: AccountEvaluation | null;
  open: boolean;
  onClose: () => void;
  config: DetectionConfig;
  aiAnalysis?: AiAccountAnalysis;
  onInjectHackForAccount: (accountId: string) => void;
  onInjectNormalForAccount: (accountId: string) => void;
  onRunAiAnalysis: (accountId: string) => Promise<void>;
  onDeleteAccount: (accountId: string) => Promise<void>;
}

export function AccountInspectModal({
  evaluation,
  open,
  onClose,
  config,
  aiAnalysis,
  onInjectHackForAccount,
  onInjectNormalForAccount,
  onRunAiAnalysis,
  onDeleteAccount,
}: AccountInspectModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !evaluation) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Full account view for ${evaluation.account.handle}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-slate-50 rounded-xl shadow-xl border border-slate-200 overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Full Account Inspector</span>
            <span aria-hidden="true"> · </span>
            <span>Score Breakdown, AI Audit, Alerts &amp; Complete Message Logs</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector modal"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <AccountDetailPanel
            evaluation={evaluation}
            config={config}
            aiAnalysis={aiAnalysis}
            onInjectHackForAccount={onInjectHackForAccount}
            onInjectNormalForAccount={onInjectNormalForAccount}
            onRunAiAnalysis={onRunAiAnalysis}
            onDeleteAccount={async (id) => {
              await onDeleteAccount(id);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
