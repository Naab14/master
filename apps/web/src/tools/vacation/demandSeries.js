/* Copying one process's weekly demand into another.
 * Weeks without a value in the target are filled from the source. Weeks that
 * already have a different value are counted as conflicts and replaced only
 * when `replace` is true. A value of 0 is a value. Inputs are not modified. */
export function mergeDemandSeries(target, source, replace = false) {
  // A missing or null series (an old or imported file) counts as empty
  const series = { ...(target || {}) };
  source = source || {};
  let conflicts = 0;
  for (const [week, value] of Object.entries(source)) {
    if (series[week] === undefined) series[week] = value;
    else if (series[week] !== value) { conflicts++; if (replace) series[week] = value; }
  }
  return { series, conflicts };
}
