import { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { seedOperators, seedVacationBlocks, buildDefaultDemand, defaultSettings, adoptPlan } from './data';
import {
  saveState, loadState, clearState, keepRejectedState,
  saveUI, loadUI,
  exportJSON, importJSON, debouncedSave,
  buildShareLink, loadStateFromUrl, clearShareHash, copyToClipboard,
  fetchServerState, pushServerState,
  setServerSync, flushSave, discardPendingSave,
} from './storage';
import { parseCSV, mergeOperators, downloadCSVTemplate, downloadOperatorsCSV } from './csv';
import { buildHolidayMap, initHolidays } from './holidays';
import { historyReducer, initHistory } from './historyReducer';
import { useBreakpoint } from './hooks/useBreakpoint';
import { useWorkforce } from '../../workforce/store-context';
import { syncOperatorsWithPeople, linkOperator, linkBlocked, unlinkedOperators } from './sharedPeople';
import { mergeDemandSeries } from './demandSeries';
import { buildPlanningModel, resolveOperators, planningGroups, isoWeekMonday, isoYearOf } from './planningModel';
import { useI18n } from '../../i18n';
import { useToast } from '../../ui';
import { Confirm } from '../../workforce/ui';
import '../tools.css';

import TopBar from './components/TopBar';
import OperatorPanel from './components/OperatorPanel';
import CalendarGrid from './components/calendar/CalendarGrid';

/* ── Utility ──────────────────────────────────────────────────────────────── */
let _uid = 0;
const uid = () => `id_${++_uid}_${Date.now().toString(36)}`;

function getDefaults() {
  const sharedRaw = loadStateFromUrl();
  const shared = adoptPlan(sharedRaw);
  if (sharedRaw) {
    clearShareHash();
    if (shared) return { state: shared, wasShared: true };
  }
  const saved = loadState();
  const usable = adoptPlan(saved);
  // A saved plan that can't be used is set aside, and nothing is saved over it
  // until a valid plan is loaded or the user starts a new one (import, reset).
  const rejected = !!saved && !usable;
  if (rejected) keepRejectedState(saved);
  return {
    rejected,
    state: usable || {
      operators: seedOperators,
      vacationBlocks: seedVacationBlocks,
      demand: buildDefaultDemand(),
      settings: defaultSettings,
    },
    wasShared: false,
  };
}

const storedUI = loadUI();

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  APP                                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function App() {
  const [initResult] = useState(getDefaults);
  const [history, dispatch] = useReducer(historyReducer, initResult.state, initHistory);
  const { present: state, past, future } = history;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const setFn = useCallback(updater => dispatch({ type: 'SET', updater }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const { t } = useI18n();
  const flash = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [autosave, setAutosave] = useState(!initResult.rejected);
  const [adopted, setAdopted] = useState(false); // the saved plan has been loaded from the server
  const [showDemand, setShowDemand] = useState(false);
  const [showOperatorMgmt, setShowOperatorMgmt] = useState(false);
  const [zoom, setZoom] = useState(storedUI.zoom === 'day' ? 'day' : 'week');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!!storedUI.sidebarCollapsed);
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  // Auto-collapse sidebar on tablet/mobile; restore latest persisted preference on desktop
  useEffect(() => {
    if (isMobile || isTablet) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ported as-is from the standalone vacation-planner
      setSidebarCollapsed(true);
    } else if (isDesktop) {
      setSidebarCollapsed(!!loadUI().sidebarCollapsed);
    }
  }, [isMobile, isTablet, isDesktop]);

  const { operators, vacationBlocks, demand, settings } = state;
  const { startWeek, visibleWeeks, shiftMode } = settings;
  const weeks = useMemo(
    () => Array.from({ length: visibleWeeks }, (_, i) => startWeek + i),
    [startWeek, visibleWeeks],
  );

  const [holidayMap, setHolidayMap] = useState(() => buildHolidayMap());

  // Load holidays async (date-holidays is code-split)
  useEffect(() => {
    initHolidays().then(map => setHolidayMap(map));
  }, []);

  // Adopt the server copy of the workspace on mount (Master backend), and only
  // then let saves reach the server. If the server has never stored a
  // workspace, seed it with what we have locally; if it can't be reached, stay
  // local-only. A shared snapshot opened from a link stays local too, so
  // viewing it never overwrites the team's plan.
  const latestState = useRef(state);
  useEffect(() => { latestState.current = state; }, [state]);

  useEffect(() => {
    let cancelled = false;
    if (!initResult.wasShared) {
      fetchServerState().then(({ ok, state: server }) => {
        if (cancelled || !ok) return;
        const usableServer = adoptPlan(server);
        if (usableServer) {
          discardPendingSave();
          dispatch({ type: 'REPLACE', state: usableServer });
          setAutosave(true);
        } else if (server == null) {
          if (initResult.rejected) return; // the local plan was unreadable: don't seed the server with the example
          pushServerState(latestState.current); // a workspace the server has never stored
        } else {
          return; // unreadable server copy: keep what is local and never overwrite it
        }
        setServerSync(true);
        setAdopted(true);
      });
    }
    return () => {
      cancelled = true;
      flushSave();
      setServerSync(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One shared operator identity: once the saved plan is loaded, every People
  // profile has an operator here, linked by id, and names follow the profile.
  const planning = useWorkforce();
  const planningReady = planning?.phase === 'ready' && !planning?.offline;
  const profiles = planning?.wf?.people;
  const canEditPlan = !!planning?.can('vacations.edit');
  const people = useMemo(
    () => (planningReady && profiles ? Object.values(profiles).map(p => ({ id: p.id, name: p.name, endDate: p.endDate })) : null),
    [planningReady, profiles],
  );
  useEffect(() => {
    if (!adopted || !people || initResult.wasShared || !canEditPlan) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = syncOperatorsWithPeople(state.operators, people, today);
    if (next !== state.operators) dispatch({ type: 'SYNC', updater: s => ({ ...s, operators: syncOperatorsWithPeople(s.operators, people, today) }) });
  }, [adopted, people, state.operators, initResult.wasShared, canEditPlan]);
  // Teams and competencies come from planning when it has processes; until
  // then (offline, or a new plant) Vacations keeps its own S1/S2 and processes.
  const [localToday] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const wfDoc = planning?.wf;
  const model = useMemo(() => (planningReady ? buildPlanningModel(wfDoc, localToday) : null), [planningReady, wfDoc, localToday]);
  const gridOperators = useMemo(() => resolveOperators(state.operators, model), [state.operators, model]);
  const planningView = useMemo(() => (model ? {
    processes: model.processes,
    groups: planningGroups(gridOperators, model, t, weeks.map(w => isoWeekMonday(isoYearOf(localToday), w))),
    // Coverage for a week uses the teams on that week's dates, not today's
    opsForWeek: week => resolveOperators(state.operators, model, isoWeekMonday(isoYearOf(localToday), week)),
  } : null), [model, gridOperators, state.operators, localToday, weeks, t]);
  const unlinkedActive = model ? unlinkedOperators(state.operators).filter(o => o.active).length : 0;
  const [pendingLink, setPendingLink] = useState(null);
  const linkOp = useCallback((operatorId, personId) => {
    if (!people) return;
    const blocked = linkBlocked(latestState.current, operatorId, personId);
    if (blocked?.reason === 'overlap') { flash(t('Both have vacation in the same weeks. Move or remove one of them first, then link.')); return; }
    if (blocked) { setPendingLink({ operatorId, personId, name: people.find(p => p.id === personId)?.name || '' }); return; }
    setFn(s => linkOperator(s, operatorId, personId, people));
  }, [people, setFn, flash, t, setPendingLink]);

  // Say so when the page opened from a shared link
  useEffect(() => {
    if (initResult.wasShared) flash(t('Opened a shared copy of the plan'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  // Auto-save core state
  useEffect(() => { if (autosave) debouncedSave(state); }, [state, autosave]);

  // Persist UI preferences (zoom + sidebar)
  useEffect(() => {
    saveUI({ zoom, sidebarCollapsed });
  }, [zoom, sidebarCollapsed]);

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo
  useEffect(() => {
    const handler = e => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);

  /* ── State updaters ─────────────────────────────────────────────────────── */
  const update = useCallback(patch => setFn(s => ({ ...s, ...patch })), [setFn]);
  const updateOp = useCallback((id, patch) =>
    setFn(s => ({ ...s, operators: s.operators.map(o => o.id === id ? { ...o, ...patch } : o) })), [setFn]);
  const addBlock = useCallback((opId, sw, ew, status = 'draft') =>
    setFn(s => ({ ...s, vacationBlocks: [...s.vacationBlocks, { id: uid(), operatorId: opId, startWeek: sw, endWeek: ew, status }] })), [setFn]);
  const updateBlock = useCallback((id, patch) =>
    setFn(s => ({ ...s, vacationBlocks: s.vacationBlocks.map(b => b.id === id ? { ...b, ...patch } : b) })), [setFn]);
  const deleteBlock = useCallback(id =>
    setFn(s => ({ ...s, vacationBlocks: s.vacationBlocks.filter(b => b.id !== id) })), [setFn]);
  const setBlockStatus = useCallback((id, status) =>
    setFn(s => ({ ...s, vacationBlocks: s.vacationBlocks.map(b => b.id === id ? { ...b, status } : b) })), [setFn]);
  const setBlockDayStatus = useCallback((id, dateStr, status) =>
    setFn(s => ({
      ...s,
      vacationBlocks: s.vacationBlocks.map(b =>
        b.id === id
          ? { ...b, dayStatuses: { ...b.dayStatuses, [dateStr]: status } }
          : b
      ),
    })), [setFn]);
  const clearBlockDayStatus = useCallback((id, dateStr) =>
    setFn(s => ({
      ...s,
      vacationBlocks: s.vacationBlocks.map(b => {
        if (b.id !== id) return b;
        const { [dateStr]: _, ...rest } = b.dayStatuses || {};
        return { ...b, dayStatuses: Object.keys(rest).length ? rest : undefined };
      }),
    })), [setFn]);
  const setBlockNote = useCallback((id, note) =>
    setFn(s => ({
      ...s,
      vacationBlocks: s.vacationBlocks.map(b => {
        if (b.id !== id) return b;
        const trimmed = (note || '').trim();
        if (trimmed === (b.note || '')) return b;
        if (!trimmed) { const { note: _omit, ...rest } = b; return rest; }
        return { ...b, note: trimmed };
      }),
    })), [setFn]);
  const updateDemand = useCallback((proc, week, val) =>
    setFn(s => ({ ...s, demand: { ...s.demand, [proc]: { ...s.demand[proc], [week]: val } } })), [setFn]);
  // Copy an old process's demand into a planning process: only weeks without a
  // value are filled; weeks that already have one are replaced only on a yes.
  const [pendingDemand, setPendingDemand] = useState(null);
  const copyDemand = useCallback((key, from) => {
    const cur = latestState.current.demand;
    const { conflicts, signature } = mergeDemandSeries(cur[key], cur[from], false);
    setFn(s => ({ ...s, demand: { ...s.demand, [key]: mergeDemandSeries(s.demand[key], s.demand[from], false).series } }));
    if (conflicts) setPendingDemand({ key, from, n: conflicts, signature });
  }, [setFn, setPendingDemand]);
  const setShiftMode = useCallback(m =>
    setFn(s => ({ ...s, settings: { ...s.settings, shiftMode: m } })), [setFn]);
  const setStartWeek = useCallback(w =>
    setFn(s => ({
      ...s,
      settings: {
        ...s.settings,
        startWeek: Math.max(1, Math.min(52 - s.settings.visibleWeeks + 1, w)),
      },
    })), [setFn]);

  /* ── Operator management ────────────────────────────────────────────────── */
  const addOperator = useCallback((name, shift) => {
    const op = { id: uid(), name, shift, active: true, certifications: [] };
    setFn(s => ({ ...s, operators: [...s.operators, op] }));
    flash(t('{name} added', { name }));
  }, [setFn, flash, t]);
  const removeOperator = useCallback(id => {
    setFn(s => ({
      ...s,
      operators: s.operators.filter(o => o.id !== id),
      vacationBlocks: s.vacationBlocks.filter(b => b.operatorId !== id),
    }));
  }, [setFn]);

  /* ── CSV import ─────────────────────────────────────────────────────────── */
  const handleCSVImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const { operators: parsed, error, warnings } = parseCSV(ev.target.result, t);
        if (error) { flash(error); return; }
        const { operators: merged, added, updated } = mergeOperators(operators, parsed);
        update({ operators: merged });
        const firstWarning = warnings && warnings.length ? ` • ${warnings[0]}` : '';
        const more = warnings && warnings.length > 1 ? ` ${t('(+{n} more)', { n: warnings.length - 1 })}` : '';
        flash(`${t('{added} imported, {updated} updated', { added, updated })}${firstWarning}${more}`);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [operators, update, flash, t]);
  const handleCSVExport = useCallback(() => {
    downloadOperatorsCSV(operators);
    flash(t('People list downloaded'));
  }, [operators, flash, t]);

  const handleSave = useCallback(() => { saveState(state); flash(t('Saved')); }, [state, flash, t]);
  const handleExport = useCallback(() => { exportJSON(state); flash(t('Backup file downloaded')); }, [state, flash, t]);
  const handleImport = useCallback(async () => {
    const data = await importJSON();
    // No Undo button on these two messages: it would undo whatever was changed
    // last, which may no longer be this. Undo in the top bar says what it does.
    const plan = adoptPlan(data);
    if (plan) { setFn(() => plan); setAutosave(true); flash(t('Backup file imported')); }
    else if (data) flash(t('That backup file is not a complete vacation plan'));
  }, [setFn, flash, t]);
  const handleReset = useCallback(() => {
    setConfirmReset(false);
    clearState();
    setAutosave(true);
    setFn(() => ({ operators: seedOperators, vacationBlocks: seedVacationBlocks, demand: buildDefaultDemand(), settings: defaultSettings }));
    flash(t('Reset to the example plan'));
  }, [setFn, flash, t]);
  const handleShare = useCallback(async () => {
    const link = buildShareLink(state);
    const ok = await copyToClipboard(link);
    flash(ok ? t('Link copied') : t('The link could not be copied'));
  }, [state, flash, t]);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="wf-page overflow-hidden">

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <TopBar
        shiftMode={shiftMode} onShiftModeChange={setShiftMode} byTeam={!!model}
        onImportCSV={model ? undefined : handleCSVImport} onExportCSV={handleCSVExport} onSave={handleSave}
        onExportJSON={handleExport} onImportJSON={handleImport}
        onReset={() => setConfirmReset(true)}
        onShare={handleShare}
        onUndo={undo} onRedo={redo}
        canUndo={canUndo} canRedo={canRedo}
      />

      {unlinkedActive > 0 && (
        <p role="status" className="border-b border-line bg-soft px-4 py-2 text-xs text-ink-2">
          {t('{n} operators are not linked to a profile in People. They keep their old S1/S2 and processes, but count toward no coverage until you link them (Operators list, open a name).', { n: unlinkedActive })}
        </p>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Operator Panel */}
        <OperatorPanel
          operators={operators} onUpdateOperator={updateOp}
          showMgmt={showOperatorMgmt}
          onToggleMgmt={() => setShowOperatorMgmt(p => !p)}
          onAddOperator={addOperator} onRemoveOperator={removeOperator}
          people={people} onLinkOperator={linkOp} model={model}
          onDownloadTemplate={model ? undefined : downloadCSVTemplate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        {/* Center: Calendar (handles both zoom levels internally) */}
        <CalendarGrid
          planning={planningView ? { ...planningView, copyDemand } : null}
          operators={gridOperators} vacationBlocks={vacationBlocks}
          demand={demand} settings={settings} weeks={weeks}
          holidayMap={holidayMap}
          onAddBlock={addBlock} onUpdateBlock={updateBlock}
          onDeleteBlock={deleteBlock} onSetBlockStatus={setBlockStatus}
          onSetBlockDayStatus={setBlockDayStatus} onClearBlockDayStatus={clearBlockDayStatus}
          onSetBlockNote={setBlockNote}
          setStartWeek={setStartWeek}
          showDemand={showDemand}
          onToggleDemand={() => setShowDemand(p => !p)}
          updateDemand={updateDemand}
          zoom={zoom}
          onZoomChange={setZoom}
        />
      </div>

      {pendingLink && (
        <Confirm title={t('Merge with the existing operator?')} confirmLabel={t('Merge')}
          body={t('{name} already has an operator with vacation or competencies of its own. Merging keeps all vacation blocks and keeps the other operator\'s old values on this one. You can undo this.', { name: pendingLink.name })}
          onConfirm={() => { const l = pendingLink; setPendingLink(null); setFn(s => linkOperator(s, l.operatorId, l.personId, people, { confirmMerge: true })); }}
          onCancel={() => setPendingLink(null)} />
      )}
      {pendingDemand && (
        <Confirm title={t('Replace saved demand?')} confirmLabel={t('Replace')}
          body={t('{n} weeks already have a demand of their own. The empty weeks were filled. Replace those {n} with the old values too?', { n: pendingDemand.n })}
          onConfirm={() => {
            // Count again now: if the saved weeks changed meanwhile, ask again with the new number
            const cur = latestState.current.demand;
            const { conflicts, signature } = mergeDemandSeries(cur[pendingDemand.key], cur[pendingDemand.from], false);
            if (signature === pendingDemand.signature) {
              setFn(s => ({ ...s, demand: { ...s.demand, [pendingDemand.key]: mergeDemandSeries(s.demand[pendingDemand.key], s.demand[pendingDemand.from], true).series } }));
              setPendingDemand(null);
            } else setPendingDemand(conflicts ? { ...pendingDemand, n: conflicts, signature } : null);
          }}
          onCancel={() => setPendingDemand(null)} />
      )}
      {confirmReset && (
        <Confirm danger title={t('Reset the vacation plan?')} confirmLabel={t('Reset')}
          body={t('Operators, vacation blocks and demand go back to the example plan. You can undo this until you leave the page.')}
          onConfirm={handleReset} onCancel={() => setConfirmReset(false)} />
      )}
    </div>
  );
}
