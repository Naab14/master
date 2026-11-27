/* One number with its meaning. With `total` it shows value/total and a bar;
 * tone (ok | warn | bad) colours both. The label says what is counted, so
 * colour is never the only signal. */
export default function StatTile({ label, value, total, tone, note, className = '' }) {
  const pct = total ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
  return (
    <div className={`ui-stat ${tone ? `ui-stat--${tone}` : ''} ${className}`.trim()}>
      <span className="t-label">{label}</span>
      <span className="ui-stat__value">{total != null ? `${value}/${total}` : value}</span>
      {total != null && (
        <div className="ui-stat__bar" role="img" aria-label={`${pct}%`}><span style={{ width: `${pct}%` }} /></div>
      )}
      {note && <span className="t-label">{note}</span>}
    </div>
  );
}
