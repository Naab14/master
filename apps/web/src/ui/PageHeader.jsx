/* Top of a screen: optional eyebrow label, the title in the display face,
 * and actions on the right that wrap below on phones. */
export default function PageHeader({ title, eyebrow, className = '', children }) {
  return (
    <header className={`ui-pagehead ${className}`.trim()}>
      <div>
        {eyebrow && <p className="t-label">{eyebrow}</p>}
        <h1 className="t-title">{title}</h1>
      </div>
      {children && <div className="ui-pagehead__actions">{children}</div>}
    </header>
  );
}
