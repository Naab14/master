/* A card on the page: panel surface, hairline border, panel radius. Cards on
 * the page use a border; shadow-panel is kept for things that float. */
export default function Panel({ title, meta, className = '', children, ...rest }) {
  return (
    <section className={`ui-panel ${className}`.trim()} {...rest}>
      {(title || meta) && (
        <div className="ui-panel__head">
          {title && <h2 className="t-section">{title}</h2>}
          {meta && <span className="t-label">{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
