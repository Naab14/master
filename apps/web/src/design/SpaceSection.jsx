const SPACE = [['space-1', 4], ['space-2', 8], ['space-3', 12], ['space-4', 16], ['space-6', 24], ['space-8', 32], ['space-12', 48], ['touch', 44]];
const RADII = ['radius-pill', 'radius-control', 'radius-panel'];

/* Spacing steps, corner radii and the one shadow, drawn at real size. */
export default function SpaceSection() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ui-panel">
        <h3 className="t-section">Spacing · 4px base</h3>
        {SPACE.map(([n, px]) => (
          <div key={n} className="dw-space">
            <code>{n}</code>
            <span className="dw-space__bar" style={{ width: `var(--${n})` }} />
            <span className="t-label t-num">{px}px</span>
          </div>
        ))}
      </div>
      <div className="ui-panel">
        <h3 className="t-section">Corners and depth</h3>
        <div className="flex flex-wrap gap-4">
          {RADII.map(r => (
            <div key={r} className="flex flex-col items-center gap-2">
              <span className="dw-radius" style={{ borderRadius: `var(--${r})` }} />
              <code>{r}</code>
            </div>
          ))}
        </div>
        <div className="dw-float">
          <span className="t-body">shadow-panel</span>
          <span className="t-label">Only for things that float: sheets, dialogs, toasts</span>
        </div>
      </div>
    </div>
  );
}
