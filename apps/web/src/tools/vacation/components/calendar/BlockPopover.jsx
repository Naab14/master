import { useEffect, useRef, useState } from 'react';
import { STATUS_COLORS, STATUS_LABELS, STATUSES } from './constants';

export default function BlockPopover({ x, y, block, dateStr, onSetStatus, onDelete, onSetDayStatus, onClearDayStatus, onSetNote, onClose }) {
  const ref = useRef(null);
  const [noteDraft, setNoteDraft] = useState(block?.note || '');

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const keyHandler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler); };
  }, [onClose]);

  if (!block) return null;

  const commitNote = () => {
    if (!onSetNote) return;
    if (noteDraft === (block.note || '')) return;
    onSetNote(block.id, noteDraft);
  };

  const dayStatus = dateStr ? (block.dayStatuses?.[dateStr] || block.status) : null;
  const hasOverride = dateStr && block.dayStatuses?.[dateStr];

  return (
    <div ref={ref} className="block-popover" style={{ left: x, top: y }}>
      {/* Per-day status section (shown when opened from day-zoom) */}
      {dateStr && (
        <>
          <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Day: {dateStr}
          </div>
          {STATUSES.map(s => (
            <button key={`day-${s}`} onClick={() => {
              if (s === block.status && hasOverride) {
                onClearDayStatus(block.id, dateStr);
              } else if (s !== block.status) {
                onSetDayStatus(block.id, dateStr, s);
              }
              onClose();
            }}
              className="w-full text-left px-3 py-1.5 text-sm hover:opacity-80 flex items-center gap-2"
              style={{ background: dayStatus === s ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text-primary)' }}>
              <span className="w-3 h-3 rounded-sm inline-block"
                style={{ background: STATUS_COLORS[s].bg, border: `1px solid ${STATUS_COLORS[s].border}`,
                  ...(s === 'requested' ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', borderStyle: 'dashed' } : {})
                }} />
              {STATUS_LABELS[s]}
              {s === block.status && !hasOverride && <span className="ml-auto text-[10px] opacity-50">(block default)</span>}
              {hasOverride && s === block.dayStatuses[dateStr] && <span className="ml-auto text-[10px]" style={{ color: 'var(--accent)' }}>●</span>}
            </button>
          ))}
          {hasOverride && (
            <button onClick={() => { onClearDayStatus(block.id, dateStr); onClose(); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}>
              Reset to block default ({STATUS_LABELS[block.status]})
            </button>
          )}
          <hr style={{ borderColor: 'var(--border)' }} className="my-1" />
        </>
      )}

      {/* Block-level status section */}
      <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        {dateStr ? 'Entire Block' : 'Status'}
      </div>
      {STATUSES.map(s => (
        <button key={s} onClick={() => { onSetStatus(block.id, s); onClose(); }}
          className="w-full text-left px-3 py-1.5 text-sm hover:opacity-80 flex items-center gap-2"
          style={{ background: !dateStr && block.status === s ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text-primary)' }}>
          <span className="w-3 h-3 rounded-sm inline-block"
            style={{ background: STATUS_COLORS[s].bg, border: `1px solid ${STATUS_COLORS[s].border}`,
              ...(s === 'requested' ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', borderStyle: 'dashed' } : {})
            }} />
          {STATUS_LABELS[s]}
        </button>
      ))}
      {onSetNote && (
        <>
          <hr style={{ borderColor: 'var(--border)' }} className="my-1" />
          <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Note
          </div>
          <div className="px-3 pb-2">
            <textarea
              aria-label="Block note"
              placeholder="Add a note…"
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
              className="w-full text-sm rounded p-2"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', resize: 'vertical', minHeight: 48 }}
            />
          </div>
        </>
      )}
      <hr style={{ borderColor: 'var(--border)' }} className="my-1" />
      <button onClick={() => { onDelete(block.id); onClose(); }}
        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Delete</button>
    </div>
  );
}
