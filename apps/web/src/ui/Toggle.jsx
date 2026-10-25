/* On/off switch for settings that apply at once. Space or Enter flips it. */
export default function Toggle({ checked, onChange, label, className = '', disabled }) {
  return (
    <label className={`ui-toggle-wrap ${className}`.trim()}>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        className="ui-toggle"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
      {label}
    </label>
  );
}
