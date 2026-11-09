/* Checkbox with its label; the whole row is clickable. */
export default function Checkbox({ label, children, className = '', ...rest }) {
  return (
    <label className={`ui-check ${className}`.trim()}>
      <input type="checkbox" {...rest} />
      {label ?? children}
    </label>
  );
}
