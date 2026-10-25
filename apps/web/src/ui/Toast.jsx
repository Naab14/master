import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContext } from './toast-context';

const DURATION = 5000;

/* Short messages at the bottom of the screen, read out by screen readers.
 * A toast with an action (Undo) stays for DURATION, then closes itself;
 * hovering or focusing it keeps it open. */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback(id => setToasts(list => list.filter(t => t.id !== id)), []);
  const toast = useCallback((message, { action } = {}) => {
    const id = nextId.current++;
    setToasts(list => [...list.slice(-2), { id, message, action }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onDismiss(toast.id), DURATION);
    return () => clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);
  return (
    <div className="ui-toast" onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="ui-toast__btn"
          onClick={() => { toast.action.onClick(); onDismiss(toast.id); }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="ui-toast__btn ui-toast__close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
        ✕
      </button>
    </div>
  );
}
