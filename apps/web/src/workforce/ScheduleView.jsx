/* Schedule: people as rows across dates, or a month calendar.
 * Zoom from a couple of weeks to several months, drag shifts, keyboard,
 * coverage per shift along the bottom. View, zoom, filters and position are
 * remembered in this browser. */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Segmented } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store';
import { useAbsences } from './derive';
import { useShortcuts } from './shortcuts';
import { Avatar, Confirm, EmploymentMark, Empty, PageHeader, Select, usePref } from './ui';
import { addDays, addMonths, dateRange, endOfMonth, isoWeek, startOfMonth, startOfWeek, todayIn, weekday } from './logic/time';
import { displayName, list, settingsOf } from './logic/model';
import { clearOverrideOps, overrideOps, resolveShift, teamOf } from './logic/schedule';
import { computeCoverage, matchPeople } from './logic/coverage';
import { eventsOn } from './logic/events';
import CellSheet from './CellSheet';
import DaySheet from './DaySheet';
import SchedulePrint from './SchedulePrint';

const MIN_CELL = 14;
const MAX_CELL = 130;
const daysFor = cell => (cell >= 90 ? 14 : cell >= 40 ? 35 : cell >= 22 ? 70 : 140);

export default function ScheduleView() {
  const { t, fmt } = useI18n();
  const { wf, idx, can, commit, undo, redo, canUndo, canRedo, phase } = useWorkforce();
  const today = todayIn();
  const [pref, setPref] = usePref('schedule', { view: 'people', anchor: today, cell: 44, density: 'comfortable', team: 'all', emp: 'all', skill: '', collapsed: {}, scrollTop: 0 });
  const [sel, setSel] = useState(null);          // { personId, date }
  const [cellSheet, setCellSheet] = useState(null);
  const [daySheet, setDaySheet] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [swap, setSwap] = useState(null);
  const settings = settingsOf(wf);
  const absences = useAbsences();
  const canEdit = can('schedule.edit');

  const shiftTypes = useMemo(() => list(wf.shiftTypes).sort((a, b) => (a.order || 0) - (b.order || 0)), [wf.shiftTypes]);
  const nDays = daysFor(pref.cell);
  const start = pref.view === 'calendar' ? startOfWeek(startOfMonth(pref.anchor)) : startOfWeek(pref.anchor);
  const end = pref.view === 'calendar' ? addDays(startOfWeek(endOfMonth(pref.anchor)), 6) : addDays(start, nDays - 1);
  const days = useMemo(() => dateRange(start, end), [start, end]);

  const people = useMemo(() => {
    const skillIds = pref.skill ? new Set(matchPeople(wf, { skills: [{ skillId: pref.skill }], date: pref.anchor })) : null;
    return list(wf.people)
      .filter(p => (!p.endDate || p.endDate >= start))
      .filter(p => pref.emp === 'all' || p.employment === pref.emp)
      .filter(p => !skillIds || skillIds.has(p.id))
      .map(p => ({ ...p, teamId: teamOf(idx, p.id, pref.anchor) }))
      .filter(p => pref.team === 'all' || p.teamId === pref.team)
      .sort((a, b) => a.name.localeCompare(b.name, fmt.locale));
  }, [wf, idx, pref.team, pref.emp, pref.skill, pref.anchor, start, fmt.locale]);

  const groups = useMemo(() => {
    const teams = [...list(wf.teams).sort((a, b) => a.name.localeCompare(b.name)), { id: null, name: t('No team') }];
    return teams.map(team => ({ team, people: people.filter(p => (p.teamId || null) === team.id) })).filter(g => g.people.length);
  }, [wf.teams, people, t]);

  const grid = useMemo(() => {
    const out = new Map();
    for (const p of people) out.set(p.id, days.map(d => resolveShift(wf, idx, p.id, d)));
    return out;
  }, [wf, idx, people, days]);

  const coverage = useMemo(() => {
    const out = {};
    for (const st of shiftTypes) out[st.id] = days.map(d => computeCoverage(wf, idx, d, st.id, absences.all));
    return out;
  }, [wf, idx, days, shiftTypes, absences.all]);

  /* ── Navigation and zoom ─────────────────────────────────────────────── */
  const go = useCallback(dir => setPref(p => ({ ...p, anchor: p.view === 'calendar' ? addMonths(p.anchor, dir) : addDays(p.anchor, dir * (p.cell >= 40 ? 7 : 28)) })), [setPref]);
  const zoom = useCallback(factor => setPref(p => ({ ...p, cell: Math.round(Math.min(MAX_CELL, Math.max(MIN_CELL, p.cell * factor))) })), [setPref]);
  const scroller = useRef(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    // Ctrl + wheel (and trackpad pinch) zooms the grid instead of the page.
    const onWheel = e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); } };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, pref.view, phase]);
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = pref.scrollTop || 0; }, [pref.view]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveScroll = useRef(null);
  const onScroll = e => {
    const top = e.currentTarget.scrollTop;
    clearTimeout(saveScroll.current);
    saveScroll.current = setTimeout(() => setPref({ scrollTop: top }), 300);
  };

  /* ── Editing ─────────────────────────────────────────────────────────── */
  const setShift = useCallback((personId, date, shiftTypeId) => {
    if (!canEdit) return;
    const type = wf.shiftTypes[shiftTypeId];
    commit(overrideOps(personId, date, shiftTypeId), t('{name}: {shift} on {date}', { name: wf.people[personId]?.name, shift: type ? type.name : t('Day off'), date: fmt.date(date) }));
  }, [canEdit, wf, commit, t, fmt]);
  const resetShift = useCallback((personId, date) => {
    if (canEdit && wf.overrides[`${personId}_${date}`]) commit(clearOverrideOps(personId, date), t('{name}: back to pattern on {date}', { name: wf.people[personId]?.name, date: fmt.date(date) }));
  }, [canEdit, wf, commit, t, fmt]);

  const onDrop = useCallback((from, to) => {
    if (!canEdit || (from.personId === to.personId && from.date === to.date)) return;
    const a = resolveShift(wf, idx, from.personId, from.date);
    const b = resolveShift(wf, idx, to.personId, to.date);
    if (from.personId === to.personId) {
      // A simple move within one person's row: do it, offer Undo.
      commit([...overrideOps(from.personId, from.date, b.shiftTypeId), ...overrideOps(to.personId, to.date, a.shiftTypeId)],
        t('Moved {name}’s shift to {date}', { name: wf.people[from.personId]?.name, date: fmt.date(to.date) }));
    } else setSwap({ from, to, a, b });
  }, [canEdit, wf, idx, commit, t, fmt]);

  const moveSel = (dx, dy) => {
    const flat = groups.flatMap(g => (pref.collapsed[g.team.id || 'none'] ? [] : g.people));
    if (!flat.length) return;
    const cur = sel || { personId: flat[0].id, date: days.includes(today) ? today : days[0] };
    const row = Math.min(flat.length - 1, Math.max(0, flat.findIndex(p => p.id === cur.personId) + dy));
    const date = addDays(cur.date, dx);
    if (date < start) go(-1); else if (date > end) go(1);
    setSel({ personId: flat[row].id, date });
  };
  useEffect(() => {
    if (sel && !cellSheet) document.querySelector(`[data-cell="${sel.personId}_${sel.date}"]`)?.focus({ preventScroll: false });
  }, [sel, cellSheet, days]);

  useShortcuts({
    today: () => setPref({ anchor: today }),
    week: () => setPref({ view: 'people', cell: 110 }),
    month: () => setPref({ view: 'calendar' }),
    zoomIn: () => zoom(1.25), zoomOut: () => zoom(0.8),
    prev: () => go(-1), next: () => go(1),
    print: () => setPrinting(true),
    off: () => sel && setShift(sel.personId, sel.date, null),
    reset: () => sel && resetShift(sel.personId, sel.date),
    other: e => {
      if (pref.view !== 'people') return;
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (arrows) { e.preventDefault(); moveSel(...arrows); return; }
      if (!sel) return;
      if (e.key === 'Enter') { e.preventDefault(); setCellSheet(sel); return; }
      const type = shiftTypes.find(s => s.code && s.code.toLowerCase() === e.key.toLowerCase());
      if (type) setShift(sel.personId, sel.date, type.id);
    },
  });

  if (phase === 'ready' && !list(wf.people).length) {
    return (
      <div className="wf-page">
        <PageHeader title={t('Schedule')} />
        <Empty title={t('No people yet')} action={<Button variant="primary" onClick={() => { window.location.hash = '#/setup'; }}>{t('Open setup')}</Button>}>
          {t('Add people and shift patterns in Setup, or load the demo plant there to look around.')}
        </Empty>
      </div>
    );
  }

  const rangeLabel = pref.view === 'calendar' ? fmt.date(pref.anchor, 'month') : `${fmt.date(start)} – ${fmt.date(end)} · ${t('week')} ${isoWeek(start)}–${isoWeek(end)}`;
  const nick = settings.nicknameIn.schedule;

  return (
    <div className="wf-page">
      <PageHeader title={t('Schedule')}>
        <Segmented label={t('View')} value={pref.view} onChange={view => setPref({ view })}
          options={[{ value: 'people', label: t('People') }, { value: 'calendar', label: t('Calendar') }]} />
        <Button onClick={() => setPrinting(true)}>{t('Print')}</Button>
      </PageHeader>

      <div className="wf-toolbar no-print">
        <Button icon aria-label={t('Earlier')} onClick={() => go(-1)}>‹</Button>
        <Button onClick={() => setPref({ anchor: today })}>{t('Today')}</Button>
        <Button icon aria-label={t('Later')} onClick={() => go(1)}>›</Button>
        <strong className="mx-1 text-sm" aria-live="polite">{rangeLabel}</strong>
        <span className="flex-1" />
        {pref.view === 'people' && (
          <>
            <Button onClick={() => setPref({ cell: 110 })}>{t('Week')}</Button>
            <Button onClick={() => setPref({ cell: 34 })}>{t('Month')}</Button>
            <Button icon aria-label={t('Zoom out')} onClick={() => zoom(0.8)}>−</Button>
            <input type="range" min={MIN_CELL} max={MAX_CELL} value={pref.cell} onChange={e => setPref({ cell: Number(e.target.value) })} aria-label={t('Zoom')} className="w-24" />
            <Button icon aria-label={t('Zoom in')} onClick={() => zoom(1.25)}>+</Button>
            <Segmented label={t('Density')} value={pref.density} onChange={density => setPref({ density })} className="ui-seg--small"
              options={[{ value: 'comfortable', label: t('Comfortable') }, { value: 'compact', label: t('Compact') }]} />
          </>
        )}
      </div>
      <div className="wf-toolbar no-print">
        <Select value={pref.team} onChange={e => setPref({ team: e.target.value })} aria-label={t('Team')}>
          <option value="all">{t('All teams')}</option>
          {list(wf.teams).map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </Select>
        <Select value={pref.emp} onChange={e => setPref({ emp: e.target.value })} aria-label={t('Employment')}>
          <option value="all">{t('All employment types')}</option>
          <option value="permanent">{t('Permanent')}</option>
          <option value="consultant">{t('Consultant')}</option>
        </Select>
        <Select value={pref.skill} onChange={e => setPref({ skill: e.target.value })} aria-label={t('Competency')}>
          <option value="">{t('Any competency')}</option>
          {list(wf.skills).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <span className="text-xs text-ink-3">{t('{n} people', { n: people.length })}</span>
        <span className="flex-1" />
        <Button variant="ghost" disabled={!canUndo} onClick={undo} title="Ctrl+Z">↶ {t('Undo')}</Button>
        <Button variant="ghost" disabled={!canRedo} onClick={redo} title="Ctrl+Shift+Z">↷ {t('Redo')}</Button>
      </div>

      {pref.view === 'people' ? (
        <div ref={scroller} className="sch" data-density={pref.density} style={{ '--cell': `${pref.cell}px`, '--days': days.length }} onScroll={onScroll}>
          <div className="sch__grid" role="grid" aria-label={t('Schedule')}>
            <div className="sch__corner" style={{ gridRow: 'span 2' }} />
            <MonthBand days={days} fmt={fmt} />
            {days.map(d => (
              <button type="button" key={d} className="sch__head" data-today={d === today} data-weekend={weekday(d) > 5} data-monday={weekday(d) === 1}
                onClick={() => setDaySheet(d)} title={fmt.date(d, 'long')} aria-label={fmt.date(d, 'long')}>
                {pref.cell >= 30 && <span>{fmt.date(d, 'weekday')}</span>}
                <b>{pref.cell >= 22 || weekday(d) === 1 ? fmt.date(d, 'day') : ''}</b>
              </button>
            ))}
            {groups.map(g => {
              const key = g.team.id || 'none';
              const closed = !!pref.collapsed[key];
              return (
                <Group key={key} team={g.team} count={g.people.length} closed={closed} onToggle={() => setPref(p => ({ ...p, collapsed: { ...p.collapsed, [key]: !closed } }))}>
                  {!closed && g.people.map(p => (
                    <Row key={p.id} person={p} name={displayName(p, nick)} days={days} cells={grid.get(p.id)} shiftTypes={wf.shiftTypes}
                      absences={absences.map} today={today} cell={pref.cell} empMode={settings.employmentIndicator}
                      selDate={sel?.personId === p.id ? sel.date : null} canEdit={canEdit}
                      onSelect={setSel} onOpen={setCellSheet} onDrop={onDrop} onName={() => { window.location.hash = `#/people/${p.id}`; }} />
                  ))}
                </Group>
              );
            })}
            {shiftTypes.map((st, i) => (
              <CoverageRow key={st.id} st={st} days={days} data={coverage[st.id]} bottom={(shiftTypes.length - 1 - i) * 26} cell={pref.cell}
                label={t('Coverage')} onPick={setDaySheet} t={t} />
            ))}
          </div>
        </div>
      ) : (
        <div ref={scroller} className="wf-scroll" onScroll={onScroll}>
          <div className="wf-body">
            <MonthCalendar days={days} month={pref.anchor.slice(0, 7)} today={today} shiftTypes={shiftTypes} coverage={coverage} wf={wf} onPick={setDaySheet} />
          </div>
        </div>
      )}

      {cellSheet && <CellSheet personId={cellSheet.personId} date={cellSheet.date} onClose={() => setCellSheet(null)} />}
      {daySheet && <DaySheet date={daySheet} onClose={() => setDaySheet(null)} onDate={setDaySheet} />}
      {printing && <SchedulePrint groups={groups} days={days} grid={grid} coverage={coverage} shiftTypes={shiftTypes} absences={absences.map} nick={settings.nicknameIn.reports} onClose={() => setPrinting(false)} />}
      {swap && (
        <Confirm
          title={t('Swap shifts?')}
          body={t('{a} and {b} swap: {a} takes {date2}, {b} takes {date1}. This changes two people’s schedules.', {
            a: wf.people[swap.from.personId]?.name, b: wf.people[swap.to.personId]?.name, date1: fmt.date(swap.from.date), date2: fmt.date(swap.to.date),
          })}
          confirmLabel={t('Swap')}
          onCancel={() => setSwap(null)}
          onConfirm={() => {
            const { from, to, a, b } = swap;
            const ops = from.date === to.date
              ? [...overrideOps(from.personId, from.date, b.shiftTypeId), ...overrideOps(to.personId, to.date, a.shiftTypeId)]
              : [...overrideOps(from.personId, from.date, null), ...overrideOps(from.personId, to.date, b.shiftTypeId || a.shiftTypeId),
                ...overrideOps(to.personId, to.date, null), ...overrideOps(to.personId, from.date, a.shiftTypeId)];
            commit(ops, t('Swapped shifts'));
            setSwap(null);
          }}
        />
      )}
    </div>
  );
}

function MonthBand({ days, fmt }) {
  const spans = [];
  for (const d of days) {
    const m = d.slice(0, 7);
    if (spans.length && spans[spans.length - 1].m === m) spans[spans.length - 1].n++;
    else spans.push({ m, n: 1, d });
  }
  return spans.map(s => <div key={s.m} className="sch__month" style={{ gridColumn: `span ${s.n}` }}>{s.n >= 3 ? fmt.date(s.d, 'month') : ''}</div>);
}

function Group({ team, count, closed, onToggle, children }) {
  return (
    <>
      <div className="sch__group">
        <button type="button" onClick={onToggle} aria-expanded={!closed}>
          <span className="wf-chevron" data-open={!closed} aria-hidden="true">▸</span>
          {team.color && <span className="cal__dot" style={{ background: team.color }} />}
          {team.name} <span className="font-normal text-ink-3">{count}</span>
        </button>
      </div>
      {children}
    </>
  );
}

const Row = memo(function Row({ person, name, days, cells, shiftTypes, absences, today, cell, empMode, selDate, canEdit, onSelect, onOpen, onDrop, onName }) {
  return (
    <>
      <div className="sch__name" onClick={onName} title={person.name} role="rowheader">
        <Avatar person={person} size={22} />
        <span className="nm">{name}</span>
        <EmploymentMark person={person} mode={empMode} />
      </div>
      {days.map((d, i) => {
        const r = cells[i];
        const type = shiftTypes[r.shiftTypeId];
        const away = absences.get(`${person.id}_${d}`);
        return (
          <div key={d} role="gridcell" className="sch__cell" data-cell={`${person.id}_${d}`} data-pid={person.id} data-date={d}
            data-weekend={weekday(d) > 5} data-monday={weekday(d) === 1} data-selected={selDate === d}
            tabIndex={selDate === d || (selDate === null && d === today) ? 0 : -1}
            aria-label={`${person.name}, ${d}: ${type ? type.name : '–'}${away ? ' *' : ''}`}
            onFocus={() => { if (selDate !== d) onSelect({ personId: person.id, date: d }); }}
            onPointerDown={e => startDrag(e, { personId: person.id, date: d }, type || away ? (type?.code || '·') : null, canEdit && !!type, onDrop, onOpen)}>
            {(type || away) && (
              <div className="sch__shift" style={{ '--c': type?.color || 'var(--ink-3)' }} data-override={r.source === 'override'} data-away={away?.mark}>
                {cell >= 22 ? (type?.code || '') : ''}{cell >= 70 && type ? ` ${r.start || type.start}` : ''}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
});

/* Pointer drag that works with mouse and touch. Mouse: starts after a small
 * move. Touch: starts after a long press, so normal scrolling still works.
 * A press without a drag opens the details. */
function startDrag(e, from, label, draggable, onDrop, onOpen) {
  if (e.button !== undefined && e.button !== 0) return;
  const touch = e.pointerType === 'touch';
  const x0 = e.clientX; const y0 = e.clientY;
  let dragging = false; let ghost = null; let target = null; let cancelled = false;
  const source = e.currentTarget;
  const blockScroll = ev => { if (dragging) ev.preventDefault(); };
  const begin = () => {
    if (!draggable || cancelled) return;
    dragging = true;
    source.dataset.dragging = 'true';
    ghost = document.createElement('div');
    ghost.className = 'sch__ghost';
    ghost.textContent = label;
    document.body.appendChild(ghost);
    ghost.style.left = `${x0}px`; ghost.style.top = `${y0}px`;
    navigator.vibrate?.(10);
  };
  const timer = touch ? setTimeout(begin, 350) : null;
  const setTarget = el => {
    if (target === el) return;
    if (target) delete target.dataset.drop;
    target = el;
    if (target && target !== source) target.dataset.drop = 'true';
  };
  const move = ev => {
    const far = Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6;
    if (!dragging) {
      if (touch) { if (far) { cancelled = true; clearTimeout(timer); } return; }
      if (far) begin();
      if (!dragging) return;
    }
    ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`;
    setTarget(document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-cell]') || null);
  };
  const end = ev => {
    clearTimeout(timer);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    document.removeEventListener('touchmove', blockScroll);
    delete source.dataset.dragging;
    ghost?.remove();
    const dropOn = target;
    setTarget(null);
    if (ev.type === 'pointercancel') return;
    if (dragging) { if (dropOn && dropOn !== source) onDrop(from, { personId: dropOn.dataset.pid, date: dropOn.dataset.date }); }
    else if (!cancelled) onOpen(from);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  document.addEventListener('touchmove', blockScroll, { passive: false });
}

function CoverageRow({ st, days, data, bottom, cell, label, onPick, t }) {
  return (
    <>
      <div className="sch__cov-name" style={{ bottom }}>
        <span className="cal__dot" style={{ background: st.color }} />{label} · {st.name}
      </div>
      {days.map((d, i) => {
        const c = data[i];
        const text = c.level === 'short' ? `−${c.results.reduce((n, r) => n + Math.max(0, r.required - r.filled - r.competing), 0)}` : c.level === 'risk' ? '!' : '';
        return (
          <button type="button" key={d} className="sch__cov" style={{ bottom }} onClick={() => onPick(d)}
            title={c.level === 'none' ? t('Not running') : `${st.name}: ${t(c.level === 'met' ? 'Covered' : c.level === 'risk' ? 'Possible, with risks' : 'Short')}`}
            aria-label={`${st.name} ${d}: ${c.level}`}>
            {c.level !== 'none' && <i data-level={c.level}>{cell >= 22 ? text : ''}</i>}
          </button>
        );
      })}
    </>
  );
}

function MonthCalendar({ days, month, today, shiftTypes, coverage, wf, onPick }) {
  const { t, fmt } = useI18n();
  return (
    <div className="cal" role="grid" aria-label={fmt.date(`${month}-01`, 'month')}>
      {days.slice(0, 7).map(d => <div key={d} className="cal__dow">{fmt.date(d, 'weekday')}</div>)}
      {days.map((d, i) => (
        <button type="button" key={d} className="cal__day" data-out={d.slice(0, 7) !== month} data-today={d === today} onClick={() => onPick(d)} aria-label={fmt.date(d, 'long')}>
          <span className="cal__num">{fmt.date(d, 'day')}</span>
          {eventsOn(wf, d).slice(0, 2).map(ev => <span key={ev.id} className="cal__line" title={ev.title}>◆ <span className="txt">{ev.time} {ev.title}</span></span>)}
          {shiftTypes.map(st => {
            const c = coverage[st.id][i];
            if (c.level === 'none' && !c.scheduled.length) return null;
            return (
              <span key={st.id} className="cal__line" title={`${st.name}: ${t('{n} scheduled', { n: c.scheduled.length })}`}>
                <span className="cal__dot" data-level={c.level} />
                <b>{st.code}</b> <span className="txt">{c.available.length}{c.absent.length ? ` (−${c.absent.length})` : ''}</span>
              </span>
            );
          })}
        </button>
      ))}
    </div>
  );
}

