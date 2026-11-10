/* Status pill. tone: ok | warn | bad | idle (coverage and work status) or
 * approved | pending | draft | requested (leave). Color is never the only
 * signal: the label always says the status in words. */
export default function Pill({ tone = 'idle', className = '', children, ...rest }) {
  return <span className={`ui-pill ui-pill--${tone} ${className}`.trim()} {...rest}>{children}</span>;
}
