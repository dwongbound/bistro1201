import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import StaffControlsCard from '../pages/reserve/StaffControlsCard';

jest.mock('../common/apiClient', () => ({
  createApiFetch: jest.fn(() => jest.fn()),
}));

const PAST_TIMESTAMP = 1000000; // 2001-09-08, safely in the past
const FUTURE_TIMESTAMP = 9999999999; // 2286-11-20, safely in the future

function buildProps(overrides = {}) {
  return {
    accessCodeBusy: false,
    accessCodes: [],
    authBusy: false,
    hasAvailabilityOnSelectedDate: false,
    isMobile: false,
    isStaff: false,
    onCreateAccessCode: jest.fn(),
    onCloseDate: jest.fn(),
    onDeleteAccessCode: jest.fn(),
    onFreeSlot: jest.fn(),
    onStaffAccessCodeChange: jest.fn(),
    onUnlockStaff: jest.fn(),
    onOpenDate: jest.fn(),
    reservedDinnerTimes: [],
    selectedDate: '2026-05-01',
    selectedDinnerTime: '',
    selectedDinnerTimes: [],
    staffAccessCode: '',
    staffBusy: false,
    staffStatus: { message: '', type: '' },
    ...overrides,
  };
}

function renderCard(overrides = {}) {
  return render(<StaffControlsCard {...buildProps(overrides)} />);
}

