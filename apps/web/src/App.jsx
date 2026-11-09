import { lazy, Suspense, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useBreakpoint } from './tools/vacation/hooks/useBreakpoint';
import { AUTH_PROBLEM_EVENT, waitForPendingRequests } from './access';
import { loadAuth, googleLoginEnabled, getSession, onSessionChange, signOut } from './auth';
import AccessGate from './shell/AccessGate';
import { SignIn, NoAccess } from './shell/SignIn';
import ThemeSwitcher from './theme/ThemeSwitcher';
import { ToastProvider, useToast } from './ui';
import { I18nProvider, useI18n, LANGUAGES } from './i18n';
import { WorkforceProvider } from './workforce/store';
import { useWorkforce } from './workforce/store-context';
import './workforce/workforce.css';

const Dashboard = lazy(() => import('./dashboard/Dashboard.jsx'));
const VacationTool = lazy(() => import('./tools/vacation/App.jsx'));
const ManageClipTool = lazy(() => import('./tools/manageclip/ManageClipTool.jsx'));
const BoardsTool = lazy(() => import('./tools/boards/BoardsTool.jsx'));
const UiPreview = lazy(() => import('./ui/UiPreview.jsx'));
const ScheduleView = lazy(() => import('./workforce/ScheduleView.jsx'));
const PeopleView = lazy(() => import('./workforce/PeopleView.jsx'));
const AttendanceView = lazy(() => import('./workforce/AttendanceView.jsx'));
const TrainingView = lazy(() => import('./workforce/TrainingView.jsx'));
const SetupView = lazy(() => import('./workforce/SetupView.jsx'));
const AdminView = lazy(() => import('./workforce/AdminView.jsx'));
const SketchView = lazy(() => import('./workforce/SketchView.jsx'));

/* `needs` is the permission that shows the entry; the server enforces the
 * same permissions on the data (backend/access.js). */
const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'schedule', label: 'Schedule', icon: '▤', needs: 'workforce.view', group: 'plan' },
  { id: 'people', label: 'People', icon: '☺', needs: 'workforce.view', group: 'plan' },
  { id: 'attendance', label: 'Attendance', icon: '✓', needs: 'attendance.view', group: 'plan' },
  { id: 'training', label: 'Training', icon: '⚑', needs: 'workforce.view', group: 'plan' },
  { id: 'shifts', label: 'Shift HQ', icon: '▦', needs: 'shifthq.view', group: 'tools' },
  { id: 'vacation', label: 'Vacations', icon: '☀', needs: 'vacations.view', group: 'tools' },
  { id: 'boards', label: 'Boards', icon: '≣', needs: 'boards.view', group: 'tools' },
  { id: 'sketch', label: 'Sketches', icon: '✎', needs: 'sketches.use', group: 'tools' },
  { id: 'setup', label: 'Setup', icon: '⚙', needs: 'workforce.view', group: 'admin' },
  { id: 'admin', label: 'Access', icon: '⚿', role: 'admin', group: 'admin' },
];

function sectionFromHash() {
  const hash = window.location.hash || '';
  // Vacation Planner share links (#share=…) open the planner, which reads the
  // snapshot from the hash itself.
  if (hash.startsWith('#share=')) return 'vacation';
  const id = hash.replace(/^#\/?/, '').split('/')[0];
  // #/ui is the base-controls review page; it isn't in the menu.
  return SECTIONS.some(s => s.id === id) || id === 'ui' ? id : 'dashboard';
}

function navigate(id) {
  window.location.hash = `#/${id}`;
}

/* Sign-in state: 'loading' until /api/config answers, then 'signedOut',
 * 'denied' (signed in, not on the allowed list), 'ready' or 'signingOut'. Without Google
 * login the app is 'ready' straight away, and a 401 means the access code. */
export default function App() {
  return <I18nProvider><AppInner /></I18nProvider>;
}

function AppInner() {
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
    <ToastProvider>
      <PlanningData>
        <Workspace
          email={auth.email}
          onSignOut={handleSignOut}
          needCode={needCode}
        />
      </PlanningData>
    </ToastProvider>
  );
}

/* Loads the planning data and turns what happens to it into short messages. */
function PlanningData({ children }) {
  const toast = useToast();
  const { t } = useI18n();
  const notify = (kind, detail, api) => {
    if (kind === 'done') toast(detail, api?.undo ? { action: { label: t('Undo'), onClick: api.undo } } : undefined);
    else if (kind === 'undone') toast(t('Undone: {what}', { what: detail || t('last change') }));
    else if (kind === 'redone') toast(t('Redone: {what}', { what: detail || t('last change') }));
    else if (kind === 'conflict') toast(t('Someone else changed this just now. Their version is shown; nothing was overwritten.'));
    else if (kind === 'undoConflict') toast(t('Can’t undo: someone else has changed this since. Nothing was overwritten.'));
    else if (kind === 'forbidden') toast(t('You don’t have permission to do that.'));
    else if (kind === 'offline') toast(t('Offline. Editing is paused until the connection is back.'));
    else if (kind === 'error') toast(t('That could not be saved: {why}', { why: detail }));
  };
  return <WorkforceProvider notify={notify}>{children}</WorkforceProvider>;
}

