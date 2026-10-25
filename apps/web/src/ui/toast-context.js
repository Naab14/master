import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/* toast('Saved') or toast('Task deleted', { action: { label: 'Undo', onClick } }) */
export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast needs a <ToastProvider> above it');
  return toast;
}
