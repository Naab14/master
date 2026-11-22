import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DemandEditor from '../components/calendar/DemandEditor';

describe('DemandEditor on the planning model', () => {
  const processes = [{ key: 'wf:insp', name: 'Inspection' }];
  it('shows the default of 2 only where nothing is saved, and copies old demand (zero included) only when asked', () => {
    const onCopyDemand = vi.fn();
    render(<DemandEditor processes={processes} weeks={[15]} demand={{ Avsyning: { 15: 0 } }} updateDemand={vi.fn()} onCopyDemand={onCopyDemand} />);
    expect(screen.getByLabelText('Inspection w.15')).toHaveValue(2);
    fireEvent.change(screen.getByLabelText('Copy the old demand of a process into Inspection'), { target: { value: 'Avsyning' } });
    expect(onCopyDemand).toHaveBeenCalledWith('wf:insp', 'Avsyning');
  });
  it('offers no copy in the older mode', () => {
    render(<DemandEditor weeks={[15]} demand={{}} updateDemand={vi.fn()} />);
    expect(screen.queryByText('Copy from…')).toBeNull();
  });
});
