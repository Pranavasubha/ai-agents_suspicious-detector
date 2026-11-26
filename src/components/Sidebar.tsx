import {
  Activity,
  Bell,
  FileText,
  Info,
  LogIn,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { NavSection } from '../types/simulation';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  flaggedCount: number;
  alertCount: number;
  messageCount: number;
  loginCount: number;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  flaggedCount,
  alertCount,
  messageCount,
  loginCount,
}: SidebarProps) {
  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: typeof Activity;
    count?: number;
    highlightCount?: boolean;
  }> = [
    {
      id: 'overview',
      label: 'Accounts Overview',
      icon: Activity,
      count: flaggedCount > 0 ? flaggedCount : undefined,
      highlightCount: flaggedCount > 0,
    },
    {
      id: 'login',
      label: 'New ID Login',
      icon: LogIn,
      count: loginCount > 0 ? loginCount : undefined,
    },
    {
      id: 'logs',
      label: 'Message Logs',
      icon: FileText,
      count: messageCount,
    },
    {
      id: 'alerts',
      label: 'Alert History',
      icon: Bell,
      count: alertCount,
      highlightCount: alertCount > 0,
    },
    {
      id: 'rules',
      label: 'Detection Rules',
      icon: SlidersHorizontal,
    },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
      <div>
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold text-slate-900 leading-tight truncate">
              Activity Detector
            </div>
            <div className="text-xs text-slate-500 truncate">
              Security Awareness Demo
            </div>
          </div>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 lg:w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-slate-900' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      item.highlightCount ? 'text-red-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden lg:block p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <p className="font-medium text-slate-800 mb-1">
              Synthetic Simulation Only
            </p>
            <p>
              All influencer handles, follower IDs, device IDs, and message logs are
              generated locally. No live social platforms or real accounts are connected.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
