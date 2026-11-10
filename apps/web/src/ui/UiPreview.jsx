import { useState } from 'react';
import { Button, Pill, Segmented, TextField, Checkbox, Toggle, ToastProvider, useToast } from './index.js';

const THEMES = [
  { id: 'calm', label: 'Calm' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'night', label: 'Night shift' },
];

/* Review page for the base controls (#/ui, not in the menu): every control
 * in all three themes, side by side. */
export default function UiPreview() {
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--bg-primary)' }}>
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        {/* Each column gets its own toasts so they take that column's theme */}
        {THEMES.map(t => (
          <div key={t.id} data-theme={t.id} className="contents">
            <ToastProvider><ThemeColumn theme={t} /></ToastProvider>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemeColumn({ theme }) {
  const toast = useToast();
  const [view, setView] = useState('table');
  const [done, setDone] = useState(true);
  const [notify, setNotify] = useState(false);
  const [date, setDate] = useState('2026-10-26');

  return (
    <section data-theme={theme.id} className="flex flex-col gap-6 rounded-panel p-6 font-ui" style={{ background: 'var(--surface-ground)', color: 'var(--ink)' }}>
      <header>
        <p className="t-label">Theme</p>
        <h2 className="t-title">{theme.label}</h2>
      </header>

      <Group title="Type">
        <p className="t-section">Shift checklist</p>
        <p className="t-body">Line 2 output back on plan after morning changeover delay.</p>
        <p className="t-label">Needs you · Week 44</p>
        <p className="t-body t-num font-semibold">0/2 · 1/2 · 2/2 · 11/20</p>
      </Group>

      <Group title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => toast(`${theme.label}: task added`)}>New task</Button>
          <Button onClick={() => toast('Log entry deleted', { action: { label: 'Undo', onClick: () => toast('Log entry restored') } })}>
            Delete with undo
          </Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete</Button>
          <Button disabled>Disabled</Button>
          <Button icon aria-label="Settings">⚙</Button>
        </div>
      </Group>

      <Group title="Coverage and work">
        <div className="flex flex-wrap gap-2">
          <Pill tone="ok">Covered 2/2</Pill>
          <Pill tone="warn">One short 1/2</Pill>
          <Pill tone="bad">Gap 0/2</Pill>
          <Pill tone="idle">Not started</Pill>
        </div>
      </Group>

      <Group title="Leave">
        <div className="flex flex-wrap gap-2">
          <Pill tone="approved">Approved</Pill>
          <Pill tone="pending">Pending</Pill>
          <Pill tone="draft">Draft</Pill>
          <Pill tone="requested">Requested</Pill>
        </div>
      </Group>

      <Group title="Controls">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[{ value: 'table', label: 'Table' }, { value: 'kanban', label: 'Kanban' }, { value: 'calendar', label: 'Calendar' }]}
        />
        <div className="flex flex-wrap items-end gap-4">
          <TextField label="Due date" type="date" lang="sv-SE" value={date} onChange={e => setDate(e.target.value)} />
          <TextField label="Task" placeholder="What needs doing?" />
          <TextField label="Operators needed" type="number" defaultValue="0" error="Must be at least 1" />
        </div>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Done" checked={done} onChange={e => setDone(e.target.checked)} />
          <Toggle label="Remind me" checked={notify} onChange={setNotify} />
        </div>
      </Group>
    </section>
  );
}

function Group({ title, children }) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
      <h3 className="t-label">{title}</h3>
      {children}
    </div>
  );
}
