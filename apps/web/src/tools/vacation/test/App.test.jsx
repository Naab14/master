import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock holidays to avoid the async date-holidays import in tests
vi.mock('../holidays', () => ({
  buildHolidayMap: () => ({}),
  initHolidays: () => Promise.resolve({}),
}));

// Mock storage to avoid localStorage side effects
vi.mock('../storage', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    saveState: vi.fn(),
    loadState: vi.fn(() => null),
    clearState: vi.fn(),
    saveUI: vi.fn(),
    loadUI: vi.fn(() => ({})),
    debouncedSave: vi.fn(),
    loadStateFromUrl: vi.fn(() => null),
    clearShareHash: vi.fn(),
    exportJSON: vi.fn(),
    importJSON: vi.fn(() => Promise.resolve(null)),
    buildShareLink: vi.fn(() => 'http://localhost/#share=test'),
    copyToClipboard: vi.fn(() => Promise.resolve(true)),
  };
});

import App from '../App';
import { ToastProvider } from '../../../ui';
import { seedOperators } from '../data';
import * as storage from '../storage';

// The tool shows its messages through the app's shared toasts.
const renderApp = (ui = <App />) => render(<ToastProvider>{ui}</ToastProvider>);

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders with seed data and shows operator names', () => {
    renderApp();
    // Names appear in both sidebar and grid, so use getAllByText
    seedOperators.forEach(op => {
      const matches = screen.getAllByText(op.name);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the top bar title', () => {
    renderApp();
    expect(screen.getByText('Vacations')).toBeInTheDocument();
  });

  it('renders the calendar grid with week headers', () => {
    renderApp();
    expect(screen.getByText('w.15')).toBeInTheDocument();
  });

  it('calls debouncedSave on state changes', () => {
    renderApp();
    expect(storage.debouncedSave).toHaveBeenCalled();
  });

  it('shows shift mode buttons and changes mode', () => {
    renderApp();
    const combinedBtn = screen.getByText('Combined');
    fireEvent.click(combinedBtn);
    // In combined mode, we should no longer see S1/S2 group labels in the grid
    // and operator rows from both shifts should be visible
    const matches = screen.getAllByText(seedOperators[0].name);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows shared workspace toast when loaded from URL', async () => {
    storage.loadStateFromUrl.mockReturnValueOnce({
      operators: seedOperators.slice(0, 2),
      vacationBlocks: [],
      demand: {},
      settings: { shiftMode: 'combined', visibleWeeks: 12, startWeek: 15 },
    });
    // Need to reset module cache to re-trigger getDefaults
    vi.resetModules();
    // Re-import after mock change
    const { default: FreshApp } = await import('../App');
    const { ToastProvider: FreshToasts } = await import('../../../ui');
    render(<FreshToasts><FreshApp /></FreshToasts>);
    expect(screen.getByText('Opened a shared copy of the plan')).toBeInTheDocument();
  });

  it('the saved message goes away by itself', () => {
    renderApp();
    // Trigger save via top bar menu
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5000); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('reset restores defaults after confirm', () => {
    renderApp();
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Reset…'));
    expect(storage.clearState).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(storage.clearState).toHaveBeenCalled();
    // Seed operators should still be visible (restored)
    const matches = screen.getAllByText(seedOperators[0].name);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('reset does not clear when confirm is cancelled', () => {
    renderApp();
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Reset…'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(storage.clearState).not.toHaveBeenCalled();
  });

  it('share calls copyToClipboard', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Share'));
    });
    expect(storage.buildShareLink).toHaveBeenCalled();
    expect(storage.copyToClipboard).toHaveBeenCalled();
  });

  it('undo button reverts a shift-mode change', () => {
    renderApp();
    // Default is 'separate' — coverage rows show S1/S2 labels
    expect(screen.getByText('Coverage (S1)')).toBeInTheDocument();
    expect(screen.queryByText('Coverage (All operators)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Combined'));
    expect(screen.getByText('Coverage (All operators)')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Undo'));
    expect(screen.getByText('Coverage (S1)')).toBeInTheDocument();
    expect(screen.queryByText('Coverage (All operators)')).not.toBeInTheDocument();
  });

  it('Ctrl+Z keyboard shortcut fires undo', () => {
    renderApp();
    fireEvent.click(screen.getByText('Combined'));
    expect(screen.getByText('Coverage (All operators)')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(screen.queryByText('Coverage (All operators)')).not.toBeInTheDocument();
    expect(screen.getByText('Coverage (S1)')).toBeInTheDocument();
  });
});
