import { RotateCcw } from 'lucide-react';
import {
  DEFAULT_DETECTION_CONFIG,
  SUSPICIOUS_KEYWORDS,
  SUSPICIOUS_TLDS,
  URL_SHORTENER_DOMAINS,
} from '../engine/detectionEngine';
import { DetectionConfig } from '../types/simulation';

interface DetectionRulesViewProps {
  config: DetectionConfig;
  onChangeConfig: (next: DetectionConfig) => void;
}

export function DetectionRulesView({
  config,
  onChangeConfig,
}: DetectionRulesViewProps) {
  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Rule-Based Detection Parameters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust thresholds to inspect how the scoring engine classifies accounts into Normal, Watch, and Flagged.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeConfig(DEFAULT_DETECTION_CONFIG)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Restore Defaults</span>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="bulk-min" className="font-medium text-slate-800">
                Bulk Message Count (N)
              </label>
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                ≥ {config.bulkMinMessages} DMs
              </span>
            </div>
            <input
              id="bulk-min"
              type="range"
              min={2}
              max={8}
              step={1}
              value={config.bulkMinMessages}
              onChange={(e) =>
                onChangeConfig({ ...config, bulkMinMessages: Number(e.target.value) })
              }
              className="w-full accent-slate-900"
            />
            <p className="text-xs text-slate-500 mt-1">
              Minimum near-identical messages in a single burst before triggering the 35-point bulk spam signal.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="bulk-window" className="font-medium text-slate-800">
                Time Window
              </label>
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {config.bulkWindowMinutes} minutes
              </span>
            </div>
            <input
              id="bulk-window"
              type="range"
              min={5}
              max={60}
              step={5}
              value={config.bulkWindowMinutes}
              onChange={(e) =>
                onChangeConfig({ ...config, bulkWindowMinutes: Number(e.target.value) })
              }
              className="w-full accent-slate-900"
            />
            <p className="text-xs text-slate-500 mt-1">
              Rolling time window evaluated for rapid automated sending bursts.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="watch-threshold" className="font-medium text-amber-800">
                Watch Status Threshold (Yellow)
              </label>
              <span className="font-mono font-semibold tabular-nums text-amber-700">
                ≥ {config.watchThreshold} pts
              </span>
            </div>
            <input
              id="watch-threshold"
              type="range"
              min={15}
              max={55}
              step={5}
              value={config.watchThreshold}
              onChange={(e) => {
                const nextWatch = Number(e.target.value);
                onChangeConfig({
                  ...config,
                  watchThreshold: nextWatch,
                  flagThreshold: Math.max(nextWatch + 10, config.flagThreshold),
                });
              }}
              className="w-full accent-amber-600"
            />
            <p className="text-xs text-slate-500 mt-1">
              Score at which an account moves from Normal (Green) to Watch (Yellow).
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="flag-threshold" className="font-medium text-red-800">
                Flagged &amp; Alert Threshold (Red)
              </label>
              <span className="font-mono font-semibold tabular-nums text-red-700">
                ≥ {config.flagThreshold} pts
              </span>
            </div>
            <input
              id="flag-threshold"
              type="range"
              min={45}
              max={90}
              step={5}
              value={config.flagThreshold}
              onChange={(e) => {
                const nextFlag = Number(e.target.value);
                onChangeConfig({
                  ...config,
                  flagThreshold: nextFlag,
                  watchThreshold: Math.min(config.watchThreshold, nextFlag - 10),
                });
              }}
              className="w-full accent-red-700"
            />
            <p className="text-xs text-slate-500 mt-1">
              Score at which an account is Flagged (Red) and dual Owner + Follower alerts are generated.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Scoring Matrix &amp; Known Pattern Dictionaries
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent breakdown of how the 0–100 suspicion score is computed.
          </p>
        </div>

        <div className="divide-y divide-slate-200 text-sm">
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-medium text-slate-900">
                1. Bulk Near-Identical Messages
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Token Jaccard similarity ≥ {Math.round(config.similarityThreshold * 100)}% across ≥ {config.bulkMinMessages} messages within {config.bulkWindowMinutes} minutes.
              </div>
            </div>
            <div className="font-mono text-xs font-semibold tabular-nums text-slate-800 shrink-0">
              Max 35 pts
            </div>
          </div>

          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div className="space-y-1.5">
              <div className="font-medium text-slate-900">
                2. Suspicious Link Patterns
              </div>
              <div className="text-xs text-slate-500">
                Shorteners checked: <span className="font-mono text-slate-700">{URL_SHORTENER_DOMAINS.join(', ')}</span>
              </div>
              <div className="text-xs text-slate-500">
                High-risk TLDs: <span className="font-mono text-slate-700">{SUSPICIOUS_TLDS.join(', ')}</span>
              </div>
              <div className="text-xs text-slate-500">
                Lure keywords: <span className="font-mono text-slate-700">{SUSPICIOUS_KEYWORDS.join(', ')}</span>
              </div>
            </div>
            <div className="font-mono text-xs font-semibold tabular-nums text-slate-800 shrink-0">
              Max 25 pts
            </div>
          </div>

          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-medium text-slate-900">
                3. Unusual Activity Hours
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Flags messages sent outside the account’s established active window (e.g., 02:00–04:00 AM bursts).
              </div>
            </div>
            <div className="font-mono text-xs font-semibold tabular-nums text-slate-800 shrink-0">
              Max 20 pts
            </div>
          </div>

          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-medium text-slate-900">
                4. New Device / Location Anomaly
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Awards +10 pts for an unrecognized device_id and +10 pts for an unfamiliar geographic location.
              </div>
            </div>
            <div className="font-mono text-xs font-semibold tabular-nums text-slate-800 shrink-0">
              Max 20 pts
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
