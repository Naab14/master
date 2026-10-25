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
    saveTheme: vi.fn(),
    loadTheme: vi.fn(() => 'default'),
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
import { seedOperators } from '../data';
import * as storage from '../storage';

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
    render(<App />);
    // Names appear in both sidebar and grid, so use getAllByText
    seedOperators.forEach(op => {
      const matches = screen.getAllByText(op.name);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the top bar title', () => {
    render(<App />);
    expect(screen.getByText('Semester Planner')).toBeInTheDocument();
  });

  it('renders the calendar grid with week headers', () => {
    render(<App />);
    expect(screen.getByText('v.15')).toBeInTheDocument();
  });

  it('applies theme on change', async () => {
    render(<App />);
    const themeSelect = screen.getByDisplayValue('Default');
    fireEvent.change(themeSelect, { target: { value: 'dark' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storage.saveTheme).toHaveBeenCalledWith('dark');
  });

  it('removes data-theme when default selected', () => {
    render(<App />);
    // Switch to dark first
    const themeSelect = screen.getByDisplayValue('Default');
    fireEvent.change(themeSelect, { target: { value: 'dark' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    // Switch back to default
    fireEvent.change(screen.getByDisplayValue('Dark'), { target: { value: 'default' } });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('calls debouncedSave on state changes', () => {
    render(<App />);
    expect(storage.debouncedSave).toHaveBeenCalled();
  });

  it('shows shift mode buttons and changes mode', () => {
    render(<App />);
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
    render(<FreshApp />);
    expect(screen.getByText('Loaded shared workspace')).toBeInTheDocument();
  });

  it('flash toast disappears after 3 seconds', () => {
    render(<App />);
    // Trigger save via top bar menu
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('State saved')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('State saved')).not.toBeInTheDocument();
  });

  it('reset restores defaults after confirm', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Reset'));
    expect(storage.clearState).toHaveBeenCalled();
    // Seed operators should still be visible (restored)
    const matches = screen.getAllByText(seedOperators[0].name);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    window.confirm.mockRestore();
  });

  it('reset does not clear when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Reset'));
    expect(storage.clearState).not.toHaveBeenCalled();
    window.confirm.mockRestore();
  });

  it('share calls copyToClipboard', async () => {
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByText('Share'));
    });
    expect(storage.buildShareLink).toHaveBeenCalled();
    expect(storage.copyToClipboard).toHaveBeenCalled();
  });

  it('undo button reverts a shift-mode change', () => {
    render(<App />);
    // Default is 'separate' — coverage rows show S1/S2 labels
    expect(screen.getByText('COVERAGE (S1)')).toBeInTheDocument();
    expect(screen.queryByText('COVERAGE (All Operators)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Combined'));
    expect(screen.getByText('COVERAGE (All Operators)')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Undo'));
    expect(screen.getByText('COVERAGE (S1)')).toBeInTheDocument();
    expect(screen.queryByText('COVERAGE (All Operators)')).not.toBeInTheDocument();
  });

  it('Ctrl+Z keyboard shortcut fires undo', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Combined'));
    expect(screen.getByText('COVERAGE (All Operators)')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(screen.queryByText('COVERAGE (All Operators)')).not.toBeInTheDocument();
    expect(screen.getByText('COVERAGE (S1)')).toBeInTheDocument();
  });
});
