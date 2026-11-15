import { useState } from 'react';
import * as api from '../../api';
import { useI18n } from '../../i18n';
import { pulse } from '../../workforce/motion';
import { usePopover } from './popover-context';
import { isIsoDate, statusColumn } from './util';
import Avatar from './Avatar';

export default function KanbanView({ board, search, updateBoard }) {
  const { t, fmt } = useI18n();
  const { openPopover, closePopover, failed } = usePopover();
  const [dragOverLane, setDragOverLane] = useState(null);
  const [dragId, setDragId] = useState(null);
  const statusCol = statusColumn(board);

  if (!statusCol) {
    return <p className="text-sm text-ink-3">{t('Add a Status column to use the Kanban view.')}</p>;
  }

  const personCol = board.columns.find(c => c.type === 'person');
  const dateCol = board.columns.find(c => c.type === 'date');

  const q = search.toLowerCase();
  const allItems = board.groups.flatMap(g =>
    g.items
      .filter(i => !q || i.name.toLowerCase().includes(q))
      .map(item => ({ item, group: g })));

  const lanes = [...statusCol.labels, { label: '', color: 'var(--ink-3)', isEmpty: true }];

  const moveToLane = (itemId, label) => {
    for (const g of board.groups) {
      const item = g.items.find(i => i.id === itemId);
      if (item) {
        if ((item.values[statusCol.id] || '') === label) return;
        updateBoard(board.id, b => ({
          ...b,
          groups: b.groups.map(gr => gr.id !== g.id ? gr : {
            ...gr,
            items: gr.items.map(i => (i.id === itemId ? { ...i, values: { ...i.values, [statusCol.id]: label } } : i)),
          }),
        }));
        api.patchItem(board.id, itemId, { values: { [statusCol.id]: label } }).catch(failed);
        // Show where the card landed, once it has been drawn in its new lane
        requestAnimationFrame(() => pulse(document.querySelector(`[data-card="${itemId}"]`)));
        return;
      }
    }
  };

  /* Clicking a card (or Enter on it) offers the lanes as a menu, so cards can
   * be moved without dragging: on a phone, or with the keyboard. */
  const laneMenu = (e, item) => openPopover(e, (
    <>
      <div className="tl-menu-label">{t('Move to')}</div>
      {lanes.map(lane => (
        <button key={lane.label || '∅'} type="button" className="tl-menu-item"
          aria-current={(item.values[statusCol.id] || '') === lane.label || undefined}
          onClick={() => { moveToLane(item.id, lane.label); closePopover(); }}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lane.color }} />
          {lane.label || t('No status')}
        </button>
      ))}
    </>
  ));

  return (
    <div className="flex h-full items-start gap-3 overflow-x-auto pb-2">
      {lanes.map(lane => {
        const laneItems = allItems.filter(({ item }) => (item.values[statusCol.id] || '') === lane.label);
        if (lane.isEmpty && !laneItems.length) return null;
        return (
          <div
            key={lane.label || '∅'}
            data-drop={dragOverLane === lane.label || undefined}
            className="tl-drop flex w-64 shrink-0 flex-col gap-2 rounded-panel border border-line bg-soft p-2"
            onDragOver={e => { e.preventDefault(); setDragOverLane(lane.label); }}
            onDragLeave={() => setDragOverLane(l => (l === lane.label ? null : l))}
            onDrop={e => {
              e.preventDefault();
              setDragOverLane(null);
              setDragId(null);
              moveToLane(e.dataTransfer.getData('text/plain'), lane.label);
            }}
          >
            <div className="flex items-center gap-2 px-1 text-xs font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: lane.color }} />
              <span>{lane.label || t('No status')}</span>
              <span className="t-num ml-auto rounded-full bg-panel px-1.5 text-ink-3">{laneItems.length}</span>
            </div>

            {laneItems.map(({ item, group }) => {
              const owner = personCol && item.values[personCol.id];
              const due = dateCol && item.values[dateCol.id];
              return (
                <div
                  key={item.id}
                  data-card={item.id}
                  data-dragging={dragId === item.id || undefined}
                  draggable
                  role="button"
                  tabIndex={0}
                  onDragStart={e => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; setDragId(item.id); }}
                  onDragEnd={() => { setDragId(null); setDragOverLane(null); }}
                  onClick={e => laneMenu(e, item)}
                  onKeyDown={e => { if (e.key === 'Enter') laneMenu(e, item); }}
                  className="tl-panel tl-lift ui-focus flex cursor-grab flex-col gap-1.5 p-2.5 text-sm"
                  style={{ borderLeft: `3px solid ${group.color}` }}
                >
                  <span className="font-semibold leading-snug">{item.name}</span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
                    {owner && <Avatar name={owner} size={18} />}
                    {due && <span>📅 {isIsoDate(due) ? fmt.date(due) : due}</span>}
                    <span style={{ color: group.color }}>● {group.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