function OfflineBanner() {
  const { t, fmt } = useI18n();
  const wf = useWorkforce();
  if (!wf?.offline || wf.phase !== 'ready') return null;
  return (
    <div className="wf-banner no-print" role="status">
      <span aria-hidden="true">⚠</span>
      {t('Offline — showing saved information')}
      {wf.syncedAt && <span className="font-normal">· {t('last updated {when}', { when: fmt.stamp(wf.syncedAt) })}</span>}
      <span className="font-normal">· {t('editing is paused')}</span>
      <button type="button" className="ml-auto underline" onClick={() => wf.reload({ quiet: true })}>{t('Try again')}</button>
    </div>
  );
}

function Workspace({ email, onSignOut, needCode }) {
  const [section, setSection] = useState(sectionFromHash);
  const { isMobile } = useBreakpoint();
  const { t, lang, setLang } = useI18n();
  const wf = useWorkforce();
  const me = wf?.me;
  // Until we know who is signed in (or when offline without it), show the
  // existing tools as before.
  const visible = SECTIONS.filter(s => {
    if (!me) return !s.needs && !s.role;
    if (me.role === 'guest') return s.id === 'sketch'; // outside guests: shared boards only
    if (s.role) return me.role === s.role;
    return !s.needs || me.permissions.includes(s.needs) || (s.id === 'schedule' && me.permissions.includes('self.view'));
  });

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const tools = (
    <>
      <button
        type="button"
        className={isMobile ? 'shell-tab' : 'ui-focus rounded-control px-2 py-1.5 text-left text-xs font-bold opacity-80 hover:opacity-100'}
        style={isMobile ? undefined : { background: 'rgba(127,127,127,0.14)' }}
        onClick={() => setLang(lang === 'sv' ? 'en' : 'sv')}
        aria-label={t('Language: {name}. Switch language', { name: LANGUAGES.find(l => l.id === lang).label })}
        title={t('Switch language')}
      >
        {isMobile ? <><span aria-hidden>文</span><span>{lang.toUpperCase()}</span></> : `${LANGUAGES.find(l => l.id === lang).label} ⇄`}
      </button>
      {email && (
        <>
          {!isMobile && <span className="truncate text-[11px] opacity-60" title={email}>{email}</span>}
          <button
            type="button"
            onClick={onSignOut}
            className={isMobile ? 'shell-tab' : 'ui-focus rounded-lg px-2 py-1.5 text-left text-xs font-bold opacity-70 hover:opacity-100'}
            style={isMobile ? undefined : { background: 'rgba(127,127,127,0.14)' }}
            title={t('Sign out')}
          >
            {isMobile ? <><span aria-hidden>⎋</span><span>{t('Sign out')}</span></> : t('Sign out')}
          </button>
        </>
      )}
      <ThemeSwitcher compact={isMobile} />
    </>
  );

  return (
    <div
      className={`flex h-screen overflow-hidden ${isMobile ? 'flex-col-reverse' : ''}`}
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', height: '100dvh' }}
    >
      {/* ── Navigation: a side rail on wide screens, bottom tabs on phones ── */}
      {isMobile ? (
        <nav className="shell-tabs no-print shrink-0" style={{ background: 'var(--topbar-bg)', color: 'var(--topbar-text)' }} aria-label={t('Main navigation')}>
          {visible.map(s => (
            <button key={s.id} type="button" className="shell-tab" onClick={() => navigate(s.id)} aria-current={section === s.id ? 'page' : undefined}>
              <span aria-hidden>{s.icon}</span><span>{t(s.label)}</span>
            </button>
          ))}
          {tools}
        </nav>
      ) : (
        <nav className="no-print flex w-48 shrink-0 flex-col" style={{ background: 'var(--topbar-bg)', color: 'var(--topbar-text)' }} aria-label={t('Main navigation')}>
          <div className="flex items-center gap-2 px-4 py-5 text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black" style={{ background: 'var(--accent)', color: '#fff' }}>M</span>
            <span>Master</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(s.id)}
                className={`ui-focus flex w-full items-center gap-3 px-4 py-2 text-left transition-opacity ${section === s.id ? 'opacity-100' : 'opacity-75 hover:opacity-100'} ${i > 0 && visible[i - 1].group !== s.group ? 'mt-3' : ''}`}
                style={section === s.id ? { background: 'var(--surface-soft)', boxShadow: 'inset 3px 0 0 var(--accent)' } : undefined}
                aria-current={section === s.id ? 'page' : undefined}
              >
                <span className="w-5 text-center text-lg leading-none" aria-hidden>{s.icon}</span>
                <span className="text-sm font-bold">{t(s.label)}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 px-4 pb-4 pt-2">{tools}</div>
        </nav>
      )}

      {/* ── Active section ──────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <OfflineBanner />
        <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('Loading…')}
            </div>
          }
        >
          {me?.role === 'guest' && section !== 'sketch' && <SketchView />}
          {section === 'sketch' && <SketchView />}
          {section === 'dashboard' && me?.role !== 'guest' && <Dashboard onNavigate={navigate} />}
          {section === 'shifts' && <ManageClipTool />}
          {section === 'vacation' && <VacationTool />}
          {section === 'boards' && <BoardsTool />}
          {section === 'ui' && <UiPreview />}
          {section === 'schedule' && <ScheduleView />}
          {section === 'people' && <PeopleView />}
          {section === 'attendance' && <AttendanceView />}
          {section === 'training' && <TrainingView />}
          {section === 'setup' && <SetupView />}
          {section === 'admin' && <AdminView />}
        </Suspense>
        </div>
      </main>
      {needCode && <AccessGate />}
    </div>
  );
}
