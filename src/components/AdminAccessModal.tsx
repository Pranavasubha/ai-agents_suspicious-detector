import { CheckCircle2, KeyRound, Lock, LogOut, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AdminAccessModalProps {
  open: boolean;
  isUnlocked: boolean;
  onClose: () => void;
  onAuthenticated: (token: string) => void;
  onLock: () => void;
}

export function AdminAccessModal({
  open,
  isUnlocked,
  onClose,
  onAuthenticated,
  onLock,
}: AdminAccessModalProps) {
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [envPasscodeActive, setEnvPasscodeActive] = useState(false);

  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChecking(true);
    setError(null);
    setPasscode('');
    setConfirmPasscode('');

    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data: { configured?: boolean; envPasscodeActive?: boolean }) => {
        if (!cancelled) {
          setConfigured(Boolean(data.configured));
          setEnvPasscodeActive(Boolean(data.envPasscodeActive));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to check server authentication status.');
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!configured && passcode !== confirmPasscode) {
      setError('Passcodes do not match.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = configured ? '/api/auth/login' : '/api/auth/claim';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json()) as { token?: string; error?: string };

      if (res.status === 409) {
        // Server already configured while modal was open: switch smoothly to sign-in mode
        setConfigured(true);
        setError('Admin passcode is already set on the server. Please enter your existing passcode to unlock.');
        return;
      }

      if (!res.ok || !data.token) {
        setError(data.error || 'Authentication failed.');
        return;
      }

      onAuthenticated(data.token);
      onClose();
    } catch {
      setError('Unable to reach backend server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-slate-800" aria-hidden="true" />
            <h2 id="admin-modal-title" className="font-display text-base font-semibold text-slate-900">
              Admin Passcode &amp; Full Access
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin modal"
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {isUnlocked ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="font-semibold">Admin Mode Active</div>
                  <p className="mt-0.5 opacity-90">
                    Server persistence, live webhook ingestion keys, Slack/Discord alert webhooks, CSV/JSON import, and Gemini AI semantic audits are unlocked.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onLock();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Lock Admin Session</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          ) : checking ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Checking admin passcode status...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
                {configured ? (
                  <span>
                    {envPasscodeActive
                      ? 'Enter your configured ADMIN_PASSCODE secret to unlock full server persistence, webhook keys, and AI audits.'
                      : 'Admin passcode is already configured on the server. Enter your passcode to unlock full server persistence, webhook keys, and AI audits.'}
                  </span>
                ) : (
                  <span>
                    First-time admin setup: choose an admin passcode (minimum 6 characters) to protect webhook API keys, persistent writes, and AI audits.
                  </span>
                )}
              </div>

              <div>
                <label htmlFor="modal-passcode" className="block text-xs font-medium text-slate-700 mb-1">
                  {configured ? 'Admin Passcode' : 'Choose Admin Passcode'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  <input
                    id="modal-passcode"
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    minLength={6}
                    required
                    autoFocus
                    placeholder="Enter passcode"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  />
                </div>
              </div>

              {!configured && (
                <div>
                  <label htmlFor="modal-passcode-confirm" className="block text-xs font-medium text-slate-700 mb-1">
                    Confirm Admin Passcode
                  </label>
                  <input
                    id="modal-passcode-confirm"
                    type="password"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    minLength={6}
                    required
                    placeholder="Re-enter passcode"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  />
                </div>
              )}

              {error && (
                <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {loading
                      ? 'Verifying...'
                      : configured
                        ? 'Unlock Admin Mode'
                        : 'Set & Unlock Admin'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
