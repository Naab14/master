import { lazy, Suspense, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useBreakpoint } from './tools/vacation/hooks/useBreakpoint';
import { AUTH_PROBLEM_EVENT, waitForPendingRequests } from './access';
import { loadAuth, googleLoginEnabled, getSession, onSessionChange, signOut } from './auth';
import AccessGate from './shell/AccessGate';
import { SignIn, NoAccess } from './shell/SignIn';

const Dashboard = lazy(() => import('./dashboard/Dashboard.jsx'));
const VacationTool = lazy(() => import('./tools/vacation/App.jsx'));
const ManageClipTool = lazy(() => import('./tools/manageclip/ManageClipTool.jsx'));
const BoardsTool = lazy(() => import('./tools/boards/BoardsTool.jsx'));

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'shifts', label: 'Shift HQ', icon: '▦' },
  { id: 'vacation', label: 'Vacations', icon: '☀' },
  { id: 'boards', label: 'Boards', icon: '≣' },
];

function sectionFromHash() {
  const hash = window.location.hash || '';
  // Vacation Planner share links (#share=…) open the planner, which reads the
  // snapshot from the hash itself.
  if (hash.startsWith('#share=')) return 'vacation';
  const id = hash.replace(/^#\/?/, '');
  return SECTIONS.some(s => s.id === id) ? id : 'dashboard';
}

function navigate(id) {
  window.location.hash = `#/${id}`;
}

/* Sign-in state: 'loading' until /api/config answers, then 'signedOut',
 * 'denied' (signed in, not on the allowed list), 'ready' or 'signingOut'. Without Google
 * login the app is 'ready' straight away, and a 401 means the access code. */
export default function App() {
  const [auth, setAuth] = useState({ phase: 'loading' });
  const [needCode, setNeedCode] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};
    loadAuth().then(async () => {
      if (!googleLoginEnabled()) return setAuth({ phase: 'ready' });
      const session = await getSession();
      setAuth(session ? { phase: 'ready', email: session.user?.email } : { phase: 'signedOut' });
      unsubscribe = onSessionChange(s =>
        setAuth(prev => (s
          ? (prev.phase === 'denied' ? prev : { phase: 'ready', email: s.user?.email })
          : { phase: 'signedOut' })));
    });
    return () => unsubscribe();
  }, []);

  // The API turned a request down: sign in again, explain, or ask for the code.
  useEffect(() => {
    const onProblem = e => {
      const { status, error } = e.detail || {};
      if (!googleLoginEnabled()) { if (status === 401) setNeedCode(true); return; }
      setAuth(status === 403 ? { phase: 'denied', message: error } : { phase: 'signedOut' });
    };
    window.addEventListener(AUTH_PROBLEM_EVENT, onProblem);
    return () => window.removeEventListener(AUTH_PROBLEM_EVENT, onProblem);
  }, []);

  // Sign out in an order that loses nothing and leaves nothing behind: close
  // the workspace first (its tools flush pending saves while the session is
  // still valid), let those requests finish, then clear the browser's cached
  // data and the session.
  const handleSignOut = async () => {
    flushSync(() => setAuth({ phase: 'signingOut' }));
    await new Promise(r => setTimeout(r, 0));
    await waitForPendingRequests();
    await signOut();
    setAuth({ phase: 'signedOut' });
  };

  if (auth.phase === 'loading' || auth.phase === 'signingOut') {
    return <div className="h-screen" style={{ background: 'var(--topbar-bg)' }} aria-busy="true" />;
  }
  if (auth.phase === 'signedOut') return <SignIn />;
  if (auth.phase === 'denied') return <NoAccess message={auth.message} />;
  return (
    <Workspace
      email={auth.email}
      onSignOut={handleSignOut}
      needCode={needCode}
    />
  );
}

function Workspace({ email, onSignOut, needCode }) {
  const [section, setSection] = useState(sectionFromHash);
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const rail = isMobile;
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
    >
      {/* ── Navigation rail ─────────────────────────────────────────────── */}
      <nav
        className={`flex flex-col shrink-0 ${rail ? 'w-14' : 'w-48'}`}
        style={{ background: 'var(--topbar-bg)', color: 'var(--topbar-text)' }}
        aria-label="Main navigation"
      >
        <div
          className={`flex items-center gap-2 font-black tracking-tight ${rail ? 'justify-center py-4 text-lg' : 'px-4 py-5 text-xl'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            M
          </span>
          {!rail && <span>Master</span>}
        </div>

        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => navigate(s.id)}
            className={`flex items-center gap-3 text-left transition-opacity ${rail ? 'justify-center py-3' : 'px-4 py-3'} ${section === s.id ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}
            style={section === s.id ? { background: 'rgba(255,255,255,0.12)', boxShadow: 'inset 3px 0 0 var(--accent)' } : undefined}
            title={s.label}
            aria-current={section === s.id ? 'page' : undefined}
          >
            <span className="text-lg leading-none" aria-hidden>{s.icon}</span>
            {!rail && <span className="text-sm font-bold">{s.label}</span>}
          </button>
        ))}

        <div className={`mt-auto flex flex-col gap-2 pb-4 ${rail ? 'items-center' : 'px-4'}`}>
          {email && (
            <>
              {!rail && <span className="truncate text-[11px] opacity-60" title={email}>{email}</span>}
              <button
                onClick={onSignOut}
                className={`rounded-lg text-xs font-bold opacity-70 hover:opacity-100 ${rail ? 'px-1 py-1' : 'px-2 py-1.5 text-left'}`}
                style={{ background: 'rgba(255,255,255,0.08)' }}
                title="Sign out"
              >
                {rail ? '⎋' : 'Sign out'}
              </button>
            </>
          )}
          {!rail && <span className="text-[10px] opacity-40">shifts · vacations · boards</span>}
        </div>
      </nav>

      {/* ── Active section ──────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              Loading…
            </div>
          }
        >
          {section === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {section === 'shifts' && <ManageClipTool />}
          {section === 'vacation' && <VacationTool />}
          {section === 'boards' && <BoardsTool />}
        </Suspense>
      </main>
      {needCode && <AccessGate />}
    </div>
  );
}
