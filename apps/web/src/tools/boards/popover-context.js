import { createContext, useContext } from 'react';

/* One floating popover at a time, anchored to the element that opened it —
 * same interaction model as the original Frieday frontend. Provided by
 * BoardsTool, consumed by cells and menus. */
export const PopoverCtx = createContext(null);
export const usePopover = () => useContext(PopoverCtx);
