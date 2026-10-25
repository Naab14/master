import { useState } from 'react';
import { getAccessCode, setAccessCode } from '../access';

/* Shown when the API answers 401: asks for the access code, stores it on this
 * device and reloads so every tool fetches again with it. */
export default function AccessGate() {
  const [hadCode] = useState(() => !!getAccessCode());
  const [code, setCode] = useState('');

  const submit = e => {
    e.preventDefault();
    if (!code.trim()) return;
    setAccessCode(code.trim());
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-3 p-6"
        style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', borderRadius: 'var(--border-radius)', boxShadow: 'var(--shadow-xl)' }}
      >
        <h2 className="text-lg font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>Enter access code</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {hadCode
            ? "That code didn't work — check it and try again."
            : 'This workspace is protected. Enter the access code to open it on this device.'}
        </p>
        <input
          autoFocus
          type="password"
          autoComplete="current-password"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Access code"
          aria-label="Access code"
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <button type="submit" className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: 'var(--accent)' }}>
          Unlock
        </button>
      </form>
    </div>
  );
}
