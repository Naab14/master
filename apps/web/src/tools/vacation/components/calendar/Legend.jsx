import { useI18n } from '../../../../i18n';

const HATCH = 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)';

export default function Legend() {
  const { t } = useI18n();
  const items = [
    { label: t('Draft'), bg: 'var(--draft-bg)', border: 'var(--draft-border)', style: {} },
    { label: t('Pending'), bg: 'var(--pending-bg)', border: 'var(--pending-border)', style: {} },
    { label: t('Approved'), bg: 'var(--approved-bg)', border: 'var(--approved-border)', style: {} },
    { label: t('Requested'), bg: 'var(--requested-bg)', border: 'var(--requested-border)', style: { backgroundImage: HATCH, borderStyle: 'dashed', opacity: 0.65 } },
    { label: t('Public holiday'), bg: 'var(--holiday-bg)', border: 'var(--holiday-border)', style: {} },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 py-1 text-xs text-ink-3">
      {items.map(i => (
        <div key={i.label} className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded-sm" style={{ background: i.bg, border: `1px solid ${i.border}`, ...i.style }} />
          {i.label}
        </div>
      ))}
    </div>
  );
}
