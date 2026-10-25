import { useId } from 'react';

/* Labelled input. Pass `hint` for help text and `error` to mark it invalid;
 * both are announced with the field. Other props go to the <input>. */
export default function TextField({ label, hint, error, className = '', inputClassName = '', ...rest }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`ui-input ${inputClassName}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && <small id={`${id}-hint`} className="ui-field__hint">{hint}</small>}
      {error && <small id={`${id}-error`} className="ui-field__error">{error}</small>}
    </div>
  );
}
