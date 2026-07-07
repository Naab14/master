import { useState } from 'react';
import * as api from '../../api';
import { usePopover } from './popover-context';
import { statusColumn } from './util';
import Avatar from './Avatar';

const filteredItems = (group, search) =>
  search ? group.items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : group.items;

export default function TableView({ board, search, updateBoard }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const { openPopover, closePopover } = usePopover();

  const toggleCollapsed = gid => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(gid)) next.delete(gid); else next.add(gid);
    return next;
  });

  const removeGroup = async group => {
    if (group.items.length && !confirm(`Delete group "${group.title}" and its ${group.items.length} item(s)?`)) return;
    await api.deleteGroup(board.id, group.id);
    updateBoard(board.id, b => ({ ...b, groups: b.groups.filter(g => g.id !== group.id) }));
  };

  const addColumnMenu = e => openPopover(e, <AddColumnForm board={board} updateBoard={updateBoard} close={closePopover} />);

  const columnMenu = (e, col) => {
    e.preventDefault();
    openPopover(e, (
      <button
        className="rounded-lg px-3 py-2 text-left text-xs font-bold"
        style={{ color: 'var(--coverage-red)' }}
        onClick={async () => {
          await api.deleteColumn(board.id, col.id);
          updateBoard(board.id, b => ({
            ...b,
            columns: b.columns.filter(c => c.id !== col.id),
            groups: b.groups.map(g => ({
              ...g,
              items: g.items.map(i => {
                const values = { ...i.values };
                delete values[col.id];
                return { ...i, values };
              }),
            })),
          }));
          closePopover();
        }}
      >
        🗑 Delete column "{col.title}"
      </button>
    ));
  };

  return (
    <div className="flex flex-col gap-6">
      {board.groups.map(group => {
        const items = filteredItems(group, search);
        const isCollapsed = collapsed.has(group.id);
        const statusCol = statusColumn(board);
        return (
          <div key={group.id}>
            {/* Group header */}
            <div className="group/hdr mb-1 flex items-center gap-2">
              <button onClick={() => toggleCollapsed(group.id)} className="text-xs" style={{ color: group.color }}>
                {isCollapsed ? '▶' : '▼'}
              </button>
              <input
                defaultValue={group.title}
                className="bg-transparent text-sm font-extrabold outline-none"
                style={{ color: group.color }}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v && v !== group.title) {
                    updateBoard(board.id, b => ({ ...b, groups: b.groups.map(g => g.id === group.id ? { ...g, title: v } : g) }));
                    api.patchGroup(board.id, group.id, { title: v }).catch(() => {});
                  } else e.target.value = group.title;
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {items.length} item{items.length === 1 ? '' : 's'}
              </span>
              <button className="opacity-0 transition-opacity group-hover/hdr:opacity-50 hover:!opacity-100"
                title="Delete group" onClick={() => removeGroup(group)}>
                🗑
              </button>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full border-collapse text-sm" style={{ background: 'var(--bg-panel)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="w-1.5 p-0" />
                      <th className="min-w-[220px] px-3 py-2 text-left text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Item</th>
                      {board.columns.map(col => (
                        <th
                          key={col.id}
                          className="min-w-[130px] px-3 py-2 text-left text-xs font-bold"
                          style={{ color: 'var(--text-secondary)' }}
                          title="Right-click to delete column"
                          onContextMenu={e => columnMenu(e, col)}
                        >
                          {col.title}
                        </th>
                      ))}
                      <th className="w-10 cursor-pointer px-2 py-2 text-center text-sm font-bold"
                        style={{ color: 'var(--accent)' }} title="Add column" onClick={addColumnMenu}>
                        +
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <Row key={item.id} board={board} group={group} item={item} updateBoard={updateBoard} />
                    ))}
                    <tr>
                      <td className="p-0" style={{ background: group.color, opacity: 0.35 }} />
                      <td colSpan={board.columns.length + 2} className="px-3 py-1.5">
                        <AddItemInput board={board} group={group} updateBoard={updateBoard} />
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Status distribution strip */}
                {statusCol && items.length > 0 && (
                  <div className="flex h-2 w-full overflow-hidden">
                    {[...statusCol.labels, { label: '', color: '#c4c4c4' }].map(def => {
                      const n = items.filter(i => (i.values[statusCol.id] || '') === def.label).length;
                      if (!n) return null;
                      return (
                        <div key={def.label || '∅'}
                          style={{ background: def.color, width: `${(n / items.length) * 100}%` }}
                          title={`${def.label || 'No status'}: ${n}/${items.length}`} />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Rows & cells ───────────────────────────────────────────────────────── */
function Row({ board, group, item, updateBoard }) {
  const setItem = patch =>
    updateBoard(board.id, b => ({
      ...b,
      groups: b.groups.map(g => g.id !== group.id ? g : {
        ...g,
        items: g.items.map(i => (i.id === item.id ? { ...i, ...patch } : i)),
      }),
    }));

  return (
    <tr className="group/row" style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="p-0" style={{ background: group.color }} />
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <input
            defaultValue={item.name}
            className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
            onBlur={e => {
              const v = e.target.value.trim();
              if (v && v !== item.name) {
                setItem({ name: v });
                api.patchItem(board.id, item.id, { name: v }).catch(() => {});
              } else e.target.value = item.name;
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <button
            className="opacity-0 transition-opacity group-hover/row:opacity-40 hover:!opacity-100"
            title="Delete item"
            onClick={async () => {
              await api.deleteItem(board.id, item.id);
              updateBoard(board.id, b => ({
                ...b,
                groups: b.groups.map(g => g.id !== group.id ? g : { ...g, items: g.items.filter(i => i.id !== item.id) }),
              }));
            }}
          >
            🗑
          </button>
        </div>
      </td>
      {board.columns.map(col => (
        <td key={col.id} className="px-2 py-1" style={{ borderLeft: '1px solid var(--border)' }}>
          <Cell board={board} item={item} col={col} setItem={setItem} />
        </td>
      ))}
      <td />
    </tr>
  );
}

export function Cell({ board, item, col, setItem }) {
  const { openPopover, closePopover, members, setData } = usePopover();
  const value = item.values[col.id] || '';

  const commit = v => {
    setItem({ values: { ...item.values, [col.id]: v } });
    api.patchItem(board.id, item.id, { values: { [col.id]: v } }).catch(() => {});
  };

  if (col.type === 'status') {
    const def = (col.labels || []).find(l => l.label === value);
    return (
      <button
        className="w-full rounded px-2 py-1.5 text-center text-xs font-bold text-white"
        style={{ background: def ? def.color : '#c4c4c4', minHeight: 28 }}
        onClick={e => openPopover(e, (
          <>
            {(col.labels || []).map(l => (
              <button key={l.label} className="rounded px-3 py-1.5 text-xs font-bold text-white"
                style={{ background: l.color }}
                onClick={() => { commit(l.label); closePopover(); }}>
                {l.label}
              </button>
            ))}
            <button className="rounded px-3 py-1.5 text-xs" onClick={() => { commit(''); closePopover(); }}>
              Clear
            </button>
          </>
        ))}
      >
        {value || ' '}
      </button>
    );
  }

  if (col.type === 'person') {
    return (
      <button
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs"
        onClick={e => openPopover(e, (
          <PersonPicker
            value={value}
            members={members}
            onPick={name => {
              if (name && !members.includes(name)) {
                setData(d => ({ ...d, members: [...d.members, name] }));
                api.addMember(name).catch(() => {});
              }
              commit(name);
              closePopover();
            }}
          />
        ))}
      >
        {value
          ? <><Avatar name={value} size={20} /><span className="truncate">{value}</span></>
          : <span style={{ color: 'var(--text-secondary)' }}>＋ Assign</span>}
      </button>
    );
  }

  if (col.type === 'date') {
    return (
      <input type="date" defaultValue={value} key={value}
        className="w-full bg-transparent text-xs outline-none" style={{ color: 'var(--text-primary)' }}
        onChange={e => commit(e.target.value)} />
    );
  }

  return (
    <input
      type={col.type === 'number' ? 'number' : 'text'}
      defaultValue={value}
      key={value}
      className="w-full bg-transparent text-xs outline-none"
      onBlur={e => { if (e.target.value !== value) commit(e.target.value); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

function PersonPicker({ value, members, onPick }) {
  const [name, setName] = useState(value);
  return (
    <>
      <input
        autoFocus value={name} placeholder="Type a name…"
        className="rounded-lg px-3 py-2 text-sm"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onPick(name.trim()); }}
      />
      {members.map(m => (
        <button key={m} className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold"
          onClick={() => onPick(m)}>
          <Avatar name={m} size={20} />{m}
        </button>
      ))}
      {value && (
        <button className="rounded px-2 py-1.5 text-left text-xs" onClick={() => onPick('')}>
          Unassign
        </button>
      )}
    </>
  );
}

function AddItemInput({ board, group, updateBoard }) {
  const [name, setName] = useState('');
  return (
    <input
      value={name}
      onChange={e => setName(e.target.value)}
      onKeyDown={async e => {
        if (e.key === 'Enter' && name.trim()) {
          const item = await api.createItem(board.id, group.id, name.trim());
          updateBoard(board.id, b => ({
            ...b,
            groups: b.groups.map(g => (g.id === group.id ? { ...g, items: [...g.items, item] } : g)),
          }));
          setName('');
        }
      }}
      placeholder="+ Add item"
      className="w-full bg-transparent text-xs outline-none"
      style={{ color: 'var(--text-primary)' }}
    />
  );
}

function AddColumnForm({ board, updateBoard, close }) {
  const [title, setTitle] = useState('');
  const types = [
    ['text', '📝 Text'],
    ['status', '🎨 Status'],
    ['person', '👤 Person'],
    ['date', '📅 Date'],
    ['number', '#️⃣ Number'],
  ];
  return (
    <>
      <input
        autoFocus value={title} placeholder="Column title"
        className="rounded-lg px-3 py-2 text-sm"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onChange={e => setTitle(e.target.value)}
      />
      {types.map(([type, label]) => (
        <button key={type} className="rounded px-2 py-1.5 text-left text-xs font-semibold"
          onClick={async () => {
            const col = await api.createColumn(board.id, title.trim() || label.replace(/^\S+\s/, ''), type);
            updateBoard(board.id, b => ({ ...b, columns: [...b.columns, col] }));
            close();
          }}>
          {label}
        </button>
      ))}
    </>
  );
}
