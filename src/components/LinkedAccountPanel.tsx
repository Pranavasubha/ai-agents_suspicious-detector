import { Link2, Lock, Plus } from 'lucide-react';
import { useState } from 'react';

export interface LinkedAccountInput {
  platform: string;
  handle: string;
  display_name: string;
  category: string;
  follower_count: number;
  normal_hours_start: number;
  normal_hours_end: number;
  trusted_device_id: string;
  home_location: string;
}

interface LinkedAccountPanelProps {
  isAdminUnlocked: boolean;
  onAddLinkedAccount: (payload: LinkedAccountInput) => Promise<void>;
  onOpenAdminModal: () => void;
}

const PLATFORMS = ['Instagram', 'X (Twitter)', 'YouTube', 'TikTok', 'LinkedIn'];

export function LinkedAccountPanel({
  isAdminUnlocked,
  onAddLinkedAccount,
  onOpenAdminModal,
}: LinkedAccountPanelProps) {
  const [platform, setPlatform] = useState('Instagram');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [trustedDevice, setTrustedDevice] = useState('dev_iphone16_owner');
  const [homeLocation, setHomeLocation] = useState('Chennai, IN');
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(22);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!handle.trim()) {
      setError('Please enter a social media handle.');
      return;
    }
    setSaving(true);
    try {
      await onAddLinkedAccount({
        platform,
        handle: handle.trim(),
        display_name: displayName.trim() || handle.trim().replace(/^@/, ''),
        category: `${platform} Creator`,
        follower_count: 50000,
        normal_hours_start: startHour,
        normal_hours_end: endHour,
        trusted_device_id: trustedDevice.trim() || 'dev_trusted_01',
        home_location: homeLocation.trim() || 'Chennai, IN',
      });
      setHandle('');
      setDisplayName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to link account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Add linked social account"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link2 className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Link &amp; Add Social Media Account
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect a handle with its trusted device, home location, and normal active hours to begin monitoring.
            </p>
          </div>
        </div>

        {!isAdminUnlocked && (
          <button
            type="button"
            onClick={onOpenAdminModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Unlock Admin to Save to Server</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div>
            <label htmlFor="link-platform" className="block text-xs font-medium text-slate-700 mb-1">
              Platform
            </label>
            <select
              id="link-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="link-handle" className="block text-xs font-medium text-slate-700 mb-1">
              Account Handle
            </label>
            <input
              id="link-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@creator.handle"
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
          </div>

          <div>
            <label htmlFor="link-name" className="block text-xs font-medium text-slate-700 mb-1">
              Owner Name
            </label>
            <input
              id="link-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
          </div>

          <div>
            <label htmlFor="link-device" className="block text-xs font-medium text-slate-700 mb-1">
              Trusted Device ID
            </label>
            <input
              id="link-device"
              type="text"
              value={trustedDevice}
              onChange={(e) => setTrustedDevice(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
          </div>

          <div>
            <label htmlFor="link-location" className="block text-xs font-medium text-slate-700 mb-1">
              Home Location
            </label>
            <input
              id="link-location"
              type="text"
              value={homeLocation}
              onChange={(e) => setHomeLocation(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{saving ? 'Linking...' : 'Link Account'}</span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <label htmlFor="link-start" className="text-slate-600">
              Normal Hours:
            </label>
            <input
              id="link-start"
              type="number"
              min={0}
              max={23}
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-14 px-2 py-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded text-slate-900"
            />
            <span>to</span>
            <input
              id="link-end"
              type="number"
              min={0}
              max={23}
              aria-label="Normal active end hour"
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="w-14 px-2 py-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded text-slate-900"
            />
          </div>

          <span className="text-slate-400">
            {isAdminUnlocked
              ? 'Linked accounts save directly to server persistence.'
              : 'Added immediately to live workspace; unlock Admin Mode to persist to server.'}
          </span>
        </div>

        {error && (
          <div role="alert" className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </form>
    </section>
  );
}
