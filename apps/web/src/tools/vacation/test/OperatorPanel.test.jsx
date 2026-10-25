import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OperatorPanel from '../components/OperatorPanel';
import { PROCESSES } from '../data';

const makeOp = (id, name = `Op ${id}`, shift = 'S1', active = true, certifications = []) =>
  ({ id, name, shift, active, certifications });

const defaultProps = () => ({
  operators: [makeOp('1', 'Anna Lindgren'), makeOp('2', 'Erik Holm', 'S2')],
  onUpdateOperator: vi.fn(),
  showMgmt: false,
  onToggleMgmt: vi.fn(),
  onAddOperator: vi.fn(),
  onRemoveOperator: vi.fn(),
  onDownloadTemplate: vi.fn(),
  collapsed: false,
  onToggleCollapse: vi.fn(),
});

describe('OperatorPanel', () => {
  it('renders operator names', () => {
    render(<OperatorPanel {...defaultProps()} />);
    expect(screen.getByText('Anna Lindgren')).toBeInTheDocument();
    expect(screen.getByText('Erik Holm')).toBeInTheDocument();
  });

  it('renders shift badges', () => {
    render(<OperatorPanel {...defaultProps()} />);
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();
  });

  it('shows + Add button when management not open', () => {
    render(<OperatorPanel {...defaultProps()} />);
    const addBtn = screen.getByText('+ Add');
    expect(addBtn).toBeInTheDocument();
  });

  it('calls onToggleMgmt when + Add is clicked', () => {
    const props = defaultProps();
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(props.onToggleMgmt).toHaveBeenCalled();
  });

  it('shows add form when showMgmt is true', () => {
    const props = { ...defaultProps(), showMgmt: true };
    render(<OperatorPanel {...props} />);
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('calls onAddOperator with name and shift', () => {
    const props = { ...defaultProps(), showMgmt: true };
    render(<OperatorPanel {...props} />);
    const input = screen.getByPlaceholderText('Name');
    fireEvent.change(input, { target: { value: 'New Person' } });
    fireEvent.click(screen.getByText('Add'));
    expect(props.onAddOperator).toHaveBeenCalledWith('New Person', 'S1');
  });

  it('does not call onAddOperator with empty name', () => {
    const props = { ...defaultProps(), showMgmt: true };
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('Add'));
    expect(props.onAddOperator).not.toHaveBeenCalled();
  });

  it('calls onAddOperator on Enter key', () => {
    const props = { ...defaultProps(), showMgmt: true };
    render(<OperatorPanel {...props} />);
    const input = screen.getByPlaceholderText('Name');
    fireEvent.change(input, { target: { value: 'Enter Person' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onAddOperator).toHaveBeenCalledWith('Enter Person', 'S1');
  });

  it('expands operator details on click', () => {
    const props = defaultProps();
    props.operators = [makeOp('1', 'Anna Lindgren', 'S1', true, ['Avsyning'])];
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('Anna Lindgren'));
    // Name edit input should appear
    expect(screen.getByDisplayValue('Anna Lindgren')).toBeInTheDocument();
    // Active checkbox should appear
    expect(screen.getByLabelText('Active')).toBeInTheDocument();
  });

  it('shows certification checkboxes in expanded view', () => {
    const props = defaultProps();
    props.operators = [makeOp('1', 'Anna', 'S1', true, ['Avsyning'])];
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('Anna'));
    PROCESSES.forEach(p => {
      expect(screen.getByText(p)).toBeInTheDocument();
    });
  });

  it('calls onUpdateOperator when name changes', () => {
    const props = defaultProps();
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('Anna Lindgren'));
    const nameInput = screen.getByDisplayValue('Anna Lindgren');
    fireEvent.change(nameInput, { target: { value: 'Anna L' } });
    expect(props.onUpdateOperator).toHaveBeenCalledWith('1', { name: 'Anna L' });
  });

  it('calls onUpdateOperator when active toggled', () => {
    const props = defaultProps();
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('Anna Lindgren'));
    const activeCheckbox = screen.getByLabelText('Active');
    fireEvent.click(activeCheckbox);
    expect(props.onUpdateOperator).toHaveBeenCalledWith('1', { active: false });
  });

  it('shows Remove button only when management is open', () => {
    const props = { ...defaultProps(), showMgmt: true };
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('Anna Lindgren'));
    expect(screen.getByText('Remove Operator')).toBeInTheDocument();
  });

  it('does not show Remove button when management is closed', () => {
    const props = defaultProps();
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('Anna Lindgren'));
    expect(screen.queryByText('Remove Operator')).not.toBeInTheDocument();
  });

  it('calls onToggleCollapse when collapse button clicked', () => {
    const props = defaultProps();
    render(<OperatorPanel {...props} />);
    const collapseBtn = screen.getByText('◀');
    fireEvent.click(collapseBtn);
    expect(props.onToggleCollapse).toHaveBeenCalled();
  });

  it('shows expand arrow when collapsed', () => {
    const props = { ...defaultProps(), collapsed: true };
    render(<OperatorPanel {...props} />);
    expect(screen.getByText('▶')).toBeInTheDocument();
  });

  it('calls onDownloadTemplate when CSV button clicked', () => {
    const props = defaultProps();
    render(<OperatorPanel {...props} />);
    fireEvent.click(screen.getByText('CSV'));
    expect(props.onDownloadTemplate).toHaveBeenCalled();
  });

  it('renders the search input', () => {
    render(<OperatorPanel {...defaultProps()} />);
    expect(screen.getByPlaceholderText('Search operators')).toBeInTheDocument();
  });

  it('filters operators by name (case-insensitive)', () => {
    render(<OperatorPanel {...defaultProps()} />);
    const searchInput = screen.getByPlaceholderText('Search operators');
    fireEvent.change(searchInput, { target: { value: 'anna' } });
    expect(screen.getByText('Anna Lindgren')).toBeInTheDocument();
    expect(screen.queryByText('Erik Holm')).not.toBeInTheDocument();
  });

  it('matches substring anywhere in the name', () => {
    render(<OperatorPanel {...defaultProps()} />);
    fireEvent.change(screen.getByPlaceholderText('Search operators'), { target: { value: 'holm' } });
    expect(screen.queryByText('Anna Lindgren')).not.toBeInTheDocument();
    expect(screen.getByText('Erik Holm')).toBeInTheDocument();
  });

  it('shows "No matches" when nothing matches', () => {
    render(<OperatorPanel {...defaultProps()} />);
    fireEvent.change(screen.getByPlaceholderText('Search operators'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.queryByText('Anna Lindgren')).not.toBeInTheDocument();
    expect(screen.queryByText('Erik Holm')).not.toBeInTheDocument();
  });

  it('clear button resets the search', () => {
    render(<OperatorPanel {...defaultProps()} />);
    const searchInput = screen.getByPlaceholderText('Search operators');
    fireEvent.change(searchInput, { target: { value: 'anna' } });
    expect(screen.queryByText('Erik Holm')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(searchInput.value).toBe('');
    expect(screen.getByText('Erik Holm')).toBeInTheDocument();
  });

  it('clear button is hidden when search is empty', () => {
    render(<OperatorPanel {...defaultProps()} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });
});
