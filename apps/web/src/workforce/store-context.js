import { createContext, useContext } from 'react';

export const CACHE_KEY = 'master-workforce-cache';
export const Ctx = createContext(null);
/** Planning data and actions; see store.jsx. */
export const useWorkforce = () => useContext(Ctx);
