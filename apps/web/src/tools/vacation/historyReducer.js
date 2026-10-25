export const HISTORY_CAP = 50;

export const initHistory = present => ({ past: [], present, future: [] });

export function historyReducer(state, action) {
  switch (action.type) {
    // Replace present without touching history — used when adopting the
    // server copy of the workspace on load (not an undoable user action).
    case 'REPLACE': {
      return { ...state, present: action.state };
    }
    case 'SET': {
      const next = action.updater(state.present);
      if (next === state.present) return state;
      const past = [...state.past, state.present].slice(-HISTORY_CAP);
      return { past, present: next, future: [] };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
      };
    }
    default:
      return state;
  }
}
