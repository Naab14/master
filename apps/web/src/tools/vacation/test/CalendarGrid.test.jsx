import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CalendarGrid from '../components/calendar/CalendarGrid';
import { buildDefaultDemand, defaultSettings, PROCESSES } from '../data';

const makeOp = (id, shift = 'S1', active = true, certifications = PROCESSES) =>
  ({ id, name: `Op ${id}`, shift, active, certifications });

const makeBlock = (id, operatorId, startWeek, endWeek, status = 'draft') =>
  ({ id, operatorId, startWeek, endWeek, status });

const defaultProps = () => ({
  operators: [makeOp('1'), makeOp('2', 'S2')],
  vacationBlocks: [],
  demand: buildDefaultDemand(),
  settings: defaultSettings,
  weeks: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  holidayMap: {},
  onAddBlock: vi.fn(),
  onUpdateBlock: vi.fn(),
  onDeleteBlock: vi.fn(),
  onSetBlockStatus: vi.fn(),
  setStartWeek: vi.fn(),
  showDemand: false,
  onToggleDemand: vi.fn(),
  updateDemand: vi.fn(),
  zoom: 'week',
  onZoomChange: vi.fn(),
});

describe('CalendarGrid', () => {
  it('renders operator names as rows', () => {
    render(<CalendarGrid {...defaultProps()} />);
    expect(screen.getByText('Op 1')).toBeInTheDocument();
    expect(screen.getByText('Op 2')).toBeInTheDocument();
  });

  it('renders week headers', () => {
    render(<CalendarGrid {...defaultProps()} />);
    expect(screen.getByText('v.15')).toBeInTheDocument();
    expect(screen.getByText('v.26')).toBeInTheDocument();
  });

  it('renders the time slider', () => {
    render(<CalendarGrid {...defaultProps()} />);
    const slider = document.querySelector('.time-slider');
    expect(slider).toBeInTheDocument();
    expect(slider.type).toBe('range');
  });

  it('calls setStartWeek when slider changes', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    const slider = document.querySelector('.time-slider');
    fireEvent.change(slider, { target: { value: '20' } });
    expect(props.setStartWeek).toHaveBeenCalledWith(20);
  });

  it('renders zoom buttons with aria-labels', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
  });

  it('+ button zooms into day view (from week)', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(props.onZoomChange).toHaveBeenCalledWith('day');
  });

  it('zoom out button is disabled in week view', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    expect(screen.getByLabelText('Zoom out')).toBeDisabled();
  });

  it('zoom in button is disabled in day view', () => {
    const props = { ...defaultProps(), zoom: 'day' };
    render(<CalendarGrid {...props} />);
    expect(screen.getByLabelText('Zoom in')).toBeDisabled();
  });

  it('shows week label in week zoom', () => {
    render(<CalendarGrid {...defaultProps()} />);
    expect(screen.getByText('v.15 — v.26')).toBeInTheDocument();
  });

  it('renders coverage rows with values', () => {
    render(<CalendarGrid {...defaultProps()} />);
    const coverageText = screen.getAllByText(/^\d+\/\d+$/);
    expect(coverageText.length).toBeGreaterThan(0);
  });

  it('renders data-week and data-op attributes on cells', () => {
    render(<CalendarGrid {...defaultProps()} />);
    const cells = document.querySelectorAll('[data-week][data-op]');
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0].dataset.week).toBeDefined();
    expect(cells[0].dataset.op).toBeDefined();
  });

  it('shows block label when vacation block exists', () => {
    const props = defaultProps();
    props.vacationBlocks = [makeBlock('b1', '1', 16, 18)];
    render(<CalendarGrid {...props} />);
    expect(screen.getByText('v.16-18')).toBeInTheDocument();
  });

  it('shows note indicator on blocks that have a note', () => {
    const props = defaultProps();
    props.vacationBlocks = [{ ...makeBlock('b1', '1', 16, 18), note: 'Parental leave' }];
    render(<CalendarGrid {...props} />);
    expect(screen.getByLabelText('Has note')).toBeInTheDocument();
  });

  it('does not show note indicator on blocks without a note', () => {
    const props = defaultProps();
    props.vacationBlocks = [makeBlock('b1', '1', 16, 18)];
    render(<CalendarGrid {...props} />);
    expect(screen.queryByLabelText('Has note')).not.toBeInTheDocument();
  });

  it('renders day zoom when zoom=day', () => {
    const props = defaultProps();
    props.zoom = 'day';
    render(<CalendarGrid {...props} />);
    expect(screen.getAllByText(/Mån/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sön/).length).toBeGreaterThan(0);
  });

  it('day zoom spans 8 weeks (56 day columns per operator)', () => {
    const props = defaultProps();
    props.zoom = 'day';
    render(<CalendarGrid {...props} />);
    // 8 weeks × 7 days = 56 Mån-Sön instances across header row
    expect(screen.getAllByText(/Mån/).length).toBe(8);
  });

  it('day zoom shows week labels v.15 .. v.22', () => {
    const props = defaultProps();
    props.zoom = 'day';
    render(<CalendarGrid {...props} />);
    expect(screen.getAllByText('v.15').length).toBeGreaterThan(0);
    expect(screen.getByText('v.22')).toBeInTheDocument();
  });

  it('shows tools row when gear button clicked', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    const gearBtn = screen.getByText('⚙');
    fireEvent.click(gearBtn);
    expect(screen.getByText('Utkast')).toBeInTheDocument();
    expect(screen.getByText('Godkänd')).toBeInTheDocument();
  });

  it('shows demand toggle in tools row', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    fireEvent.click(screen.getByText('⚙'));
    const demandBtn = screen.getByText('Demand');
    fireEvent.click(demandBtn);
    expect(props.onToggleDemand).toHaveBeenCalled();
  });

  it('shows holiday tooltip with name and date on week column header', () => {
    const props = defaultProps();
    props.holidayMap = { 17: { holidays: [{ name: 'Långfredagen', dateStr: '2026-04-03', year: 2026 }] } };
    render(<CalendarGrid {...props} />);
    const header = document.querySelector('[title*="Långfredagen"]');
    expect(header).toBeInTheDocument();
    expect(header.getAttribute('title')).toContain('2026-04-03');
  });

  it('applies holiday stripe pattern to empty holiday cells in week zoom', () => {
    const props = defaultProps();
    props.holidayMap = { 17: { holidays: [{ name: 'Långfredagen', dateStr: '2026-04-03', year: 2026 }] } };
    render(<CalendarGrid {...props} />);
    const cell = document.querySelector('[data-week="17"][data-op="1"]');
    expect(cell).toBeInTheDocument();
    expect(cell.style.background).toContain('holiday-pattern');
  });

  it('holiday cell tooltip includes name + date in week zoom', () => {
    const props = defaultProps();
    props.holidayMap = { 17: { holidays: [{ name: 'Långfredagen', dateStr: '2026-04-03', year: 2026 }] } };
    render(<CalendarGrid {...props} />);
    const cell = document.querySelector('[data-week="17"][data-op="1"]');
    expect(cell.getAttribute('title')).toContain('Långfredagen');
    expect(cell.getAttribute('title')).toContain('2026-04-03');
  });

  it('vacation block overrides holiday stripe (block styling wins)', () => {
    const props = defaultProps();
    props.holidayMap = { 17: { holidays: [{ name: 'Långfredagen', dateStr: '2026-04-03', year: 2026 }] } };
    props.vacationBlocks = [makeBlock('b1', '1', 17, 17, 'approved')];
    render(<CalendarGrid {...props} />);
    const cell = document.querySelector('[data-week="17"][data-op="1"]');
    expect(cell.style.background).not.toContain('holiday-pattern');
    expect(cell.getAttribute('title')).toBeNull();
  });
});

