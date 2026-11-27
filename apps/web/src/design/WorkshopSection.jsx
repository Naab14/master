/* One numbered section of the design workshop. */
export default function WorkshopSection({ id, step, title, intro, children }) {
  return (
    <section id={id} className="dw-section">
      <header className="dw-section__head">
        <span className="dw-step t-num">{step}</span>
        <div>
          <h2 className="t-section">{title}</h2>
          {intro && <p className="t-body" style={{ color: 'var(--ink-2)' }}>{intro}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