describe('StaffControlsCard – unauthenticated', () => {
  test('shows the staff login form when not authenticated', () => {
    renderCard();

    expect(screen.getByLabelText(/Staff Access Code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock Staff Controls' })).toBeInTheDocument();
    expect(screen.queryByText('Guest Access Codes')).not.toBeInTheDocument();
  });

  test('calls onUnlockStaff when the form is submitted', () => {
    const onUnlockStaff = jest.fn((e) => e.preventDefault());
    renderCard({ onUnlockStaff });

    fireEvent.submit(screen.getByRole('button', { name: 'Unlock Staff Controls' }).closest('form'));

    expect(onUnlockStaff).toHaveBeenCalledTimes(1);
  });

  test('calls onStaffAccessCodeChange when the input changes', () => {
    const onStaffAccessCodeChange = jest.fn();
    renderCard({ onStaffAccessCodeChange });

    fireEvent.change(screen.getByLabelText(/Staff Access Code/i), { target: { value: 'mycode' } });

    expect(onStaffAccessCodeChange).toHaveBeenCalledTimes(1);
  });
});

describe('StaffControlsCard – authenticated staff', () => {
  test('shows slot management controls instead of the login form', () => {
    renderCard({ isStaff: true });

    expect(screen.queryByLabelText(/Staff Access Code/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Slot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Slot' })).toBeInTheDocument();
    expect(screen.getByText('Guest Access Codes')).toBeInTheDocument();
  });

  test('displays a success staff status message', () => {
    renderCard({ isStaff: true, staffStatus: { message: 'Slot added!', type: 'success' } });

    expect(screen.getByText('Slot added!')).toBeInTheDocument();
  });

  test('displays an error staff status message', () => {
    renderCard({ isStaff: true, staffStatus: { message: 'Something went wrong.', type: 'error' } });

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });

  test('Remove Slot button is disabled when there is no availability on the selected date', () => {
    renderCard({ isStaff: true, hasAvailabilityOnSelectedDate: false });

    expect(screen.getByRole('button', { name: 'Remove Slot' })).toBeDisabled();
  });

  test('Remove Slot button is enabled when there is availability on the selected date', () => {
    renderCard({ isStaff: true, hasAvailabilityOnSelectedDate: true, selectedDinnerTimes: ['19:00'] });

    expect(screen.getByRole('button', { name: 'Remove Slot' })).not.toBeDisabled();
  });

  test('shows "No dinner slots are open" when selectedDinnerTimes is empty', () => {
    renderCard({ isStaff: true, selectedDinnerTimes: [] });

    expect(screen.getByText('No dinner slots are open for this date yet.')).toBeInTheDocument();
  });

  test('shows dinner times as chips when selectedDinnerTimes is populated', () => {
    renderCard({ isStaff: true, selectedDinnerTimes: ['19:00', '20:30'] });

    expect(screen.getByText('7:00 PM')).toBeInTheDocument();
    expect(screen.getByText('8:30 PM')).toBeInTheDocument();
  });
});

describe('StaffControlsCard – access code list', () => {
  test('shows a placeholder when no access codes exist', () => {
    renderCard({ isStaff: true, accessCodes: [] });

    expect(screen.getByText('No guest access codes are stored yet.')).toBeInTheDocument();
  });

  test('renders each access code with its code value', () => {
    renderCard({
      isStaff: true,
      accessCodes: [
        { code: 'SPRING2026', expires_at: FUTURE_TIMESTAMP },
        { code: 'SUMMER2026', expires_at: null },
      ],
    });

    expect(screen.getByText('SPRING2026')).toBeInTheDocument();
    expect(screen.getByText('SUMMER2026')).toBeInTheDocument();
  });

  test('shows "No expiration" for a code with no expires_at', () => {
    renderCard({
      isStaff: true,
      accessCodes: [{ code: 'NOEXP', expires_at: null }],
    });

    expect(screen.getByText('No expiration')).toBeInTheDocument();
  });

  test('shows "Expired" in red for a past timestamp', () => {
    renderCard({
      isStaff: true,
      accessCodes: [{ code: 'OLDCODE', expires_at: PAST_TIMESTAMP }],
    });

    const expiredLabel = screen.getByText('Expired');
    expect(expiredLabel).toBeInTheDocument();
    // MUI applies color="error" via a generated CSS class; verify the element
    // has a different class from the non-error Typography used for future dates.
    renderCard({
      isStaff: true,
      accessCodes: [{ code: 'FUTURE', expires_at: FUTURE_TIMESTAMP }],
    });
    const futureExpiry = screen.getByText(/2286/);
    expect(expiredLabel.className).not.toBe(futureExpiry.className);
  });

  test('does not show "Expired" styling for a future timestamp', () => {
    renderCard({
      isStaff: true,
      accessCodes: [{ code: 'ACTIVECODE', expires_at: FUTURE_TIMESTAMP }],
    });

    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  test('renders a Remove Code button for each access code', () => {
    renderCard({
      isStaff: true,
      accessCodes: [
        { code: 'CODE1', expires_at: null },
        { code: 'CODE2', expires_at: null },
      ],
    });

    const removeButtons = screen.getAllByRole('button', { name: 'Remove Code' });
    expect(removeButtons).toHaveLength(2);
  });

  test('calls onDeleteAccessCode with the correct code when Remove Code is clicked', () => {
    const onDeleteAccessCode = jest.fn();
    renderCard({
      isStaff: true,
      accessCodes: [{ code: 'MYCODE', expires_at: null }],
      onDeleteAccessCode,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Code' }));

    expect(onDeleteAccessCode).toHaveBeenCalledWith('MYCODE');
  });

  test('Remove Code button is disabled when accessCodeBusy is true', () => {
    renderCard({
      isStaff: true,
      accessCodes: [{ code: 'BUSY', expires_at: null }],
      accessCodeBusy: true,
    });

    expect(screen.getByRole('button', { name: 'Remove Code' })).toBeDisabled();
  });

  test('each code row shows the code above the expiration and Remove Code button', () => {
    renderCard({
      isStaff: true,
      accessCodes: [{ code: 'ROWTEST', expires_at: null }],
    });

    // The code and its Remove Code button should be in the same list-item container.
    const codeText = screen.getByText('ROWTEST');
    const removeButton = screen.getByRole('button', { name: 'Remove Code' });
    const codeRow = codeText.closest('[class*="MuiBox"]');
    expect(codeRow).toContainElement(removeButton);
  });
});

describe('StaffControlsCard – create access code form', () => {
  test('Create Code button is disabled when the code input is empty', () => {
    renderCard({ isStaff: true });

    expect(screen.getByRole('button', { name: 'Create Code' })).toBeDisabled();
  });

  test('Create Code button becomes enabled when a code is entered', () => {
    renderCard({ isStaff: true });

    fireEvent.change(screen.getByLabelText(/New Guest Code/i), { target: { value: 'NEWCODE' } });

    expect(screen.getByRole('button', { name: 'Create Code' })).not.toBeDisabled();
  });

  test('calls onCreateAccessCode with trimmed code and expiry on submit', async () => {
    const onCreateAccessCode = jest.fn().mockResolvedValue(true);
    renderCard({ isStaff: true, onCreateAccessCode });

    fireEvent.change(screen.getByLabelText(/New Guest Code/i), { target: { value: '  TRIMMED  ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Code' }).closest('form'));

    await waitFor(() => {
      expect(onCreateAccessCode).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'TRIMMED', expiresAt: '' }),
      );
    });
  });

  test('clears the form after a successful create', async () => {
    const onCreateAccessCode = jest.fn().mockResolvedValue(true);
    renderCard({ isStaff: true, onCreateAccessCode });

    const input = screen.getByLabelText(/New Guest Code/i);
    fireEvent.change(input, { target: { value: 'NEWCODE' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  test('does not clear the form after a failed create', async () => {
    const onCreateAccessCode = jest.fn().mockResolvedValue(false);
    renderCard({ isStaff: true, onCreateAccessCode });

    const input = screen.getByLabelText(/New Guest Code/i);
    fireEvent.change(input, { target: { value: 'FAILCODE' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(onCreateAccessCode).toHaveBeenCalled();
    });
    expect(input.value).toBe('FAILCODE');
  });
});

describe('StaffControlsCard – Add Slot dialog', () => {
  test('opens the Set Dinner Time dialog when Add Slot is clicked', () => {
    renderCard({ isStaff: true });

    fireEvent.click(screen.getByRole('button', { name: 'Add Slot' }));

    expect(screen.getByRole('dialog', { name: 'Set Dinner Time' })).toBeInTheDocument();
  });

  test('closes the dialog when Cancel is clicked', async () => {
    renderCard({ isStaff: true });

    fireEvent.click(screen.getByRole('button', { name: 'Add Slot' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  test('calls onOpenDate with the selected dinner time on submit', async () => {
    const onOpenDate = jest.fn().mockResolvedValue(true);
    renderCard({ isStaff: true, onOpenDate });

    fireEvent.click(screen.getByRole('button', { name: 'Add Slot' }));

    const dialog = screen.getByRole('dialog');
    const timeInput = within(dialog).getByLabelText(/Dinner Time/i);
    fireEvent.change(timeInput, { target: { value: '20:00' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and Open' }));

    await waitFor(() => {
      expect(onOpenDate).toHaveBeenCalledWith('20:00');
    });
  });
});

describe('StaffControlsCard – Remove Slot dialog', () => {
  test('opens the Remove Dinner Slot dialog when Remove Slot is clicked', () => {
    renderCard({ isStaff: true, hasAvailabilityOnSelectedDate: true, selectedDinnerTimes: ['19:00'] });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Slot' }));

    expect(screen.getByRole('dialog', { name: 'Remove Dinner Slot' })).toBeInTheDocument();
  });

  test('Confirm button is disabled until a slot is selected', () => {
    renderCard({ isStaff: true, hasAvailabilityOnSelectedDate: true, selectedDinnerTimes: ['19:00'] });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Slot' }));

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  test('calls onCloseDate with the selected time after confirming', async () => {
    const onCloseDate = jest.fn().mockResolvedValue(true);
    renderCard({
      isStaff: true,
      hasAvailabilityOnSelectedDate: true,
      selectedDinnerTimes: ['19:00'],
      onCloseDate,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Slot' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '7:00 PM' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(onCloseDate).toHaveBeenCalledWith('19:00');
    });
  });

  test('shows a warning when the selected slot is reserved', () => {
    renderCard({
      isStaff: true,
      hasAvailabilityOnSelectedDate: true,
      selectedDinnerTimes: ['19:00'],
      reservedDinnerTimes: ['19:00'],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Slot' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '7:00 PM' }));

    expect(screen.getByText(/Removing a reserved slot/i)).toBeInTheDocument();
  });
});
