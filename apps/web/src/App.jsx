import { lazy, Suspense, useEffect, useState } from 'react';
import { useBreakpoint } from './tools/vacation/hooks/useBreakpoint';

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

export default function App() {
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

        <div className={`mt-auto pb-4 text-[10px] opacity-40 ${rail ? 'text-center' : 'px-4'}`}>
          {!rail && 'shifts · vacations · boards'}
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
    </div>
  );
}
