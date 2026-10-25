import { useRef } from 'react';

/* Segmented control: one choice out of a few (Table | Kanban). A radio group:
 * Tab enters it, arrow keys move between options. */
export default function Segmented({ options, value, onChange, label, className = '' }) {
  const refs = useRef([]);
  const index = Math.max(0, options.findIndex(o => o.value === value));

  const onKeyDown = e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next;
    if (step) next = (index + step + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={`ui-seg ${className}`.trim()} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={el => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={i === index}
          tabIndex={i === index ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
