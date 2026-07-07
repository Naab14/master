import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from '../components/TopBar';

const defaultProps = () => ({
  shiftMode: 'separate',
  onShiftModeChange: vi.fn(),
  theme: 'default',
  onThemeChange: vi.fn(),
  onImportCSV: vi.fn(),
  onSave: vi.fn(),
  onExportJSON: vi.fn(),
  onImportJSON: vi.fn(),
  onReset: vi.fn(),
  onShare: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  canUndo: true,
  canRedo: true,
});

describe('TopBar', () => {
  it('renders the title', () => {
    render(<TopBar {...defaultProps()} />);
    expect(screen.getByText('Semester Planner')).toBeInTheDocument();
  });

  it('renders shift mode buttons', () => {
    render(<TopBar {...defaultProps()} />);
    expect(screen.getByText('Separate')).toBeInTheDocument();
    expect(screen.getByText('Combined')).toBeInTheDocument();
    expect(screen.getByText('Summer')).toBeInTheDocument();
  });

  it('calls onShiftModeChange when clicking a mode button', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    fireEvent.click(screen.getByText('Combined'));
    expect(props.onShiftModeChange).toHaveBeenCalledWith('combined');
  });

  it('calls onShiftModeChange with summer', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    fireEvent.click(screen.getByText('Summer'));
    expect(props.onShiftModeChange).toHaveBeenCalledWith('summer');
  });

  it('renders the theme select with correct value', () => {
    render(<TopBar {...defaultProps()} />);
    const select = screen.getByDisplayValue('Default');
    expect(select).toBeInTheDocument();
  });

  it('calls onThemeChange when changing theme', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    const select = screen.getByDisplayValue('Default');
    fireEvent.change(select, { target: { value: 'dark' } });
    expect(props.onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('renders the Share button', () => {
    render(<TopBar {...defaultProps()} />);
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('calls onShare when Share clicked', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    fireEvent.click(screen.getByText('Share'));
    expect(props.onShare).toHaveBeenCalled();
  });

  it('opens overflow menu and shows actions', () => {
    render(<TopBar {...defaultProps()} />);
    fireEvent.click(screen.getByText('⋮'));
    expect(screen.getByText('Import CSV')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Import JSON')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('calls onSave from overflow menu', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Save'));
    expect(props.onSave).toHaveBeenCalled();
  });

  it('calls onExportJSON from overflow menu', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Export'));
    expect(props.onExportJSON).toHaveBeenCalled();
  });

  it('calls onImportCSV from overflow menu', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Import CSV'));
    expect(props.onImportCSV).toHaveBeenCalled();
  });

  it('calls onReset from overflow menu', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    fireEvent.click(screen.getByText('⋮'));
    fireEvent.click(screen.getByText('Reset'));
    expect(props.onReset).toHaveBeenCalled();
  });

  it('closes overflow menu on Escape', () => {
    render(<TopBar {...defaultProps()} />);
    fireEvent.click(screen.getByText('⋮'));
    expect(screen.getByText('Save')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('renders Undo and Redo buttons', () => {
    render(<TopBar {...defaultProps()} />);
    expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    expect(screen.getByLabelText('Redo')).toBeInTheDocument();
  });

  it('disables Undo/Redo buttons when canUndo/canRedo are false', () => {
    render(<TopBar {...defaultProps()} canUndo={false} canRedo={false} />);
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('calls onUndo and onRedo when respective buttons clicked', () => {
    const props = defaultProps();
    render(<TopBar {...props} />);
    fireEvent.click(screen.getByLabelText('Undo'));
    expect(props.onUndo).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Redo'));
    expect(props.onRedo).toHaveBeenCalled();
  });
});
