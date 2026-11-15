import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// No server in tests: the tool stays on its local copy.
vi.mock('../../access', () => ({ apiFetch: () => Promise.reject(new Error('offline')) }));

import CalendarView from './views/CalendarView';
import { useManageclip, todayStr } from './store';
import { ToastProvider } from '../../ui';

const CACHE = 'master-manageclip';
const saved = () => JSON.parse(localStorage.getItem(CACHE)).tasks;

function Harness() {
  const mc = useManageclip();
  return (
    <ToastProvider>
      <CalendarView state={mc.state} patchTask={mc.patchTask} onEdit={() => {}} />
      <button type="button" onClick={() => mc.deleteTask('t1')}>delete-t1</button>
    </ToastProvider>
  );
}

/* Drag the task to a day it is not on, the way the browser reports it. */
function dragToAnotherDay() {
  const task = document.querySelector('[data-task="t1"]');
  const target = [...document.querySelectorAll('.tl-drop')].find(cell => !cell.contains(task));
  const dataTransfer = { setData: () => {}, getData: () => 't1', effectAllowed: '', dropEffect: '' };
  fireEvent.dragStart(task, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe('Shift HQ task calendar: undoing a move', () => {
  beforeEach(() => {
    localStorage.setItem(CACHE, JSON.stringify({
      tasks: [{ id: 't1', title: 'Gemba walk', description: '', category: 'Gemba Walk', status: 'current', due_date: todayStr() }],
      logs: [], links: [], settings: { weeklyTarget: 20 },
    }));
  });

  it('moves the task back without undoing what was done to it afterwards', () => {
    render(<Harness />);
    dragToAnotherDay();
    expect(saved()[0].due_date).not.toBe(todayStr());

    fireEvent.click(screen.getByTitle('Mark as completed'));
    expect(saved()[0].status).toBe('finished');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(saved()[0].due_date).toBe(todayStr());
    expect(saved()[0].status).toBe('finished');
  });

  it('does not bring back a task that was deleted after the move', () => {
    render(<Harness />);
    dragToAnotherDay();
    fireEvent.click(screen.getByText('delete-t1'));
    expect(saved()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(saved()).toHaveLength(0);
  });
});
