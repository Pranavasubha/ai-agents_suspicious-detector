import { FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';

export interface ImportedMessageRow {
  account_id?: string;
  handle?: string;
  follower_id?: string;
  message_text: string;
  link_url?: string | null;
  timestamp?: string;
  device_id?: string;
  location?: string;
}

interface ImportLogsViewProps {
  onImportEntries: (entries: ImportedMessageRow[]) => Promise<{
    importedCount: number;
    alertsCreated: number;
  }>;
}

const SAMPLE_CSV = `handle,follower_id,message_text,link_url,timestamp,device_id,location
@maya.lin.studio,fol_7001,"Hey! Exclusive fan giveaway — claim your $500 reward before tonight:",https://bit.ly/claim-500-now,2026-11-25T03:11:00Z,dev_bot_proxy_99,Bucharest RO
@maya.lin.studio,fol_7002,"Hey! Exclusive fan giveaway — claim your $500 reward before tonight:",https://bit.ly/claim-500-now,2026-11-25T03:11:30Z,dev_bot_proxy_99,Bucharest RO
@maya.lin.studio,fol_7003,"Hi! Exclusive fan giveaway — claim your $500 reward before it expires:",https://creator-bonus.xyz/verify,2026-11-25T03:12:00Z,dev_bot_proxy_99,Bucharest RO
@maya.lin.studio,fol_7004,"Hey! Exclusive fan giveaway — claim your $500 reward before tonight:",https://bit.ly/claim-500-now,2026-11-25T03:12:30Z,dev_bot_proxy_99,Bucharest RO`;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseRawLogInput(raw: string): ImportedMessageRow[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as unknown;
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr
      .filter(
        (item): item is ImportedMessageRow =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ImportedMessageRow).message_text === 'string'
      );
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows: ImportedMessageRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cols[idx] ?? '';
    });
    if (!record.message_text) continue;
    rows.push({
      account_id: record.account_id || undefined,
      handle: record.handle || undefined,
      follower_id: record.follower_id || undefined,
      message_text: record.message_text,
      link_url: record.link_url || null,
      timestamp: record.timestamp || undefined,
      device_id: record.device_id || undefined,
      location: record.location || undefined,
    });
  }
  return rows;
}

export function ImportLogsView({ onImportEntries }: ImportLogsViewProps) {
  const [rawInput, setRawInput] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ImportedMessageRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  function handleParse(text: string) {
    setRawInput(text);
    setParseError(null);
    setResultMsg(null);
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }
    try {
      const rows = parseRawLogInput(text);
      setParsedPreview(rows);
      if (rows.length === 0) {
        setParseError('No valid rows found. Ensure headers include message_text.');
      }
    } catch {
      setParsedPreview([]);
      setParseError('Unable to parse input as valid JSON array or CSV with header row.');
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    handleParse(text);
  }

  async function handleSubmitImport() {
    if (parsedPreview.length === 0) return;
    setImporting(true);
    setParseError(null);
    try {
      const res = await onImportEntries(parsedPreview);
      setResultMsg(
        `Imported ${res.importedCount} log entries into the live database. Generated ${res.alertsCreated} alert${res.alertsCreated === 1 ? '' : 's'}.`
      );
      setRawInput('');
      setParsedPreview([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Import Real Platform Logs (CSV or JSON)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload or paste exported social media DM/activity logs to evaluate them with the detection engine and save to the database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleParse(SAMPLE_CSV)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            Load CSV Example
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 cursor-pointer">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Choose .csv or .json File</span>
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>

            <span className="text-xs text-slate-500 font-mono">
              Required: message_text · Optional: handle, account_id, follower_id, link_url, timestamp, device_id, location
            </span>
          </div>

          <textarea
            rows={7}
            value={rawInput}
            onChange={(e) => handleParse(e.target.value)}
            placeholder="Paste CSV (with header row) or JSON array of message log objects here..."
            aria-label="Paste CSV or JSON logs"
            className="w-full p-3.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          />

          {parseError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {parseError}
            </div>
          )}

          {resultMsg && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {resultMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <FileSpreadsheet className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {parsedPreview.length} valid row{parsedPreview.length === 1 ? '' : 's'} ready to ingest
              </span>
            </div>

            <button
              type="button"
              disabled={parsedPreview.length === 0 || importing}
              onClick={handleSubmitImport}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              {importing ? 'Importing & Scoring...' : 'Import & Run Detection'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
