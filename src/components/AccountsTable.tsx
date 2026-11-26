import { ChevronRight, Search } from 'lucide-react';
import { AccountEvaluation, AccountStatus, DetectionConfig } from '../types/simulation';
import { StatusIndicator, getScoreColorClasses } from './StatusBadge';

interface AccountsTableProps {
  evaluations: AccountEvaluation[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  statusFilter: 'All' | AccountStatus;
  onChangeStatusFilter: (filter: 'All' | AccountStatus) => void;
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  config: DetectionConfig;
}

export function AccountsTable({
  evaluations,
  selectedAccountId,
  onSelectAccount,
  statusFilter,
  onChangeStatusFilter,
  searchQuery,
  onChangeSearchQuery,
  config,
}: AccountsTableProps) {
  const filters: Array<'All' | AccountStatus> = ['All', 'Flagged', 'Watch', 'Normal'];

  const filtered = evaluations.filter((ev) => {
    const matchesStatus = statusFilter === 'All' || ev.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      ev.account.handle.toLowerCase().includes(q) ||
      ev.account.display_name.toLowerCase().includes(q) ||
      ev.latest_location.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Monitored Synthetic Accounts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select any account row to inspect its message logs, baseline profile, and signal breakdown.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              placeholder="Search handle or city..."
              aria-label="Search accounts"
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 w-48"
            />
          </div>

          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="group"
            aria-label="Filter accounts by status"
          >
            {filters.map((f) => {
              const active = statusFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChangeStatusFilter(f)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="py-2.5 px-5">Account</th>
              <th className="py-2.5 px-4 text-right">DMs Logged</th>
              <th className="py-2.5 px-4">Latest Device &amp; Location</th>
              <th className="py-2.5 px-4 w-44">Suspicion Score</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 px-5 text-center text-sm text-slate-500">
                  No simulated accounts match the active filter.
                </td>
              </tr>
            ) : (
              filtered.map((ev) => {
                const isSelected = ev.account.account_id === selectedAccountId;
                const scoreColors = getScoreColorClasses(
                  ev.suspicion_score,
                  config.watchThreshold,
                  config.flagThreshold
                );
                return (
                  <tr
                    key={ev.account.account_id}
                    onClick={() => onSelectAccount(ev.account.account_id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-5">
                      <div className="font-medium text-slate-900">{ev.account.handle}</div>
                      <div className="text-xs text-slate-500">
                        <span>{ev.account.display_name}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{ev.account.category}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700">
                      {ev.messages.length}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono text-xs text-slate-700 truncate max-w-[190px]">
                        {ev.latest_device_id}
                      </div>
                      <div className="text-xs text-slate-500">{ev.latest_location}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${scoreColors.bar}`}
                            style={{ width: `${ev.suspicion_score}%` }}
                          />
                        </div>
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums w-10 text-right ${scoreColors.text}`}
                        >
                          {ev.suspicion_score}/100
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <StatusIndicator status={ev.status} />
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAccount(ev.account.account_id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
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