describe('CalendarGrid — scroll zoom & keyboard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('scroll up zooms into day view when in week zoom', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    const wrapper = screen.getByTestId('grid-wrapper');
    fireEvent.wheel(wrapper, { deltaY: -50 });
    expect(props.onZoomChange).toHaveBeenCalledWith('day');
  });

  it('scroll down from day view triggers transition overlay and delayed week switch', () => {
    vi.useFakeTimers();
    const props = { ...defaultProps(), zoom: 'day' };
    render(<CalendarGrid {...props} />);
    const wrapper = screen.getByTestId('grid-wrapper');
    fireEvent.wheel(wrapper, { deltaY: 50 });
    expect(screen.getByTestId('zoom-transition-overlay')).toBeInTheDocument();
    expect(props.onZoomChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(260); });
    expect(props.onZoomChange).toHaveBeenCalledWith('week');
  });

  it('debounces repeated wheel events within 120ms', () => {
    vi.useFakeTimers();
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    const wrapper = screen.getByTestId('grid-wrapper');
    fireEvent.wheel(wrapper, { deltaY: -50 });
    fireEvent.wheel(wrapper, { deltaY: -50 });
    fireEvent.wheel(wrapper, { deltaY: -50 });
    expect(props.onZoomChange).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(125); });
    fireEvent.wheel(wrapper, { deltaY: -50 });
    expect(props.onZoomChange).toHaveBeenCalledTimes(2);
  });

  it('ignores wheel when horizontal scroll dominates', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    const wrapper = screen.getByTestId('grid-wrapper');
    fireEvent.wheel(wrapper, { deltaY: 5, deltaX: 80 });
    expect(props.onZoomChange).not.toHaveBeenCalled();
  });

  it('+ key zooms into day view', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    fireEvent.keyDown(document, { key: '+' });
    expect(props.onZoomChange).toHaveBeenCalledWith('day');
  });

  it('= key also zooms into day view', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    fireEvent.keyDown(document, { key: '=' });
    expect(props.onZoomChange).toHaveBeenCalledWith('day');
  });

  it('- key zooms out to week view (through transition)', () => {
    vi.useFakeTimers();
    const props = { ...defaultProps(), zoom: 'day' };
    render(<CalendarGrid {...props} />);
    fireEvent.keyDown(document, { key: '-' });
    expect(screen.getByTestId('zoom-transition-overlay')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(260); });
    expect(props.onZoomChange).toHaveBeenCalledWith('week');
  });

  it('does not trigger keyboard zoom when typing in an input', () => {
    const props = defaultProps();
    render(
      <>
        <input data-testid="input" />
        <CalendarGrid {...props} />
      </>,
    );
    const input = screen.getByTestId('input');
    fireEvent.keyDown(input, { key: '+' });
    expect(props.onZoomChange).not.toHaveBeenCalled();
  });

  it('does not trigger keyboard zoom with Ctrl/Cmd modifier', () => {
    const props = defaultProps();
    render(<CalendarGrid {...props} />);
    fireEvent.keyDown(document, { key: '+', ctrlKey: true });
    expect(props.onZoomChange).not.toHaveBeenCalled();
  });
});
