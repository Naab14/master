import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmented, TextField, Toggle, Checkbox, ToastProvider, useToast } from './index.js';

function ViewPicker() {
  const [view, setView] = useState('table');
  return (
    <Segmented
      label="View"
      value={view}
      onChange={setView}
      options={[{ value: 'table', label: 'Table' }, { value: 'kanban', label: 'Kanban' }, { value: 'calendar', label: 'Calendar' }]}
    />
  );
}

describe('Segmented', () => {
  it('is one tab stop and moves with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<ViewPicker />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Table' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Kanban' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Kanban' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Calendar' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'Table' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio').filter(r => r.tabIndex === 0)).toHaveLength(1);
  });
});

describe('TextField', () => {
  it('ties the label, hint and error to the input', () => {
    render(<TextField label="Operators needed" hint="Per shift" error="Must be at least 1" />);
    const input = screen.getByLabelText('Operators needed');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Per shift Must be at least 1');
  });
});

describe('Toggle and Checkbox', () => {
  it('flips the switch from its label and from the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle label="Remind me" checked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Remind me' });
    await user.click(screen.getByText('Remind me'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    sw.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('names the checkbox by its label', () => {
    render(<Checkbox label="Done" defaultChecked />);
    expect(screen.getByRole('checkbox', { name: 'Done' })).toBeChecked();
  });
});

function DeleteButton({ onUndo }) {
  const toast = useToast();
  return <button onClick={() => toast('Task deleted', { action: { label: 'Undo', onClick: onUndo } })}>Delete</button>;
}

describe('Toast', () => {
  it('announces the message and runs the undo action', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<ToastProvider><DeleteButton onUndo={onUndo} /></ToastProvider>);
    await user.click(screen.getByText('Delete'));
    expect(screen.getByRole('status')).toHaveTextContent('Task deleted');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByText('Task deleted')).toBeNull();
  });

  it('closes by itself after five seconds', () => {
    vi.useFakeTimers();
    try {
      render(<ToastProvider><DeleteButton onUndo={() => {}} /></ToastProvider>);
      act(() => { screen.getByText('Delete').click(); });
      expect(screen.getByText('Task deleted')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(5000); });
      expect(screen.queryByText('Task deleted')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
