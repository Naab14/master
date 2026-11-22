/* One operator identity shared with workforce planning.
 *
 * A Vacations operator points at a People profile by id (`personId`). The
 * profile owns the name; Vacations keeps only what is its own (S1/S2 and its
 * process list). Nothing here matches by name: an older operator without a
 * `personId` stays unlinked until someone links it by hand.
 */

/**
 * Bring the operator list in line with the profiles.
 * @param operators  Vacations operators
 * @param people     profiles: [{ id, name, endDate? }]
 * @param today      'YYYY-MM-DD'
 * @returns the same array when nothing changes (so callers can compare by identity)
 */
export function syncOperatorsWithPeople(operators, people, today) {
  const byPerson = new Map();
  for (const op of operators) if (op.personId) byPerson.set(op.personId, op);
  let changed = false;
  const next = operators.map(op => {
    if (!op.personId) return op;
    const p = people.find(x => x.id === op.personId);
    if (!p) return op; // the profile was removed: keep the operator and its history
    const active = op.active && !(p.endDate && today && p.endDate < today);
    if (op.name === p.name && op.active === active) return op;
    changed = true;
    return { ...op, name: p.name, active };
  });
  for (const p of people) {
    if (byPerson.has(p.id)) continue;
    changed = true;
    next.push({ id: `wf-${p.id}`, personId: p.id, name: p.name, shift: 'S1', active: !(p.endDate && today && p.endDate < today), certifications: [] });
  }
  return changed ? next : operators;
}

/** An operator the sync created itself and nobody has changed: nothing in it can be lost. */
const isPristineTwin = (state, o) =>
  String(o.id).startsWith('wf-') && !(o.certifications || []).length && o.active !== false && !o.mergedFrom?.length
    && !state.vacationBlocks.some(b => b.operatorId === o.id);

const overlaps = (a, b) => a.startWeek <= b.endWeek && b.startWeek <= a.endWeek;

/**
 * Would linking `operatorId` to `personId` need a decision first?
 * - null: it goes straight through (no operator holds that profile yet, or it
 *   holds an empty one the sync made).
 * - { reason: 'confirm', twin }: the profile's operator has data of its own;
 *   linking merges the two and needs the user's yes.
 * - { reason: 'overlap', twin }: both have vacation blocks in the same weeks.
 *   The grid shows one block per week, so merging would hide one of them.
 */
export function linkBlocked(state, operatorId, personId) {
  const twin = state.operators.find(o => o.personId === personId);
  if (!twin || isPristineTwin(state, twin)) return null;
  const mine = state.vacationBlocks.filter(b => b.operatorId === operatorId);
  const theirs = state.vacationBlocks.filter(b => b.operatorId === twin.id);
  if (mine.some(a => theirs.some(b => overlaps(a, b)))) return { reason: 'overlap', twin };
  return { reason: 'confirm', twin };
}

/**
 * Link an older, unlinked operator to a profile by hand.
 * An empty twin the sync created is replaced by the older operator. A twin
 * with data of its own is merged only with `confirmMerge`, and never when the
 * blocks overlap: all blocks are kept (re-pointed to the older operator) and
 * the twin's whole record stays on the operator as `mergedFrom`, so nothing is
 * lost. Otherwise the state is returned unchanged.
 */
export function linkOperator(state, operatorId, personId, people, { confirmMerge = false } = {}) {
  const op = state.operators.find(o => o.id === operatorId);
  const person = people.find(p => p.id === personId);
  if (!op || !person || op.personId) return state;
  const twin = state.operators.find(o => o.personId === personId);
  const blocked = linkBlocked(state, operatorId, personId);
  if (blocked && (blocked.reason === 'overlap' || !confirmMerge)) return state;
  const kept = twin && blocked
    ? [...(op.mergedFrom || []), { ...twin }]
    : op.mergedFrom;
  return {
    ...state,
    operators: state.operators.filter(o => o !== twin).map(o => (o.id === operatorId ? { ...o, personId, name: person.name, ...(kept ? { mergedFrom: kept } : {}) } : o)),
    vacationBlocks: twin ? state.vacationBlocks.map(b => (b.operatorId === twin.id ? { ...b, operatorId } : b)) : state.vacationBlocks,
  };
}

export const unlinkedOperators = operators => operators.filter(o => !o.personId);
