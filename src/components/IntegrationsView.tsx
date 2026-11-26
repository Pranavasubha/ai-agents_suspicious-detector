import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react';
import { useState } from 'react';
import { OutboundWebhook, SimulatedAccount } from '../types/simulation';

interface IntegrationsViewProps {
  ingestApiKey: string;
  outboundWebhooks: OutboundWebhook[];
  accounts: SimulatedAccount[];
  onRotateKey: () => Promise<void>;
  onAddWebhook: (name: string, url: string) => Promise<void>;
  onTestWebhook: (id: string) => Promise<void>;
  onDeleteWebhook: (id: string) => Promise<void>;
  onSendLiveTestMessage: (payload: {
    handle: string;
    follower_id: string;
    message_text: string;
    link_url: string;
    device_id: string;
    location: string;
  }) => Promise<string>;
}

export function IntegrationsView({
  ingestApiKey,
  outboundWebhooks,
  accounts,
  onRotateKey,
  onAddWebhook,
  onTestWebhook,
  onDeleteWebhook,
  onSendLiveTestMessage,
}: IntegrationsViewProps) {
  const [showKey, setShowKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [hookName, setHookName] = useState('');
  const [hookUrl, setHookUrl] = useState('');
  const [hookBusy, setHookBusy] = useState(false);
  const [hookError, setHookError] = useState<string | null>(null);

  const [testHandle, setTestHandle] = useState(accounts[0]?.handle ?? '@maya.lin.studio');
  const [testFollower, setTestFollower] = useState('fol_real_9012');
  const [testText, setTestText] = useState(
    'Urgent creator giveaway! Claim your fan reward bonus before midnight:'
  );
  const [testLink, setTestLink] = useState('https://bit.ly/claim-reward-test');
  const [testDevice, setTestDevice] = useState('dev_remote_script_01');
  const [testLocation, setTestLocation] = useState('Warsaw, PL');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-app-url';

  const curlSnippet = `curl -X POST "${origin}/api/v1/ingest/message" \\
  -H "Content-Type: application/json" \\
  -H "x-ingest-key: ${showKey ? ingestApiKey : '<YOUR_INGEST_KEY>'}" \\
  -d '{
    "handle": "${testHandle}",
    "follower_id": "fol_8821",
    "message_text": "Hey! Claim your reward here:",
    "link_url": "https://bit.ly/demo-link",
    "device_id": "dev_iphone_15",
    "location": "Austin, US"
  }'`;

  async function copyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    setHookError(null);
    setHookBusy(true);
    try {
      await onAddWebhook(hookName, hookUrl);
      setHookName('');
      setHookUrl('');
    } catch (err) {
      setHookError(err instanceof Error ? err.message : 'Failed to save webhook.');
    } finally {
      setHookBusy(false);
    }
  }

  async function handleTestIngest(e: React.FormEvent) {
    e.preventDefault();
    setTestSending(true);
    setTestResponse(null);
    try {
      const resultSummary = await onSendLiveTestMessage({
        handle: testHandle,
        follower_id: testFollower,
        message_text: testText,
        link_url: testLink,
        device_id: testDevice,
        location: testLocation,
      });
      setTestResponse(resultSummary);
    } catch (err) {
      setTestResponse(
        err instanceof Error ? `Error: ${err.message}` : 'Failed to ingest event.'
      );
    } finally {
      setTestSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Inbound Webhook Ingestion API */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Live Inbound Webhook Ingestion API
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect Zapier, Make, Meta/X webhook relays, or custom bots to stream real DM &amp; login telemetry into this server.
            </p>
          </div>
          <button
            type="button"
            onClick={onRotateKey}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Rotate Ingestion Key</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">
                Message Ingestion Endpoint
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-800">
                <span className="truncate">POST {origin}/api/v1/ingest/message</span>
                <button
                  type="button"
                  onClick={() => copyText('msg-url', `${origin}/api/v1/ingest/message`)}
                  className="text-slate-500 hover:text-slate-900 shrink-0"
                  aria-label="Copy message endpoint"
                >
                  {copiedId === 'msg-url' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">
                Login Ingestion Endpoint
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-800">
                <span className="truncate">POST {origin}/api/v1/ingest/login</span>
                <button
                  type="button"
                  onClick={() => copyText('lgn-url', `${origin}/api/v1/ingest/login`)}
                  className="text-slate-500 hover:text-slate-900 shrink-0"
                  aria-label="Copy login endpoint"
                >
                  {copiedId === 'lgn-url' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">
              Ingestion API Key (<span className="font-mono">x-ingest-key</span> header)
            </div>
            <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-800">
              <span className="truncate">
                {showKey
                  ? ingestApiKey
                  : `${ingestApiKey.slice(0, 8)}••••••••••••••••••••${ingestApiKey.slice(-4)}`}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="text-slate-500 hover:text-slate-900"
                  aria-label={showKey ? 'Hide key' : 'Reveal key'}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyText('api-key', ingestApiKey)}
                  className="text-slate-500 hover:text-slate-900"
                  aria-label="Copy ingestion key"
                >
                  {copiedId === 'api-key' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600">Example cURL Request</span>
              <button
                type="button"
                onClick={() => copyText('curl', curlSnippet)}
                className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
              >
                {copiedId === 'curl' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy cURL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 text-[11px] font-mono overflow-x-auto leading-relaxed">
              {curlSnippet}
            </pre>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Live Webhook Event Tester */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Live API Event Tester
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dispatch a real HTTP POST to <span className="font-mono">/api/v1/ingest/message</span> and persist it in the database.
            </p>
          </div>

          <form onSubmit={handleTestIngest} className="p-6 space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="live-handle" className="block font-medium text-slate-700 mb-1">
                  Account Handle
                </label>
                <input
                  id="live-handle"
                  type="text"
                  value={testHandle}
                  onChange={(e) => setTestHandle(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="live-follower" className="block font-medium text-slate-700 mb-1">
                  Recipient Follower ID
                </label>
                <input
                  id="live-follower"
                  type="text"
                  value={testFollower}
                  onChange={(e) => setTestFollower(e.target.value)}
                  required
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="live-msg" className="block font-medium text-slate-700 mb-1">
                Message Text
              </label>
              <textarea
                id="live-msg"
                rows={2}
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="live-link" className="block font-medium text-slate-700 mb-1">
                  Link URL
                </label>
                <input
                  id="live-link"
                  type="text"
                  value={testLink}
                  onChange={(e) => setTestLink(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="live-device" className="block font-medium text-slate-700 mb-1">
                  Device ID
                </label>
                <input
                  id="live-device"
                  type="text"
                  value={testDevice}
                  onChange={(e) => setTestDevice(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="live-loc" className="block font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  id="live-loc"
                  type="text"
                  value={testLocation}
                  onChange={(e) => setTestLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="submit"
                disabled={testSending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{testSending ? 'Sending...' : 'POST Live Event'}</span>
              </button>
            </div>

            {testResponse && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-800">
                {testResponse}
              </div>
            )}
          </form>
        </section>

        {/* Outbound Alert Webhooks (Slack / Discord / Custom HTTPS) */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Real Outbound Alert Webhooks
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically dispatch HTTPS alert payloads to Slack, Discord, or your security team whenever an account is Flagged.
            </p>
          </div>

          <form onSubmit={handleCreateWebhook} className="p-6 border-b border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="wh-name" className="block font-medium text-slate-700 mb-1">
                  Label
                </label>
                <input
                  id="wh-name"
                  type="text"
                  value={hookName}
                  onChange={(e) => setHookName(e.target.value)}
                  placeholder="Security Slack"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="wh-url" className="block font-medium text-slate-700 mb-1">
                  Webhook HTTPS URL
                </label>
                <input
                  id="wh-url"
                  type="url"
                  value={hookUrl}
                  onChange={(e) => setHookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  required
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            {hookError && (
              <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {hookError}
              </div>
            )}

            <button
              type="submit"
              disabled={hookBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{hookBusy ? 'Validating...' : 'Register Webhook'}</span>
            </button>
          </form>

          <div className="divide-y divide-slate-200">
            {outboundWebhooks.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <Webhook className="w-4 h-4 text-slate-400 mx-auto mb-1.5" aria-hidden="true" />
                No outbound alert webhooks configured yet.
              </div>
            ) : (
              outboundWebhooks.map((hook) => (
                <div key={hook.id} className="px-6 py-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{hook.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 truncate">
                      {hook.url}
                    </div>
                    {hook.last_status && (
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Last delivery: <span className="font-mono">{hook.last_status}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onTestWebhook(hook.id)}
                      className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteWebhook(hook.id)}
                      aria-label={`Delete ${hook.name}`}
                      className="p-1.5 rounded border border-slate-200 hover:bg-red-50 text-slate-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
