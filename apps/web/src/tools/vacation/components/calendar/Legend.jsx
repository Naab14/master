const items = [
  { label: 'Utkast', bg: 'var(--draft-bg)', border: 'var(--draft-border)', style: {} },
  { label: 'Väntande', bg: 'var(--pending-bg)', border: 'var(--pending-border)', style: {} },
  { label: 'Godkänd', bg: 'var(--approved-bg)', border: 'var(--approved-border)', style: {} },
  { label: 'Begärd', bg: 'var(--requested-bg)', border: 'var(--requested-border)',
    style: { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', borderStyle: 'dashed', opacity: 0.65 } },
  { label: 'Helgdag', bg: 'var(--holiday-bg)', border: 'var(--holiday-border)', style: {} },
];

export default function Legend() {
  return (
    <div className="flex items-center gap-3 px-2 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {items.map(i => (
        <div key={i.label} className="flex items-center gap-1">
          <span className="w-4 h-3 rounded-sm inline-block" style={{ background: i.bg, border: `1px solid ${i.border}`, ...i.style }} />
          {i.label}
        </div>
      ))}
    </div>
  );
}
