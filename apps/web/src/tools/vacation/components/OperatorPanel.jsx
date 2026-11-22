import { useState } from 'react';
import { PROCESSES } from '../data';
import { useI18n } from '../../../i18n';
import { Button, Checkbox, Pill } from '../../../ui';
import { Confirm, Field, Input, Select } from '../../../workforce/ui';

/* In the planning model the team and the competencies belong to the profile
 * in People and are only shown here. An unlinked operator's old S1/S2 and
 * process list stay in the saved data, shown read-only until it is linked. */
function PlanningFacts({ op, info, teamName, procName, t }) {
  const facts = (label, value) => (
    <div>
      <div className="mb-1 text-xs font-semibold text-ink-3">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
  if (!info) {
    return (
      <>
        <p className="text-xs text-ink-3">{t('Not linked, so it counts toward no coverage. Its old values are kept.')}</p>
        {facts(t('Old shift'), op.shift)}
        {facts(t('Old certifications'), (op.certifications || []).join(', ') || '—')}
      </>
    );
  }
  return (
    <>
      {facts(t('Team'), teamName(info.teamId) || t('No team'))}
      {facts(t('Competencies'), info.certifications.map(procName).join(', ') || '—')}
      <p className="text-xs text-ink-3">{t('Team and competencies come from People.')}</p>
    </>
  );
}

export default function OperatorPanel({ operators, onUpdateOperator, showMgmt, onToggleMgmt, onAddOperator, onRemoveOperator, onDownloadTemplate, collapsed, onToggleCollapse, people = null, onLinkOperator, model = null }) {
  const { t } = useI18n();
  const [editId, setEditId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newShift, setNewShift] = useState('S1');
  const [search, setSearch] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddOperator(newName.trim(), newShift);
    setNewName('');
  };

  const teamName = id => model?.teams.find(tm => tm.id === id)?.name;
  const procName = key => model?.processes.find(p => p.key === key)?.name || key;
  const infoOf = op => (model && op.personId ? model.byPerson.get(op.personId) : null);

  const q = search.trim().toLowerCase();
  const filteredOperators = q
    ? operators.filter(op => op.name.toLowerCase().includes(q))
    : operators;

  return (
    <div className={`tl-oppanel tl-side relative z-20 flex h-full flex-col overflow-y-auto ${collapsed ? 'sidebar-collapsed' : ''}`}>

      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-2">
        <button type="button" onClick={onToggleCollapse} className="tl-icon"
          aria-label={collapsed ? t('Show the operator list') : t('Hide the operator list')}
          title={collapsed ? t('Show the operator list') : t('Hide the operator list')}
          aria-expanded={!collapsed}>
          {collapsed ? '▶' : '◀'}
        </button>
        <span className="sidebar-full-only tl-heading min-w-0 flex-1 truncate">{t('Operators')}</span>
        <div className="sidebar-full-only flex gap-1">
          {onDownloadTemplate && <Button onClick={onDownloadTemplate} title={t('Download a CSV template')} className="!min-h-[30px] whitespace-nowrap !px-2 text-xs">CSV</Button>}
          {!showMgmt && (
            <Button variant="primary" onClick={onToggleMgmt} className="!min-h-[30px] whitespace-nowrap !px-2 text-xs">{model ? t('Manage') : `+ ${t('Add')}`}</Button>
          )}
        </div>
      </div>

      {/* Add operator */}
      {showMgmt && (
        <div className="sidebar-full-only wf-view !h-auto flex flex-col gap-2 border-b border-line bg-soft p-3">
          <div className="tl-heading">{model ? t('Manage operators') : t('Add operator')}</div>
          {model && <p className="text-xs text-ink-3">{t('People are added in People and appear here by themselves. Only an old operator that is not linked can be removed here.')}</p>}
          {!model && <Input type="text" placeholder={t('Name')} aria-label={t('Name')} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />}
          {!model && <div className="flex gap-2">
            <Select value={newShift} aria-label={t('Shift')} onChange={e => setNewShift(e.target.value)} className="flex-1">
              <option value="S1">S1</option><option value="S2">S2</option>
            </Select>
            <Button variant="primary" onClick={handleAdd}>{t('Add')}</Button>
          </div>}
          {onDownloadTemplate && <Button onClick={onDownloadTemplate} className="text-xs">↓ {t('Download a CSV template')}</Button>}
          <Button onClick={onToggleMgmt}>{t('Done')}</Button>
        </div>
      )}

      {/* Search */}
      <div className="sidebar-full-only px-3 pb-1 pt-2">
        <div className="relative">
          <Input type="text" placeholder={t('Search operators')} value={search}
            aria-label={t('Search operators')}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-8" />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label={t('Clear search')}
              className="tl-icon absolute right-1 top-1/2 -translate-y-1/2">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Operator list */}
      <div className="sidebar-full-only flex-1 space-y-1 overflow-y-auto p-2">
        {filteredOperators.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-ink-3">{t('No matches')}</div>
        )}
        {filteredOperators.map(op => {
          const open = editId === op.id;
          const linked = !!(op.personId && people?.some(p => p.id === op.personId));
          return (
            <div key={op.id} className={`rounded-control ${open ? 'bg-panel shadow-panel' : ''}`}>
              <div className="tl-oprow flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-sm"
                style={{ opacity: op.active ? 1 : 0.45 }}
                role="button" tabIndex={0} aria-expanded={open}
                onClick={() => setEditId(open ? null : op.id)}
                onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setEditId(open ? null : op.id); }}>
                <span className="flex-1 truncate font-medium">{op.name}</span>
                {people && !op.personId && <span className="text-[10px] font-semibold text-ink-3" title={t('Not linked to a profile in People')}>{t('unlinked')}</span>}
                <Pill>{model && op.personId ? (teamName(infoOf(op)?.teamId) || t('No team')) : op.shift}</Pill>
              </div>

              {open && (
                <div className="wf-view !h-auto flex flex-col gap-3 px-3 pb-4 pt-1">
                  <Field label={t('Name')}>
                    <Input type="text" value={op.name} onChange={e => onUpdateOperator(op.id, { name: e.target.value })}
                      disabled={!!op.personId} title={op.personId ? t('The name comes from the profile in People') : undefined} />
                  </Field>
                  {op.personId && (
                    <p className="text-xs text-ink-3">
                      {t('Linked to a profile; change the name there.')}{' '}
                      <a href={`#/people/${op.personId}`} className="ui-focus underline">{t('Open in People')}</a>
                    </p>
                  )}
                  {!op.personId && people && (
                    <Field label={t('Not linked to a profile')}>
                      <Select value="" aria-label={t('Link {name} to a profile', { name: op.name })} onChange={e => e.target.value && onLinkOperator(op.id, e.target.value)}>
                        <option value="">{t('Link to a profile…')}</option>
                        {people.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    </Field>
                  )}
                  {model ? (
                    <PlanningFacts op={op} info={infoOf(op)} teamName={teamName} procName={procName} t={t} />
                  ) : (
                    <>
                      <Field label={t('Shift')}>
                        <Select value={op.shift} onChange={e => onUpdateOperator(op.id, { shift: e.target.value })}>
                          <option value="S1">S1</option><option value="S2">S2</option>
                        </Select>
                      </Field>
                      <div>
                        <div className="mb-1 text-xs font-semibold text-ink-3">{t('Certifications')}</div>
                        <div className="flex flex-col">
                          {PROCESSES.map(p => (
                            <Checkbox key={p} checked={op.certifications.includes(p)}
                              onChange={e => {
                                const certs = e.target.checked ? [...op.certifications, p] : op.certifications.filter(c => c !== p);
                                onUpdateOperator(op.id, { certifications: certs });
                              }}>
                              {p}
                            </Checkbox>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <Checkbox checked={op.active} onChange={e => onUpdateOperator(op.id, { active: e.target.checked })}>{t('Active')}</Checkbox>
                  {showMgmt && !linked && (
                    <Button variant="danger" onClick={() => setConfirmRemove(op)}>{t('Remove operator')}</Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmRemove && (
        <Confirm danger title={t('Remove operator?')} confirmLabel={t('Remove')}
          body={t('{name} and their vacation blocks are removed. You can undo this.', { name: confirmRemove.name })}
          onConfirm={() => { onRemoveOperator(confirmRemove.id); setEditId(null); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)} />
      )}
    </div>
  );
}
