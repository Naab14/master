export const CELL_W = 68;
export const CELL_H = 32;
export const LABEL_W = 130;

export const STATUS_COLORS = {
  draft: { bg: 'var(--draft-bg)', border: 'var(--draft-border)' },
  pending: { bg: 'var(--pending-bg)', border: 'var(--pending-border)' },
  approved: { bg: 'var(--approved-bg)', border: 'var(--approved-border)' },
  requested: { bg: 'var(--requested-bg)', border: 'var(--requested-border)' },
};

export const STATUS_LABELS = { draft: 'Utkast', pending: 'Väntande', approved: 'Godkänd', requested: 'Begärd' };
export const STATUSES = ['draft', 'pending', 'approved', 'requested'];
export const SWEDISH_DAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export const HOLIDAY_ABBREV = {
  'Annandag påsk': 'Annandag', 'Första maj': 'Första m', 'Första Maj': 'Första m',
  'Kristi himmelsfärdsdag': 'Kristi h', 'Kristi himmelfärdsdag': 'Kristi h',
  'Pingstdagen': 'Pingstda', 'Nationaldagen': 'Sveriges', 'Sveriges nationaldag': 'Sveriges',
  'Midsommarafton': 'Midsom.', 'Midsommardagen': 'Midsom.',
  'Långfredagen': 'Långfre', 'Påskdagen': 'Påskdag',
  'Trettondedag jul': 'Trett.', 'Nyårsdagen': 'Nyår', 'Julafton': 'Julaft',
  'Juldagen': 'Juldag', 'Annandag jul': 'Ann.jul', 'Nyårsafton': 'Nyårsaf',
  'Alla helgons dag': 'Alla h', 'Alla Helgons dag': 'Alla h',
};
