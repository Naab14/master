let _hd = null;
let _cache = {};

function getISOWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
}

async function getHolidayInstance() {
  if (_hd) return _hd;
  const { default: Holidays } = await import('date-holidays');
  _hd = new Holidays('SE');
  return _hd;
}

function buildMapFromHolidays(hd, year) {
  const all = hd.getHolidays(year);
  const relevant = all.filter(h => h.type === 'public' || h.type === 'bank');
  const map = {};
  for (const h of relevant) {
    const dateStr = h.date.slice(0, 10);
    const week = getISOWeek(dateStr);
    if (week < 1 || week > 52) continue;
    if (!map[week]) map[week] = { holidays: [] };
    const exists = map[week].holidays.some(x => x.name === h.name);
    if (!exists) map[week].holidays.push({ name: h.name, dateStr, year });
  }
  return map;
}

/**
 * Build a lookup: { [weekNumber]: { holidays: [{ name, dateStr }] } }
 * Returns cached result synchronously if available, otherwise empty map.
 * Call initHolidays() at app start to warm the cache.
 */
export function buildHolidayMap(year) {
  const y = year ?? new Date().getFullYear();
  if (_cache[y]) return _cache[y];
  // Synchronous fallback: try if instance is already loaded
  if (_hd) {
    _cache[y] = buildMapFromHolidays(_hd, y);
    return _cache[y];
  }
  return {};
}

/**
 * Initialize the holiday system (async). Call once at app startup.
 * After this resolves, buildHolidayMap() returns data synchronously.
 */
export async function initHolidays(year) {
  const y = year ?? new Date().getFullYear();
  const hd = await getHolidayInstance();
  _cache[y] = buildMapFromHolidays(hd, y);
  return _cache[y];
}
