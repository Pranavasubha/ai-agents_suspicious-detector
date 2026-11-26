import { ExternalLink, Search } from 'lucide-react';
import { useState } from 'react';
import { AccountEvaluation } from '../types/simulation';

interface MessageLogsViewProps {
  evaluations: AccountEvaluation[];
  onSelectAccount: (accountId: string) => void;
}

export function MessageLogsView({ evaluations, onSelectAccount }: MessageLogsViewProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'suspicious' | 'normal'>('all');
  const [search, setSearch] = useState('');

  const allEntries = evaluations
    .flatMap((ev) =>
      ev.messages.map((msg) => ({
        msg,
        account: ev.account,
        flagInfo: ev.message_flags[msg.id],
      }))
    )
    .sort(
      (a, b) =>
        new Date(b.msg.timestamp).getTime() - new Date(a.msg.timestamp).getTime()
    );

  const filtered = allEntries.filter(({ msg, account, flagInfo }) => {
    const isSuspicious = (flagInfo?.reasons.length ?? 0) > 0;
    if (filterMode === 'suspicious' && !isSuspicious) return false;
    if (filterMode === 'normal' && isSuspicious) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      account.handle.toLowerCase().includes(q) ||
      msg.account_id.toLowerCase().includes(q) ||
      msg.follower_id.toLowerCase().includes(q) ||
      msg.message_text.toLowerCase().includes(q) ||
      (msg.link_url ?? '').toLowerCase().includes(q) ||
      msg.device_id.toLowerCase().includes(q) ||
      msg.location.toLowerCase().includes(q)
    );
  });

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            All Synthetic Message Logs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing account_id, follower_id, message_text, link_url, timestamp, device_id, and location.
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search text, URL, device..."
              aria-label="Search message logs"
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 w-52"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'suspicious', 'normal'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'all' ? 'All Logs' : mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="py-2.5 px-5 whitespace-nowrap">Timestamp</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Account</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Follower ID</th>
              <th className="py-2.5 px-3">Message Text &amp; Link</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Device ID</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Location</th>
              <th className="py-2.5 px-5 whitespace-nowrap">Signal Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 px-5 text-center text-sm text-slate-500">
                  No synthetic message logs match the active search or filter.
                </td>
              </tr>
            ) : (
              filtered.map(({ msg, account, flagInfo }) => {
                const hasFlags = (flagInfo?.reasons.length ?? 0) > 0;
                return (
                  <tr
                    key={msg.id}
                    className={hasFlags ? 'bg-red-50/35' : 'bg-white hover:bg-slate-50/60'}
                  >
                    <td className="py-3 px-5 font-mono tabular-nums text-slate-600 whitespace-nowrap align-top">
                      {new Date(msg.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap align-top">
                      <button
                        type="button"
                        onClick={() => onSelectAccount(account.account_id)}
                        className="font-medium text-slate-900 hover:underline text-left"
                      >
                        {account.handle}
                      </button>
                      <div className="font-mono text-[11px] text-slate-400">{msg.account_id}</div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap align-top">
                      {msg.follower_id}
                    </td>

                    <td className="py-3 px-3 max-w-md align-top">
                      <p className="text-slate-800 leading-relaxed">{msg.message_text}</p>
                      {msg.link_url ? (
                        <div className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] break-all">
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
                        <span className="mt-1 block text-[11px] text-slate-400">null</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap align-top">
                      {msg.device_id}
                    </td>

                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap align-top">
                      {msg.location}
                    </td>

                    <td className="py-3 px-5 align-top">
                      {hasFlags ? (
                        <ul className="space-y-0.5 text-red-700 font-medium">
                          {flagInfo.reasons.map((r, i) => (
                            <li key={i} className="whitespace-nowrap">
                              · {r}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-emerald-700">Normal</span>
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
