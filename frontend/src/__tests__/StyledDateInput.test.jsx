import { fireEvent, render, screen, within } from '@testing-library/react';
import StyledDateInput from '../common/StyledDateInput';

const FIXED_TODAY = '2026-04-15';

function renderPicker(props = {}) {
  return render(
    <StyledDateInput
      id="test-date"
      label="Date"
      name="date"
      onChange={jest.fn()}
      value={FIXED_TODAY}
      {...props}
    />,
  );
}

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: 'Date' }));
}

function getDay(dateKey) {
  return screen.getByTestId(dateKey);
}

function queryDot(dateKey) {
  const button = getDay(dateKey);
  return within(button).queryByTestId('availability-dot');
}

describe('StyledDateInput', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(`${FIXED_TODAY}T12:00:00Z`));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('opens the calendar popover when clicked', () => {
    renderPicker();
    openPopover();
    expect(screen.getByTestId(FIXED_TODAY)).toBeInTheDocument();
  });

  test('shows availability dot on available dates', () => {
    const availableDateSet = new Set(['2026-04-20', '2026-04-27']);
    renderPicker({ availableDateSet });
    openPopover();

    expect(queryDot('2026-04-20')).toBeInTheDocument();
    expect(queryDot('2026-04-27')).toBeInTheDocument();
  });

  test('does not show availability dot on non-available dates', () => {
    const availableDateSet = new Set(['2026-04-20']);
    renderPicker({ availableDateSet });
    openPopover();

    expect(queryDot('2026-04-18')).not.toBeInTheDocument();
    expect(queryDot('2026-04-22')).not.toBeInTheDocument();
  });

  test('does not show availability dot on the selected date even if available', () => {
    const availableDateSet = new Set([FIXED_TODAY]);
    renderPicker({ value: FIXED_TODAY, availableDateSet });
    openPopover();

    expect(queryDot(FIXED_TODAY)).not.toBeInTheDocument();
  });

  test('renders without availableDateSet without crashing', () => {
    renderPicker({ availableDateSet: undefined });
    openPopover();

    const dots = screen.queryAllByTestId('availability-dot');
    expect(dots).toHaveLength(0);
  });

  test('calls onChange with the clicked date', () => {
    const onChange = jest.fn();
    const availableDateSet = new Set(['2026-04-22']);
    renderPicker({ onChange, availableDateSet });
    openPopover();

    fireEvent.click(getDay('2026-04-22'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2026-04-22' }) }),
    );
  });

  test('does not call onChange for a disabled (past) date', () => {
    const onChange = jest.fn();
    renderPicker({ onChange, min: FIXED_TODAY });
    openPopover();

    fireEvent.click(getDay('2026-04-10'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
