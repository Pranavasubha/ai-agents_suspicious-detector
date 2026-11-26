import { Bell, ChevronRight, Download } from 'lucide-react';
import { AlertRecord } from '../types/simulation';
import { StatusIndicator } from './StatusBadge';

interface AlertHistoryPanelProps {
  alerts: AlertRecord[];
  onSelectAccount: (accountId: string) => void;
  compact?: boolean;
}

function formatAlertTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AlertHistoryPanel({
  alerts,
  onSelectAccount,
  compact = false,
}: AlertHistoryPanelProps) {
  function handleExportJson() {
    const blob = new Blob([JSON.stringify(alerts, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alert-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      aria-label="Alert history"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Alert History
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dual owner and follower alerts generated whenever an account crosses the suspicion threshold.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {alerts.length} recorded
          </span>
          {!compact && alerts.length > 0 && (
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export JSON</span>
            </button>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Bell className="w-5 h-5 text-slate-400 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">No alerts triggered yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Click “Simulate Hack Event” in the top bar to inject a burst of suspicious messages.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {alerts.map((alert) => (
            <div key={alert.id} className="px-5 py-4 hover:bg-slate-50/70 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectAccount(alert.account_id)}
                    className="font-medium text-sm text-slate-900 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{alert.handle}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  </button>
                  <StatusIndicator status={alert.status} />
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono font-semibold tabular-nums text-red-700">
                    Score {alert.score}/100
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {formatAlertTime(alert.timestamp)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-1.5">
                <span className="font-medium text-slate-800">Reason:</span> {alert.reason}
              </p>

              <div
                className={`mt-3 grid gap-3 ${
                  compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
                }`}
              >
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-red-700">Owner Alert</div>
                  <div className="text-xs text-slate-800 mt-0.5">“{alert.owner_alert}”</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-amber-800">
                    Follower-Facing Alert
                  </div>
                  <div className="text-xs text-slate-800 mt-0.5">“{alert.follower_alert}”</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
