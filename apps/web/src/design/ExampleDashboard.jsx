import { useState } from 'react';
import { Button, Pill, Segmented, TextField, Checkbox, Toggle, Panel, StatTile, PageHeader, useToast } from '../ui';

const LINES = [
  { id: 'line2', label: 'Possible on Line 2', value: 4, total: 4 },
  { id: 'packing', label: 'Possible on Packing', value: 3, total: 4 },
  { id: 'inspection', label: 'Possible on Inspection', value: 1, total: 2 },
];
const AWAY = [
  { name: 'Kim Lund', tone: 'approved', status: 'Leave' },
  { name: 'Sara Ek', tone: 'pending', status: 'Pending' },
  { name: 'Omar Nils', tone: 'idle', status: 'Training' },
];
const START_TASKS = [
  { id: 1, text: 'Sign line clearance, Line 2', done: true },
  { id: 2, text: 'Check deviation log before 10:00', done: false },
  { id: 3, text: 'Plan cover for the Inspection gap', done: false },
];

function status(v, total) {
  if (v >= total) return { tone: 'ok', note: 'Covered' };
  if (v === total - 1) return { tone: 'warn', note: 'One short' };
  return { tone: 'bad', note: 'Gap' };
}

/* A working shift dashboard built only from the shared controls, to show
 * how the pieces fit. Made-up people; nothing is saved. */
export default function ExampleDashboard() {
  const toast = useToast();
  const [range, setRange] = useState('today');
  const [covered, setCovered] = useState(false);
  const [tasks, setTasks] = useState(START_TASKS);
  const [filter, setFilter] = useState('');
  const [nextWeek, setNextWeek] = useState(false);

  const lines = LINES.map(l => (l.id === 'inspection' && covered ? { ...l, value: 2 } : l));
  const shown = tasks.filter(t => t.text.toLowerCase().includes(filter.toLowerCase()));
  const open = tasks.filter(t => !t.done).length;

  const remove = task => {
    const before = tasks;
    setTasks(before.filter(t => t.id !== task.id));
    toast('Task deleted', { action: { label: 'Undo', onClick: () => setTasks(before) } });
  };
  const add = () => {
    const text = filter.trim();
    if (!text) return;
    setTasks(list => [...list, { id: Date.now(), text, done: false }]);
    setFilter('');
    toast('Task added');
  };

  return (
    <div className="dw-example">
      <PageHeader eyebrow="Shift B · Thursday 27 November" title="Dashboard">
        <Segmented label="Range" value={range} onChange={setRange} options={[{ value: 'today', label: 'Today' }, { value: 'week', label: 'Week' }]} />
        <Button variant="primary" disabled={covered} onClick={() => { setCovered(true); toast('Anna Berg added to Inspection', { action: { label: 'Undo', onClick: () => setCovered(false) } }); }}>
          Cover the gap
        </Button>
      </PageHeader>

      <div className="dw-stats">
        {lines.map(l => {
          const s = status(l.value, l.total);
          return <StatTile key={l.id} label={l.label} value={l.value} total={l.total} tone={s.tone} note={s.note} />;
        })}
      </div>

      <div className="dw-example__grid">
        <Panel title="Tasks" meta={`${open} open`}>
          <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
            <TextField label="Filter or add" placeholder="Type, then Enter to add" value={filter} onChange={e => setFilter(e.target.value)} className="flex-1" inputClassName="w-full" />
            <Button type="submit" disabled={!filter.trim()}>Add</Button>
          </form>
          <ul className="dw-list">
            {shown.map(t => (
              <li key={t.id}>
                <Checkbox checked={t.done} onChange={() => setTasks(list => list.map(x => (x.id === t.id ? { ...x, done: !x.done } : x)))}>
                  <span className={t.done ? 'dw-done' : ''}>{t.text}</span>
                </Checkbox>
                <Button variant="ghost" icon aria-label={`Delete ${t.text}`} onClick={() => remove(t)}>✕</Button>
              </li>
            ))}
            {shown.length === 0 && <li className="t-label">No tasks match.</li>}
          </ul>
        </Panel>

        <Panel title="Who is away" meta={nextWeek ? 'Next week' : `${AWAY.length} people`}>
          <ul className="dw-list">
            {(nextWeek ? AWAY.slice(0, 1) : AWAY).map(p => (
              <li key={p.name}><span className="t-body">{p.name}</span><Pill tone={p.tone}>{p.status}</Pill></li>
            ))}
          </ul>
          <Toggle label="Show next week" checked={nextWeek} onChange={setNextWeek} />
        </Panel>
      </div>
    </div>
  );
}
