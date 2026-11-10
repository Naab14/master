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

/**
 * Link an older, unlinked operator to a profile by hand. If the profile
 * already has an operator (created by the sync), the two are merged: the
 * older one keeps its shift, certifications and vacation blocks.
 */
export function linkOperator(state, operatorId, personId, people) {
  const op = state.operators.find(o => o.id === operatorId);
  const person = people.find(p => p.id === personId);
  if (!op || !person || op.personId) return state;
  const twin = state.operators.find(o => o.personId === personId);
  return {
    ...state,
    operators: state.operators.filter(o => o !== twin).map(o => (o.id === operatorId ? { ...o, personId, name: person.name } : o)),
    vacationBlocks: twin ? state.vacationBlocks.map(b => (b.operatorId === twin.id ? { ...b, operatorId } : b)) : state.vacationBlocks,
  };
}

export const unlinkedOperators = operators => operators.filter(o => !o.personId);
