// ── Processes / Certifications ────────────────────────────────────────────────
export const PROCESSES = [
  'Avsyning',
  'Kapselresaren',
  'Serialisering',
  'Etikettering',
  'Granskning/uttag av dok',
];

// ── Seed Operators ───────────────────────────────────────────────────────────
export const seedOperators = [
  { id: 'op1',  name: 'Anna Lindgren',   shift: 'S1', active: true, certifications: ['Avsyning', 'Serialisering', 'Granskning/uttag av dok'] },
  { id: 'op2',  name: 'Erik Holm',       shift: 'S1', active: true, certifications: ['Kapselresaren', 'Etikettering'] },
  { id: 'op3',  name: 'Sara Björk',      shift: 'S1', active: true, certifications: ['Avsyning', 'Kapselresaren', 'Serialisering'] },
  { id: 'op4',  name: 'Johan Nyman',     shift: 'S1', active: true, certifications: ['Serialisering', 'Granskning/uttag av dok'] },
  { id: 'op5',  name: 'Klara Dahl',      shift: 'S1', active: true, certifications: ['Etikettering', 'Avsyning'] },
  { id: 'op6',  name: 'Oscar Lund',      shift: 'S1', active: true, certifications: ['Kapselresaren', 'Serialisering'] },
  { id: 'op7',  name: 'Maja Ek',         shift: 'S1', active: true, certifications: ['Avsyning', 'Etikettering', 'Kapselresaren'] },
  { id: 'op8',  name: 'Lars Berg',       shift: 'S1', active: true, certifications: ['Serialisering', 'Etikettering'] },
  { id: 'op9',  name: 'Hanna Sjögren',   shift: 'S2', active: true, certifications: ['Avsyning', 'Serialisering'] },
  { id: 'op10', name: 'Emil Strand',     shift: 'S2', active: true, certifications: ['Kapselresaren', 'Granskning/uttag av dok'] },
  { id: 'op11', name: 'Frida Nordin',    shift: 'S2', active: true, certifications: ['Etikettering', 'Avsyning', 'Serialisering'] },
  { id: 'op12', name: 'Gustav Wallin',   shift: 'S2', active: true, certifications: ['Kapselresaren', 'Etikettering'] },
  { id: 'op13', name: 'Lina Åberg',      shift: 'S2', active: true, certifications: ['Avsyning', 'Granskning/uttag av dok'] },
  { id: 'op14', name: 'Nils Persson',    shift: 'S2', active: true, certifications: ['Serialisering', 'Kapselresaren'] },
  { id: 'op15', name: 'Elin Moberg',     shift: 'S2', active: true, certifications: ['Etikettering', 'Avsyning'] },
  { id: 'op16', name: 'Axel Svensson',   shift: 'S2', active: true, certifications: ['Kapselresaren', 'Serialisering', 'Etikettering'] },
];

// ── Seed Vacation Blocks ─────────────────────────────────────────────────────
export const seedVacationBlocks = [
  { id: 'vb1',  operatorId: 'op1',  startWeek: 16, endWeek: 18, status: 'approved' },
  { id: 'vb2',  operatorId: 'op3',  startWeek: 20, endWeek: 22, status: 'pending' },
  { id: 'vb3',  operatorId: 'op5',  startWeek: 17, endWeek: 17, status: 'draft' },
  { id: 'vb4',  operatorId: 'op7',  startWeek: 24, endWeek: 26, status: 'approved' },
  { id: 'vb5',  operatorId: 'op2',  startWeek: 19, endWeek: 21, status: 'pending' },
  { id: 'vb6',  operatorId: 'op9',  startWeek: 15, endWeek: 16, status: 'approved' },
  { id: 'vb7',  operatorId: 'op11', startWeek: 22, endWeek: 24, status: 'draft' },
  { id: 'vb8',  operatorId: 'op14', startWeek: 18, endWeek: 19, status: 'pending' },
  { id: 'vb9',  operatorId: 'op10', startWeek: 25, endWeek: 26, status: 'approved' },
  { id: 'vb10', operatorId: 'op16', startWeek: 20, endWeek: 23, status: 'draft' },
];

// ── Default Demand (2 per process per week across 52 weeks) ──────────────────
export function buildDefaultDemand() {
  const d = {};
  for (const p of PROCESSES) {
    d[p] = {};
    for (let w = 1; w <= 52; w++) d[p][w] = 2;
  }
  return d;
}

// ── Default Settings ─────────────────────────────────────────────────────────
export const defaultSettings = {
  shiftMode: 'separate',
  visibleWeeks: 12,
  startWeek: 15,
};

// ── Themes ───────────────────────────────────────────────────────────────────
export const themes = [
  { id: 'default', label: 'Default' },
  { id: 'motherduck', label: 'MotherDuck' },
  { id: 'dark', label: 'Dark' },
  { id: 'ocean', label: 'Ocean' },
];
