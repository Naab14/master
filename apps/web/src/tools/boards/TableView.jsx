import { useState } from 'react';
import * as api from '../../api';
import { useI18n } from '../../i18n';
import { Confirm } from '../../workforce/ui';
import { usePopover } from './popover-context';
import { statusColumn } from './util';
import Avatar from './Avatar';

const filteredItems = (group, search) =>
  search ? group.items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : group.items;

const NO_STATUS = { label: '', color: 'var(--ink-3)' };

export default function TableView({ board, search, updateBoard }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [confirmGroup, setConfirmGroup] = useState(null);
  const { openPopover, closePopover, failed } = usePopover();

  const toggleCollapsed = gid => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(gid)) next.delete(gid); else next.add(gid);
    return next;
  });

  const deleteGroup = async group => {
    setConfirmGroup(null);
    try {
      await api.deleteGroup(board.id, group.id);
      updateBoard(board.id, b => ({ ...b, groups: b.groups.filter(g => g.id !== group.id) }));
    } catch (e) { failed(e); }
  };
  /* An empty group goes at once; one with items asks first. */
  const removeGroup = group => { if (group.items.length) setConfirmGroup(group); else deleteGroup(group); };

  const addColumnMenu = e => openPopover(e, <AddColumnForm board={board} updateBoard={updateBoard} close={closePopover} />);

  const columnMenu = (e, col) => {
    e.preventDefault();
    openPopover(e, (
      <button
        type="button"
        className="tl-menu-item tl-menu-item--danger"
        onClick={async () => {
          closePopover();
          try {
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
          } catch (err) { failed(err); }
        }}
      >
        🗑 {t('Delete the column “{name}”', { name: col.title })}
      </button>
    ));
  };

  const statusCol = statusColumn(board);

  return (
    <div className="flex flex-col gap-6">
      {board.groups.length === 0 && <p className="text-sm text-ink-3">{t('No groups yet. Add one with “Add group”.')}</p>}
      {board.groups.map(group => {
        const items = filteredItems(group, search);
        const isCollapsed = collapsed.has(group.id);
        return (
          <div key={group.id}>
            {/* Group header */}
            <div className="tl-reveal-host mb-1 flex items-center gap-2">
              <button type="button" onClick={() => toggleCollapsed(group.id)} className="tl-icon" style={{ color: group.color }}
                aria-expanded={!isCollapsed} aria-label={isCollapsed ? t('Open the group') : t('Close the group')} title={isCollapsed ? t('Open the group') : t('Close the group')}>
                <span aria-hidden="true" className="wf-chevron" data-open={!isCollapsed}>▸</span>
              </button>
              <input
                defaultValue={group.title}
                aria-label={t('Group name')}
                className="tl-inline w-36 min-w-0 px-1 text-sm font-bold sm:w-56"
                style={{ color: group.color }}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v && v !== group.title) {
                    updateBoard(board.id, b => ({ ...b, groups: b.groups.map(g => g.id === group.id ? { ...g, title: v } : g) }));
                    api.patchGroup(board.id, group.id, { title: v }).catch(failed);
                  } else e.target.value = group.title;
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <span className="t-num whitespace-nowrap text-xs text-ink-3">
                {items.length === 1 ? t('1 item') : t('{n} items', { n: items.length })}
              </span>
              <button type="button" className="tl-icon tl-icon--danger tl-reveal"
                title={t('Delete group')} aria-label={t('Delete group')} onClick={() => removeGroup(group)}>
                🗑
              </button>
            </div>

            {/* The table opens and closes by height */}
            <div className="wf-collapse" data-open={!isCollapsed} inert={isCollapsed}>
              <div>
                <div className="overflow-x-auto rounded-panel border border-line">
                  <table className="w-full border-collapse bg-panel text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="w-1.5 p-0" />
                        <th className="t-label min-w-[220px] px-3 py-2 text-left">{t('Item')}</th>
                        {board.columns.map(col => (
                          <th key={col.id} className="min-w-[130px] p-0 text-left" onContextMenu={e => columnMenu(e, col)}>
                            <button type="button" className="tl-menu-item t-label !min-h-[34px]" title={t('Column options')}
                              onClick={e => columnMenu(e, col)}>
                              {col.title}
                            </button>
                          </th>
                        ))}
                        <th className="w-10 p-0 text-center">
                          <button type="button" className="tl-icon" title={t('Add column')} aria-label={t('Add column')} onClick={addColumnMenu}>+</button>
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

                  {/* How the group's items are spread over the statuses */}
                  {statusCol && items.length > 0 && (
                    <div className="tl-strip flex h-2 w-full overflow-hidden">
                      {[...statusCol.labels, NO_STATUS].map(def => {
                        const n = items.filter(i => (i.values[statusCol.id] || '') === def.label).length;
                        if (!n) return null;
                        return (
                          <div key={def.label || '∅'}
                            style={{ background: def.color, width: `${(n / items.length) * 100}%` }}
                            title={`${def.label || t('No status')}: ${n}/${items.length}`} />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {confirmGroup && (
        <Confirm danger title={t('Delete group?')} confirmLabel={t('Delete')}
          body={t('“{name}” and its {n} items are deleted. This cannot be undone.', { name: confirmGroup.title, n: confirmGroup.items.length })}
          onConfirm={() => deleteGroup(confirmGroup)} onCancel={() => setConfirmGroup(null)} />
      )}
    </div>
  );
}

/* ── Rows & cells ───────────────────────────────────────────────────────── */
function Row({ board, group, item, updateBoard }) {
  const { t } = useI18n();
  const { failed } = usePopover();
  const setItem = patch =>
    updateBoard(board.id, b => ({
      ...b,
      groups: b.groups.map(g => g.id !== group.id ? g : {
        ...g,
        items: g.items.map(i => (i.id === item.id ? { ...i, ...patch } : i)),
      }),
    }));

  return (
    <tr className="tl-row tl-reveal-host border-b border-line">
      <td className="p-0" style={{ background: group.color }} />
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <input
            defaultValue={item.name}
            aria-label={t('Item')}
            className="tl-inline min-w-0 flex-1 px-1 font-semibold"
            onBlur={e => {
              const v = e.target.value.trim();
              if (v && v !== item.name) {
                setItem({ name: v });
                api.patchItem(board.id, item.id, { name: v }).catch(failed);
              } else e.target.value = item.name;
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <button
            type="button"
            className="tl-icon tl-icon--danger tl-reveal"
            title={t('Delete item')}
            aria-label={t('Delete item')}
            onClick={async () => {
              try {
                await api.deleteItem(board.id, item.id);
                updateBoard(board.id, b => ({
                  ...b,
                  groups: b.groups.map(g => g.id !== group.id ? g : { ...g, items: g.items.filter(i => i.id !== item.id) }),
                }));
              } catch (e) { failed(e); }
            }}
          >
            🗑
          </button>
        </div>
      </td>
      {board.columns.map(col => (
        <td key={col.id} className="border-l border-line px-2 py-1">
          <Cell board={board} item={item} col={col} setItem={setItem} />
        </td>
      ))}
      <td />
    </tr>
  );
}

function Cell({ board, item, col, setItem }) {
  const { t } = useI18n();
  const { openPopover, closePopover, members, setData, failed } = usePopover();
  const value = item.values[col.id] || '';

  const commit = v => {
    setItem({ values: { ...item.values, [col.id]: v } });
    api.patchItem(board.id, item.id, { values: { [col.id]: v } }).catch(failed);
  };

  if (col.type === 'status') {
    const def = (col.labels || []).find(l => l.label === value);
    return (
      <button
        type="button"
        className="tl-status"
        style={{ background: def ? def.color : 'var(--ink-3)' }}
        aria-label={`${col.title}: ${value || t('No status')}`}
        onClick={e => openPopover(e, (
          <>
            {(col.labels || []).map(l => (
              <button key={l.label} type="button" className="tl-status"
                style={{ background: l.color }}
                onClick={() => { commit(l.label); closePopover(); }}>
                {l.label}
              </button>
            ))}
            <button type="button" className="tl-menu-item" onClick={() => { commit(''); closePopover(); }}>
              {t('Clear')}
            </button>
          </>
        ))}
      >
        {value || ' '}
      </button>
    );
  }

  if (col.type === 'person') {
    return (
      <button
        type="button"
        className="tl-menu-item !min-h-[30px] !px-1.5 text-xs"
        onClick={e => openPopover(e, (
          <PersonPicker
            value={value}
            members={members}
            onPick={name => {
              if (name && !members.includes(name)) {
                setData(d => ({ ...d, members: [...d.members, name] }));
                api.addMember(name).catch(failed);
              }
              commit(name);
              closePopover();
            }}
          />
        ))}
      >
        {value
          ? <><Avatar name={value} size={20} /><span className="truncate">{value}</span></>
          : <span className="text-ink-3">＋ {t('Assign')}</span>}
      </button>
    );
  }

  if (col.type === 'date') {
    return (
      <input type="date" defaultValue={value} key={value} aria-label={col.title}
        className="tl-inline w-full px-1 text-xs"
        onChange={e => commit(e.target.value)} />
    );
  }

  return (
    <input
      type={col.type === 'number' ? 'number' : 'text'}
      defaultValue={value}
      key={value}
      aria-label={col.title}
      className="tl-inline w-full px-1 text-xs"
      onBlur={e => { if (e.target.value !== value) commit(e.target.value); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

function PersonPicker({ value, members, onPick }) {
  const { t } = useI18n();
  const [name, setName] = useState(value);
  return (
    <>
      <input
        autoFocus value={name} placeholder={t('Type a name…')} aria-label={t('Name')}
        className="ui-input"
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onPick(name.trim()); }}
      />
      {members.map(m => (
        <button key={m} type="button" className="tl-menu-item" aria-current={m === value || undefined}
          onClick={() => onPick(m)}>
          <Avatar name={m} size={20} />{m}
        </button>
      ))}
      {value && (
        <button type="button" className="tl-menu-item" onClick={() => onPick('')}>
          {t('Unassign')}
        </button>
      )}
    </>
  );
}

function AddItemInput({ board, group, updateBoard }) {
  const { t } = useI18n();
  const { failed } = usePopover();
  const [name, setName] = useState('');
  return (
    <input
      value={name}
      onChange={e => setName(e.target.value)}
      onKeyDown={async e => {
        if (e.key === 'Enter' && name.trim()) {
          try {
            const item = await api.createItem(board.id, group.id, name.trim());
            updateBoard(board.id, b => ({
              ...b,
              groups: b.groups.map(g => (g.id === group.id ? { ...g, items: [...g.items, item] } : g)),
            }));
            setName('');
          } catch (err) { failed(err); }
        }
      }}
      placeholder={`+ ${t('Add item')}`}
      aria-label={t('Add item')}
      className="tl-inline w-full px-1 text-xs"
    />
  );
}

function AddColumnForm({ board, updateBoard, close }) {
  const { t } = useI18n();
  const { failed } = usePopover();
  const [title, setTitle] = useState('');
  const types = [
    ['text', '📝', t('Text')],
    ['status', '🎨', t('Status')],
    ['person', '👤', t('Person')],
    ['date', '📅', t('Date')],
    ['number', '#️⃣', t('Number')],
  ];
  return (
    <>
      <input
        autoFocus value={title} placeholder={t('Column title')} aria-label={t('Column title')}
        className="ui-input"
        onChange={e => setTitle(e.target.value)}
      />
      <div className="tl-menu-label">{t('Kind')}</div>
      {types.map(([type, icon, label]) => (
        <button key={type} type="button" className="tl-menu-item"
          onClick={async () => {
            close();
            try {
              const col = await api.createColumn(board.id, title.trim() || label, type);
              updateBoard(board.id, b => ({ ...b, columns: [...b.columns, col] }));
            } catch (e) { failed(e); }
          }}>
          <span aria-hidden="true">{icon}</span>{label}
        </button>
      ))}
    </>
  );
}
