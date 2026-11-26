import { Lock, ShieldCheck, Zap } from 'lucide-react';
import { NavSection } from '../types/simulation';

interface TopBarProps {
  activeSection: NavSection;
  isAdminUnlocked: boolean;
  onOpenAdminModal: () => void;
  onSimulateHack: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Linked Accounts & Overview',
  login: 'New ID Login & Findings',
  integrations: 'Integrations & Live Webhooks',
  import: 'Import Real Logs',
  logs: 'Message Logs',
  alerts: 'Alert History',
  rules: 'Detection Rules & Thresholds',
};

export function TopBar({
  activeSection,
  isAdminUnlocked,
  onOpenAdminModal,
  onSimulateHack,
}: TopBarProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Security Console</span>
          <span aria-hidden="true">/</span>
          <span className="text-slate-800 font-medium">{SECTION_TITLES[activeSection]}</span>
        </div>
        <h1 className="font-display text-lg font-semibold text-slate-900 mt-0.5 truncate">
          Suspicious Activity Detector for Social Media Accounts
        </h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenAdminModal}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
            isAdminUnlocked
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {isAdminUnlocked ? (
            <ShieldCheck className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          ) : (
            <Lock className="w-4 h-4 text-slate-500" aria-hidden="true" />
          )}
          <span>{isAdminUnlocked ? 'Admin Unlocked' : 'Admin Passcode'}</span>
        </button>

        <button
          type="button"
          onClick={onSimulateHack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          <Zap className="w-4 h-4" aria-hidden="true" />
          <span>Simulate Hack Event</span>
        </button>
      </div>
    </header>
  );
}
