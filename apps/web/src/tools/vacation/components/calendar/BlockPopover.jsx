import { useEffect, useRef, useState } from 'react';
import { STATUS_COLORS, STATUS_LABELS, STATUSES } from './constants';
import { useI18n } from '../../../../i18n';

const HATCH = { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', borderStyle: 'dashed' };
const swatch = s => ({ background: STATUS_COLORS[s].bg, border: `1px solid ${STATUS_COLORS[s].border}`, ...(s === 'requested' ? HATCH : {}) });

export default function BlockPopover({ x, y, block, dateStr, onSetStatus, onDelete, onSetDayStatus, onClearDayStatus, onSetNote, onClose }) {
  const { t, fmt } = useI18n();
  const ref = useRef(null);
  const [noteDraft, setNoteDraft] = useState(block?.note || '');

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const keyHandler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler); };
  }, [onClose]);

  // Keep the menu inside the window when it opens near an edge.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) el.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
    if (r.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
  }, [x, y]);

  if (!block) return null;

  const commitNote = () => {
    if (!onSetNote) return;
    if (noteDraft === (block.note || '')) return;
    onSetNote(block.id, noteDraft);
  };

  const dayStatus = dateStr ? (block.dayStatuses?.[dateStr] || block.status) : null;
  const hasOverride = dateStr && block.dayStatuses?.[dateStr];

  return (
    <div ref={ref} role="dialog" className="block-popover tl-pop" style={{ left: x, top: y }}>
      {/* Per-day status section (shown when opened from day-zoom) */}
      {dateStr && (
        <>
          <div className="tl-menu-label">{t('Day: {date}', { date: fmt.date(dateStr) })}</div>
          {STATUSES.map(s => (
            <button key={`day-${s}`} type="button" className="tl-menu-item" aria-current={dayStatus === s || undefined}
              onClick={() => {
                if (s === block.status && hasOverride) {
                  onClearDayStatus(block.id, dateStr);
                } else if (s !== block.status) {
                  onSetDayStatus(block.id, dateStr, s);
                }
                onClose();
              }}>
              <span className="inline-block h-3 w-3 rounded-sm" style={swatch(s)} />
              {t(STATUS_LABELS[s])}
              {s === block.status && !hasOverride && <span className="ml-auto text-[10px] text-ink-3">{t('(whole block)')}</span>}
              {hasOverride && s === block.dayStatuses[dateStr] && <span className="ml-auto text-[10px]" aria-hidden="true">●</span>}
            </button>
          ))}
          {hasOverride && (
            <button type="button" className="tl-menu-item text-xs text-ink-3" onClick={() => { onClearDayStatus(block.id, dateStr); onClose(); }}>
              {t('Back to the block’s status ({status})', { status: t(STATUS_LABELS[block.status]) })}
            </button>
          )}
          <hr className="tl-menu-rule" />
        </>
      )}

      {/* Block-level status section */}
      <div className="tl-menu-label">{dateStr ? t('Whole block') : t('Status')}</div>
      {STATUSES.map(s => (
        <button key={s} type="button" className="tl-menu-item" aria-current={(!dateStr && block.status === s) || undefined}
          onClick={() => { onSetStatus(block.id, s); onClose(); }}>
          <span className="inline-block h-3 w-3 rounded-sm" style={swatch(s)} />
          {t(STATUS_LABELS[s])}
        </button>
      ))}
      {onSetNote && (
        <>
          <hr className="tl-menu-rule" />
          <div className="tl-menu-label">{t('Note')}</div>
          <div className="px-2 pb-2">
            <textarea
              aria-label={t('Block note')}
              placeholder={t('Add a note…')}
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onBlur={commitNote}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  commitNote();
                  onClose();
                }
              }}
              rows={3}
              className="ui-input tl-textarea w-full"
              style={{ minHeight: 48 }}
            />
          </div>
        </>
      )}
      <hr className="tl-menu-rule" />
      <button type="button" className="tl-menu-item tl-menu-item--danger" onClick={() => { onDelete(block.id); onClose(); }}>{t('Delete')}</button>
    </div>
  );
}
