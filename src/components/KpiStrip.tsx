import { AccountEvaluation, AlertRecord } from '../types/simulation';

interface KpiStripProps {
  evaluations: AccountEvaluation[];
  alerts: AlertRecord[];
  totalMessages: number;
}

export function KpiStrip({ evaluations, alerts, totalMessages }: KpiStripProps) {
  const normalCount = evaluations.filter((e) => e.status === 'Normal').length;
  const watchCount = evaluations.filter((e) => e.status === 'Watch').length;
  const flaggedCount = evaluations.filter((e) => e.status === 'Flagged').length;

  const metrics = [
    {
      label: 'Simulated Accounts',
      value: evaluations.length,
      sub: `${totalMessages} synthetic DMs logged`,
      accent: 'text-slate-900',
    },
    {
      label: 'Normal Status',
      value: normalCount,
      sub: 'Within baseline behavior',
      accent: 'text-emerald-700',
    },
    {
      label: 'Watch Status',
      value: watchCount,
      sub: 'Moderate anomaly signals',
      accent: 'text-amber-700',
    },
    {
      label: 'Flagged & Alerted',
      value: flaggedCount,
      sub: `${alerts.length} dual alert${alerts.length === 1 ? '' : 's'} triggered`,
      accent: flaggedCount > 0 ? 'text-red-700' : 'text-slate-900',
    },
  ];

  return (
    <section
      aria-label="Simulation summary metrics"
      className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
    >
      {metrics.map((m) => (
        <div key={m.label} className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">{m.label}</div>
          <div className={`font-mono text-2xl font-semibold tabular-nums mt-1 ${m.accent}`}>
            {m.value}
          </div>
          <div className="text-xs text-slate-500 mt-1">{m.sub}</div>
        </div>
      ))}
    </section>
  );
}
