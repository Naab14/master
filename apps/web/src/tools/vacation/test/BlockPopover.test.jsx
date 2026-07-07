import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BlockPopover from '../components/calendar/BlockPopover';

const makeBlock = (overrides = {}) => ({
  id: 'b1',
  operatorId: 'op1',
  startWeek: 20,
  endWeek: 22,
  status: 'draft',
  ...overrides,
});

const defaultProps = (overrides = {}) => ({
  x: 100, y: 100,
  block: makeBlock(),
  dateStr: null,
  onSetStatus: vi.fn(),
  onDelete: vi.fn(),
  onSetDayStatus: vi.fn(),
  onClearDayStatus: vi.fn(),
  onSetNote: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

describe('BlockPopover — note', () => {
  it('renders a note textarea when onSetNote is provided', () => {
    render(<BlockPopover {...defaultProps()} />);
    expect(screen.getByLabelText('Block note')).toBeInTheDocument();
  });

  it('does not render the textarea when onSetNote is absent', () => {
    render(<BlockPopover {...defaultProps({ onSetNote: undefined })} />);
    expect(screen.queryByLabelText('Block note')).not.toBeInTheDocument();
  });

  it('shows the existing block note as initial textarea value', () => {
    const block = makeBlock({ note: 'Back-up: Erik' });
    render(<BlockPopover {...defaultProps({ block })} />);
    expect(screen.getByLabelText('Block note')).toHaveValue('Back-up: Erik');
  });

  it('commits the note on blur', () => {
    const props = defaultProps();
    render(<BlockPopover {...props} />);
    const ta = screen.getByLabelText('Block note');
    fireEvent.change(ta, { target: { value: 'Parental leave' } });
    fireEvent.blur(ta);
    expect(props.onSetNote).toHaveBeenCalledWith('b1', 'Parental leave');
  });

  it('does not call onSetNote on blur when value is unchanged', () => {
    const block = makeBlock({ note: 'same' });
    const props = defaultProps({ block });
    render(<BlockPopover {...props} />);
    fireEvent.blur(screen.getByLabelText('Block note'));
    expect(props.onSetNote).not.toHaveBeenCalled();
  });

  it('commits and closes on Ctrl+Enter', () => {
    const props = defaultProps();
    render(<BlockPopover {...props} />);
    const ta = screen.getByLabelText('Block note');
    fireEvent.change(ta, { target: { value: 'Ship it' } });
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    expect(props.onSetNote).toHaveBeenCalledWith('b1', 'Ship it');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('still renders status buttons and delete when note is shown', () => {
    render(<BlockPopover {...defaultProps()} />);
    expect(screen.getByText('Utkast')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});
