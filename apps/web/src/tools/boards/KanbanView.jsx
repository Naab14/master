import { useState } from 'react';
import * as api from '../../api';
import { statusColumn } from './util';
import Avatar from './Avatar';

export default function KanbanView({ board, search, updateBoard }) {
  const [dragOverLane, setDragOverLane] = useState(null);
  const statusCol = statusColumn(board);

  if (!statusCol) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Add a Status column to use the Kanban view.</p>;
  }

  const personCol = board.columns.find(c => c.type === 'person');
  const dateCol = board.columns.find(c => c.type === 'date');

  const q = search.toLowerCase();
  const allItems = board.groups.flatMap(g =>
    g.items
      .filter(i => !q || i.name.toLowerCase().includes(q))
      .map(item => ({ item, group: g })));

  const lanes = [...statusCol.labels, { label: '', color: '#c4c4c4', isEmpty: true }];

  const moveToLane = (itemId, label) => {
    for (const g of board.groups) {
      const item = g.items.find(i => i.id === itemId);
      if (item) {
        updateBoard(board.id, b => ({
          ...b,
          groups: b.groups.map(gr => gr.id !== g.id ? gr : {
            ...gr,
            items: gr.items.map(i => (i.id === itemId ? { ...i, values: { ...i.values, [statusCol.id]: label } } : i)),
          }),
        }));
        api.patchItem(board.id, itemId, { values: { [statusCol.id]: label } }).catch(() => {});
        return;
      }
    }
  };

  return (
    <div className="flex h-full items-start gap-3 overflow-x-auto pb-2">
      {lanes.map(lane => {
        const laneItems = allItems.filter(({ item }) => (item.values[statusCol.id] || '') === lane.label);
        if (lane.isEmpty && !laneItems.length) return null;
        return (
          <div
            key={lane.label || '∅'}
            className="flex w-64 shrink-0 flex-col gap-2 rounded-xl p-2"
            style={{
              background: dragOverLane === lane.label
                ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-secondary))'
                : 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
            onDragOver={e => { e.preventDefault(); setDragOverLane(lane.label); }}
            onDragLeave={() => setDragOverLane(l => (l === lane.label ? null : l))}
            onDrop={e => {
              e.preventDefault();
              setDragOverLane(null);
              moveToLane(e.dataTransfer.getData('text/plain'), lane.label);
            }}
          >
            <div className="flex items-center gap-2 px-1 text-xs font-bold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: lane.color }} />
              <span>{lane.label || 'No status'}</span>
              <span className="ml-auto rounded-full px-1.5" style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)' }}>
                {laneItems.length}
              </span>
            </div>

            {laneItems.map(({ item, group }) => {
              const owner = personCol && item.values[personCol.id];
              const due = dateCol && item.values[dateCol.id];
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; }}
                  className="flex cursor-grab flex-col gap-1.5 rounded-lg p-2.5 text-sm"
                  style={{ background: 'var(--bg-panel)', borderLeft: `3px solid ${group.color}`, boxShadow: 'var(--shadow-lg)' }}
                >
                  <span className="font-semibold leading-snug">{item.name}</span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {owner && <Avatar name={owner} size={18} />}
                    {due && <span>📅 {due}</span>}
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
