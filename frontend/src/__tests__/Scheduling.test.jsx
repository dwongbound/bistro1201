import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readGuestAccessCode, readStaffAccessCode } from '../common/reserveAccessCookie';
import { DEFAULT_GUEST_ACCESS_CODE, DEFAULT_STAFF_ACCESS_CODE } from '../test/accessCodeFixtures';
import { formatHumanDate, formatHumanTime } from '../pages/reserve/reserve';
import Scheduling from '../pages/reserve/Scheduling';

global.fetch = jest.fn();

/**
 * Finds a form input by its name attribute so tests can interact with native date/time fields.
 */
function getInputByName(name) {
  const input = document.querySelector(`input[name="${name}"]`);
  if (!input) {
    throw new Error(`Missing input with name "${name}"`);
  }
  return input;
}

/**
 * Verifies that a mocked fetch call used the expected URL and sent a bearer token.
 */
function expectBearerCall(call, url) {
  expect(call[0]).toBe(url);
  expect(call[1].headers.get('Authorization')).toMatch(/^Bearer /);
}

/**
 * Creates a fetch mock that returns responses based on the requested URL instead of call order.
 */
function mockFetchByUrl(handlers) {
  fetch.mockImplementation(async (input, init = {}) => {
    const method = init.method || 'GET';
    const key = `${method} ${input}`;
    const handler = handlers[key];

    if (!handler) {
      throw new Error(`Unhandled fetch mock for ${key}`);
    }

    return typeof handler === 'function' ? handler(input, init) : handler;
  });
}

/**
 * Formats a Date object into the YYYY-MM-DD strings used by the reserve form.
 */
function formatTestDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Creates a test date offset by a given number of days from today.
 */
function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatTestDate(date);
}

/**
 * Creates a test date offset by a given number of months from today.
 */
function addMonths(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return formatTestDate(date);
}

async function submitGuestAccessCode(user, code) {
  await act(async () => {
    await user.type(screen.getByPlaceholderText('Access Code'), code);
    await user.click(screen.getByText('Submit'));
  });
}

async function unlockStaffControls(user, code = DEFAULT_STAFF_ACCESS_CODE) {
  await act(async () => {
    await user.type(screen.getByPlaceholderText('Staff Access Code'), code);
    await user.click(screen.getByText('Unlock Staff Controls'));
  });
}

describe('Scheduling Component', () => {
  beforeEach(() => {
    fetch.mockReset();
    window.sessionStorage.clear();
    document.cookie = 'bistro_guest_access_code=; Max-Age=0; Path=/';
    document.cookie = 'bistro_staff_access_code=; Max-Age=0; Path=/';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows the backend-authenticated access form initially', () => {
    render(<Scheduling />);
    expect(screen.getByText('Enter an Access Code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Access Code')).toBeInTheDocument();
  });

  test('signs in and loads protected data with a bearer token', async () => {
    const user = userEvent.setup();
    const openDate = addDays(14);
    const today = new Date().toISOString().slice(0, 10);
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: openDate, dinner_time: '19:00' }],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Reserve an Evening')).toBeInTheDocument();
      expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: DEFAULT_GUEST_ACCESS_CODE }),
      });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    expectBearerCall(fetch.mock.calls[1], '/api/reservations');
    expectBearerCall(fetch.mock.calls[2], '/api/availability');
    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue(today);
    });
  });

  test('stores the guest access code in a cookie after a successful sign-in', async () => {
    const user = userEvent.setup();
    const openDate = addDays(14);
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: openDate, dinner_time: '19:00' }],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Reserve an Evening')).toBeInTheDocument();
    });

    expect(document.cookie).toContain(`bistro_guest_access_code=${DEFAULT_GUEST_ACCESS_CODE}`);
  });

  test('stores the staff access code too when the guest form logs in with a staff code', async () => {
    const user = userEvent.setup();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'staff-token', role: 'staff' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          availability: { date: '2026-03-24', dinner_time: '19:00' },
          removed_reservation: null,
          cancellation_email_sent: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_STAFF_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Add Slot')).toBeInTheDocument();
    });

    expect(readGuestAccessCode()).toBe(DEFAULT_STAFF_ACCESS_CODE);
    expect(readStaffAccessCode()).toBe(DEFAULT_STAFF_ACCESS_CODE);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Remove Slot' }));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(8);
    });

    expect(fetch.mock.calls[4][0]).toBe('/api/availability/2026-03-24?dinner_time=19%3A00');
    expect(fetch.mock.calls[4][1].method).toBe('DELETE');
    expect(fetch.mock.calls[4][1].headers.get('Authorization')).toBe('Bearer staff-token');
    expect(fetch.mock.calls[4][1].headers.get('X-Service-Key')).toBe(DEFAULT_STAFF_ACCESS_CODE);
  });

  test('auto reauthenticates with a remembered guest access cookie', async () => {
    const openDate = addDays(14);
    document.cookie = `bistro_guest_access_code=${DEFAULT_GUEST_ACCESS_CODE}; Path=/`;
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: openDate, dinner_time: '19:00' }],
      });

    render(<Scheduling />);

    await waitFor(() => {
      expect(screen.getByText('Reserve an Evening')).toBeInTheDocument();
      expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: DEFAULT_GUEST_ACCESS_CODE }),
      });
    });
  });

  test('clears an invalid remembered guest access cookie', async () => {
    document.cookie = 'bistro_guest_access_code=expired-code; Path=/';
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid access code' }),
    });

    render(<Scheduling />);

    await waitFor(() => {
      expect(screen.getByText('Enter an Access Code')).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(readGuestAccessCode()).toBe('');
    });
    expect(screen.queryByText('Invalid access code')).not.toBeInTheDocument();
  });

  test('shows an error for an invalid access code', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid access code' }),
    });

    render(<Scheduling />);

    await submitGuestAccessCode(user, 'wrongpassword');

    await waitFor(() => {
      expect(screen.getByText('Invalid access code')).toBeInTheDocument();
    });
  });

  test('submits booking form successfully for an available date', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const openDate = '2026-03-24';
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: openDate, dinner_time: '19:00' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reservation: {
            id: 1,
            date: openDate,
            time: '19:00',
            name: 'John Doe',
            email: 'john@example.com',
          },
          confirmation_email_sent: true,
        }),
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Guest Reservation')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: formatHumanDate(openDate) })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: formatHumanDate(openDate) }));

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue(openDate);
      expect(screen.getByText(`Selected time: ${formatHumanTime('19:00')}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: formatHumanTime('19:00') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm Reservation' })).toBeDisabled();
    });

    fireEvent.change(getInputByName('name'), { target: { name: 'name', value: 'John Doe' } });
    fireEvent.change(getInputByName('email'), {
      target: { name: 'email', value: 'john@example.com' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm Reservation' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Confirm Reservation' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    expect(fetch.mock.calls[3][0]).toBe('/api/reservations');
    expect(fetch.mock.calls[3][1].method).toBe('POST');
    expect(fetch.mock.calls[3][1].headers.get('Authorization')).toBe('Bearer guest-token');
    expect(fetch.mock.calls[3][1].headers.get('Content-Type')).toBe('application/json');
    expect(fetch.mock.calls[3][1].body).toBe(
      JSON.stringify({
        date: openDate,
        time: '19:00',
        name: 'John Doe',
        email: 'john@example.com',
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Reservation Confirmed' })).toBeInTheDocument();
      expect(
        screen.getByText('Your reservation is confirmed, and a confirmation email has been sent.'),
      ).toBeInTheDocument();
      expect(getInputByName('name')).toHaveValue('');
      expect(getInputByName('email')).toHaveValue('');
    });
  });

  test('keeps the other slot available after booking one of two dinner times', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const openDate = '2026-03-24';
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { date: openDate, dinner_time: '19:00' },
          { date: openDate, dinner_time: '21:00' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reservation: {
            id: 1,
            date: openDate,
            time: '19:00',
            name: 'John Doe',
            email: 'john@example.com',
          },
          confirmation_email_sent: false,
        }),
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Guest Reservation')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: formatHumanDate(openDate) })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: formatHumanDate(openDate) }));

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue(openDate);
      expect(screen.getByRole('button', { name: formatHumanTime('19:00') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: formatHumanTime('21:00') })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: formatHumanTime('19:00') }));

    fireEvent.change(getInputByName('name'), { target: { name: 'name', value: 'John Doe' } });
    fireEvent.change(getInputByName('email'), {
      target: { name: 'email', value: 'john@example.com' },
    });

    await user.click(screen.getByRole('button', { name: 'Confirm Reservation' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Reservation Confirmed' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: formatHumanTime('19:00') })).not.toBeInTheDocument();
      expect(screen.getByText(formatHumanTime('19:00'))).toBeInTheDocument();
      expect(screen.getByRole('button', { name: formatHumanTime('21:00') })).toBeInTheDocument();
    });
  });

  test('allows guests to choose only one reservation time at a time on the same day', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const openDate = '2026-03-24';
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { date: openDate, dinner_time: '19:00' },
          { date: openDate, dinner_time: '20:30' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reservation: {
            id: 2,
            date: openDate,
            time: '20:30',
            name: 'Jane Doe',
            email: 'jane@example.com',
          },
          confirmation_email_sent: false,
        }),
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Guest Reservation')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: formatHumanDate(openDate) }));

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue(openDate);
      expect(screen.getByRole('button', { name: formatHumanTime('20:30') })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: formatHumanTime('20:30') }));
    expect(getInputByName('time')).toHaveValue('20:30');

    await user.click(screen.getByRole('button', { name: formatHumanTime('19:00') }));
    expect(getInputByName('time')).toHaveValue('19:00');

    await user.click(screen.getByRole('button', { name: formatHumanTime('20:30') }));
    expect(getInputByName('time')).toHaveValue('20:30');
    fireEvent.change(getInputByName('name'), { target: { name: 'name', value: 'Jane Doe' } });
    fireEvent.change(getInputByName('email'), {
      target: { name: 'email', value: 'jane@example.com' },
    });

    await user.click(screen.getByRole('button', { name: 'Confirm Reservation' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    expect(fetch.mock.calls[3][1].body).toBe(
      JSON.stringify({
        date: openDate,
        time: '20:30',
        name: 'Jane Doe',
        email: 'jane@example.com',
      }),
    );
  });

  test('allows a guest session to upgrade to staff access', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'staff-token', role: 'staff' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ date: '2026-03-24', dinner_time: '19:00' }),
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Unlock Staff Controls')).toBeInTheDocument();
    });

    await unlockStaffControls(user);

    await waitFor(() => {
      expect(fetch).toHaveBeenNthCalledWith(4, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: DEFAULT_STAFF_ACCESS_CODE }),
      });
      expect(screen.getByText('Add Slot')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tuesday, March 24' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Tuesday, March 24' }));

    await waitFor(() => {
      expect(screen.getByText('Selected date: Tuesday, March 24')).toBeInTheDocument();
      expect(getInputByName('date')).toHaveValue('2026-03-24');
    });

    await user.click(screen.getByText('Add Slot'));
    const dinnerTimeInput = document.querySelector('input[name="dinner_time"]');
    if (!dinnerTimeInput) {
      throw new Error('Missing dinner time input');
    }
    fireEvent.change(dinnerTimeInput, { target: { value: '19:00' } });
    await user.click(screen.getByText('Save and Open'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(8);
    });

    expect(fetch.mock.calls[7][0]).toBe('/api/availability');
    expect(fetch.mock.calls[7][1].method).toBe('POST');
    expect(fetch.mock.calls[7][1].headers.get('Authorization')).toBe('Bearer staff-token');
    expect(fetch.mock.calls[7][1].headers.get('Content-Type')).toBe('application/json');
    expect(fetch.mock.calls[7][1].body).toBe(JSON.stringify({ date: '2026-03-24', dinner_time: '19:00' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: formatHumanTime('19:00') })).toBeInTheDocument();
      expect(screen.getByText(`Selected time: ${formatHumanTime('19:00')}`)).toBeInTheDocument();
      expect(getInputByName('date')).toHaveValue('2026-03-24');
      expect(getInputByName('time')).toHaveValue('19:00');
    });
  });

  test('stores the staff access code in a cookie after a successful upgrade', async () => {
    const user = userEvent.setup();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'staff-token', role: 'staff' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Unlock Staff Controls')).toBeInTheDocument();
    });

    await unlockStaffControls(user);

    await waitFor(() => {
      expect(screen.getByText('Add Slot')).toBeInTheDocument();
    });

    expect(readStaffAccessCode()).toBe(DEFAULT_STAFF_ACCESS_CODE);
  });

  test('auto reauthenticates staff controls with a remembered staff access cookie', async () => {
    const openDate = addDays(14);
    document.cookie = `bistro_guest_access_code=${DEFAULT_GUEST_ACCESS_CODE}; Path=/`;
    document.cookie = `bistro_staff_access_code=${DEFAULT_STAFF_ACCESS_CODE}; Path=/`;
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'staff-token', role: 'staff' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: openDate, dinner_time: '19:00' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<Scheduling />);

    await waitFor(() => {
      expect(screen.getByText('Add Slot')).toBeInTheDocument();
      expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: DEFAULT_STAFF_ACCESS_CODE }),
      });
      expect(fetch).toHaveBeenCalledTimes(4);
    });
  });

  test('clears an invalid remembered staff access cookie', async () => {
    const openDate = addDays(14);
    document.cookie = `bistro_guest_access_code=${DEFAULT_GUEST_ACCESS_CODE}; Path=/`;
    document.cookie = 'bistro_staff_access_code=expired-staff; Path=/';
    fetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid access code' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: openDate, dinner_time: '19:00' }],
      });

    render(<Scheduling />);

    await waitFor(() => {
      expect(screen.getByText('Unlock Staff Controls')).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledTimes(4);
      expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'expired-staff' }),
      });
      expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: DEFAULT_GUEST_ACCESS_CODE }),
      });
    });

    await waitFor(() => {
      expect(readStaffAccessCode()).toBe('');
    });
  });

  test('lets staff choose which slot to remove after clicking remove slot', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    let loginCount = 0;
    mockFetchByUrl({
      'POST /api/auth/login': async () => {
        loginCount += 1;
        return {
          ok: true,
          json: async () =>
            loginCount === 1
              ? { token: 'guest-token', role: 'guest' }
              : { token: 'staff-token', role: 'staff' },
        };
      },
      'GET /api/reservations': {
        ok: true,
        json: async () => [],
      },
      'GET /api/availability': {
        ok: true,
        json: async () => [
          { date: '2026-03-24', dinner_time: '19:00' },
          { date: '2026-03-24', dinner_time: '20:00' },
        ],
      },
      'GET /api/access-codes': {
        ok: true,
        json: async () => [],
      },
      'DELETE /api/availability/2026-03-24?dinner_time=20%3A00': {
        ok: true,
        json: async () => ({
          availability: { date: '2026-03-24', dinner_time: '20:00' },
          removed_reservation: null,
          cancellation_email_sent: false,
        }),
      },
    });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Unlock Staff Controls')).toBeInTheDocument();
    });

    await unlockStaffControls(user);

    await user.click(screen.getByRole('button', { name: 'Tuesday, March 24' }));

    await waitFor(() => {
      expect(screen.getByText('1201 Team Access')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove Slot' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Remove Slot' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Remove Dinner Slot' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: formatHumanTime('19:00') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: formatHumanTime('20:00') })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: formatHumanTime('20:00') }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(8);
    });

    expect(fetch.mock.calls[7][0]).toBe('/api/availability/2026-03-24?dinner_time=20%3A00');
    expect(fetch.mock.calls[7][1].method).toBe('DELETE');
    expect(fetch.mock.calls[7][1].headers.get('Authorization')).toBe('Bearer staff-token');
  });

  test('shows the remove chooser even when only one slot is open', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    let loginCount = 0;
    mockFetchByUrl({
      'POST /api/auth/login': async () => {
        loginCount += 1;
        return {
          ok: true,
          json: async () =>
            loginCount === 1
              ? { token: 'guest-token', role: 'guest' }
              : { token: 'staff-token', role: 'staff' },
        };
      },
      'GET /api/reservations': {
        ok: true,
        json: async () => [],
      },
      'GET /api/availability': {
        ok: true,
        json: async () => [{ date: '2026-03-24', dinner_time: '19:00' }],
      },
      'GET /api/access-codes': {
        ok: true,
        json: async () => [],
      },
      'DELETE /api/availability/2026-03-24?dinner_time=19%3A00': {
        ok: true,
        json: async () => ({
          availability: { date: '2026-03-24', dinner_time: '19:00' },
          removed_reservation: null,
          cancellation_email_sent: false,
        }),
      },
    });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Unlock Staff Controls')).toBeInTheDocument();
    });

    await unlockStaffControls(user);

    await user.click(screen.getByRole('button', { name: 'Tuesday, March 24' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove Slot' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Remove Slot' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Remove Dinner Slot' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: formatHumanTime('19:00') })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: formatHumanTime('19:00') }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(8);
    });

    expect(fetch.mock.calls[7][0]).toBe('/api/availability/2026-03-24?dinner_time=19%3A00');
    expect(fetch.mock.calls[7][1].method).toBe('DELETE');
  });

  test('removing a reserved slot cancels it and shows the cancellation confirmation dialog', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    let loginCount = 0;
    mockFetchByUrl({
      'POST /api/auth/login': async () => {
        loginCount += 1;
        return {
          ok: true,
          json: async () =>
            loginCount === 1
              ? { token: 'guest-token', role: 'guest' }
              : { token: 'staff-token', role: 'staff' },
        };
      },
      'GET /api/reservations': {
        ok: true,
        json: async () => [
          {
            id: 9,
            date: '2026-03-24',
            time: '19:00',
            name: 'Jane Doe',
            email: 'jane@example.com',
          },
        ],
      },
      'GET /api/availability': {
        ok: true,
        json: async () => [
          { date: '2026-03-24', dinner_time: '19:00' },
          { date: '2026-03-24', dinner_time: '20:00' },
        ],
      },
      'GET /api/access-codes': {
        ok: true,
        json: async () => [],
      },
      'DELETE /api/availability/2026-03-24?dinner_time=19%3A00': {
        ok: true,
        json: async () => ({
          availability: { date: '2026-03-24', dinner_time: '19:00' },
          removed_reservation: {
            id: 9,
            date: '2026-03-24',
            time: '19:00',
            name: 'Jane Doe',
            email: 'jane@example.com',
          },
          cancellation_email_sent: true,
        }),
      },
    });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Unlock Staff Controls')).toBeInTheDocument();
    });

    await unlockStaffControls(user);

    await user.click(screen.getByRole('button', { name: 'Tuesday, March 24' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove Slot' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Remove Slot' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Remove Dinner Slot' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: formatHumanTime('19:00') })).toBeInTheDocument();
    });

    const removeDialog = screen.getByRole('dialog', { name: 'Remove Dinner Slot' });
    expect(within(removeDialog).getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await user.click(
      within(removeDialog).getByRole('button', {
        name: formatHumanTime('19:00'),
      }),
    );
    await user.click(within(removeDialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(8);
    });

    const matchingRemoveCall = fetch.mock.calls.find(
      (call) => call[0] === '/api/availability/2026-03-24?dinner_time=19%3A00',
    );
    expect(matchingRemoveCall).toBeDefined();
    expect(matchingRemoveCall[1].method).toBe('DELETE');
    expect(matchingRemoveCall[1].headers.get('Authorization')).toBe('Bearer staff-token');
  });

  test('lets staff manage guest access codes from the staff controls card', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: '2026-03-24', dinner_time: '19:00' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'staff-token', role: 'staff' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: '2026-03-24', dinner_time: '19:00' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ code: 'vip-preview', role: 'guest', expires_at: null, created_at: 1800000000 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'spring-preview',
          role: 'guest',
          expires_at: null,
          created_at: 1800000001,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'vip-preview',
          role: 'guest',
          expires_at: null,
          created_at: 1800000000,
        }),
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Unlock Staff Controls')).toBeInTheDocument();
    });

    await unlockStaffControls(user);

    await waitFor(() => {
      expect(screen.getByText('Guest Access Codes')).toBeInTheDocument();
      expect(screen.getByText('vip-preview')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('New Guest Code'), 'spring-preview');
    await user.click(screen.getByRole('button', { name: 'Select date and time' }));
    await user.click(screen.getAllByRole('button', { name: '20' })[0]);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Hour' }));
    await user.click(screen.getByRole('option', { name: '6' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Minute' }));
    await user.click(screen.getByRole('option', { name: '30' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'AM / PM' }));
    await user.click(screen.getByRole('option', { name: 'PM' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: 'Create Code' }));

    await waitFor(() => {
      expect(screen.getByText('spring-preview')).toBeInTheDocument();
    });

    expect(fetch.mock.calls[7][0]).toBe('/api/access-codes');
    expect(fetch.mock.calls[7][1].method).toBe('POST');
    expect(fetch.mock.calls[7][1].headers.get('Authorization')).toBe('Bearer staff-token');
    expect(fetch.mock.calls[7][1].body).toBe(
      JSON.stringify({
        code: 'spring-preview',
        expires_at: new Date('2026-03-20T18:30').toISOString(),
      }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Remove Code' })[1]);

    await waitFor(() => {
      expect(screen.queryByText('vip-preview')).not.toBeInTheDocument();
    });

    expect(fetch.mock.calls[8][0]).toBe('/api/access-codes/vip-preview');
    expect(fetch.mock.calls[8][1].method).toBe('DELETE');
    expect(fetch.mock.calls[8][1].headers.get('Authorization')).toBe('Bearer staff-token');
  });

  test('defaults the guest reservation date to the current calendar day', async () => {
    const user = userEvent.setup();
    const today = new Date().toISOString().slice(0, 10);
    const withinWindowDate = addDays(14);
    const laterWithinWindowDate = addDays(28);
    const outsideWindowDate = addMonths(3);
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { date: outsideWindowDate, dinner_time: '20:00' },
          { date: laterWithinWindowDate, dinner_time: '20:00' },
          { date: withinWindowDate, dinner_time: '19:00' },
        ],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue(today);
    });
  });

  test('shows that no guest availabilities are open when none exist', async () => {
    const user = userEvent.setup();
    const today = new Date().toISOString().slice(0, 10);
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue(today);
      expect(screen.getByRole('button', { name: 'Confirm Reservation' })).toBeDisabled();
      expect(screen.getByText('There are no availabilities for this day.')).toBeInTheDocument();
    });
  });

  test('keeps the calendar valid when availability exists only outside the guest window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-26T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const today = '2026-03-26';
    const outsideWindowDate = '2026-07-01';
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: outsideWindowDate, dinner_time: '19:00' }],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue(today);
      expect(screen.getByText('March 2026')).toBeInTheDocument();
      expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
      expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    });
  });

  test('shows open dates in the calendar and lets guests jump to another one', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const today = '2026-03-15';
    const firstOpenDate = '2026-03-18';
    const secondOpenDate = '2026-03-27';
    const outsideWindowDate = '2026-06-20';
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { date: firstOpenDate, dinner_time: '18:30' },
          { date: secondOpenDate, dinner_time: '20:00' },
          { date: outsideWindowDate, dinner_time: '19:00' },
        ],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue(today);
      expect(screen.getByRole('button', { name: formatHumanDate(secondOpenDate) })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: formatHumanDate(secondOpenDate) }));

    expect(getInputByName('date')).toHaveValue(secondOpenDate);
  });

  test('clicking an open date in the calendar updates the selected day and reservation form', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 7,
            date: '2026-03-20',
            time: '18:30',
            name: 'Evening Guest',
            email: 'guest@example.com',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { date: '2026-03-18', dinner_time: '18:00' },
          { date: '2026-03-20', dinner_time: '18:30' },
        ],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue('2026-03-15');
    });

    await user.click(screen.getAllByRole('button', { name: 'Friday, March 20' })[0]);

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue('2026-03-20');
      expect(screen.getByText('There are no availabilities for this day.')).toBeInTheDocument();
      expect(screen.getByText(formatHumanTime('18:30'))).toBeInTheDocument();
    });
  });

  test('prevents past dates while still allowing guests to inspect future closed dates', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: '2026-03-20', dinner_time: '18:30' }],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(getInputByName('date')).toHaveValue('2026-03-15');
    });

    const pastDayButton = screen.getByRole('button', { name: 'Saturday, March 14' });
    const unavailableFutureDayButton = screen.getByRole('button', { name: 'Wednesday, March 18' });

    expect(pastDayButton).toBeDisabled();
    expect(unavailableFutureDayButton).toBeEnabled();
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();

    await user.click(pastDayButton);
    await user.click(unavailableFutureDayButton);

    expect(getInputByName('date')).toHaveValue('2026-03-18');
    expect(
      screen.getByText(
        `There are no availabilities for this day. Next available slot is ${formatHumanDate('2026-03-20')} at ${formatHumanTime('18:30')}.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Reservation' })).toBeDisabled();
  });

  test('clicking a visible day from another month refreshes the calendar to that month', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'guest-token', role: 'guest' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ date: '2026-03-18', dinner_time: '19:00' }],
      });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('March 2026')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Thursday, April 2' }));

    await waitFor(() => {
      expect(screen.getByText('April 2026')).toBeInTheDocument();
      expect(getInputByName('date')).toHaveValue('2026-04-02');
    });
  });

  test('lets staff free a reserved slot and shows the cancellation confirmation dialog', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T12:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    let loginCount = 0;
    mockFetchByUrl({
      'POST /api/auth/login': async () => {
        loginCount += 1;
        return {
          ok: true,
          json: async () =>
            loginCount === 1
              ? { token: 'guest-token', role: 'guest' }
              : { token: 'staff-token', role: 'staff' },
        };
      },
      'GET /api/reservations': {
        ok: true,
        json: async () => [
          {
            id: 9,
            date: '2026-03-24',
            time: '19:00',
            name: 'Jane Doe',
            email: 'jane@example.com',
          },
        ],
      },
      'GET /api/availability': {
        ok: true,
        json: async () => [
          { date: '2026-03-24', dinner_time: '19:00' },
          { date: '2026-03-24', dinner_time: '20:00' },
        ],
      },
      'GET /api/access-codes': {
        ok: true,
        json: async () => [],
      },
      'DELETE /api/reservations/2026-03-24?time=19%3A00': {
        ok: true,
        json: async () => ({
          reservation: {
            id: 9,
            date: '2026-03-24',
            time: '19:00',
            name: 'Jane Doe',
            email: 'jane@example.com',
          },
          cancellation_email_sent: true,
        }),
      },
    });

    render(<Scheduling />);

    await submitGuestAccessCode(user, DEFAULT_GUEST_ACCESS_CODE);

    await waitFor(() => {
      expect(screen.getByText('Unlock Staff Controls')).toBeInTheDocument();
    });

    await unlockStaffControls(user);

    await user.click(screen.getByRole('button', { name: 'Tuesday, March 24' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Free Slot' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Free Slot' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Free Reserved Slot' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: formatHumanTime('19:00') })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: formatHumanTime('20:00') })).not.toBeInTheDocument();
    expect(
      screen.getByText(/This will send a cancellation email to the guest on that reservation/i),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: formatHumanTime('19:00') }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cancellation Sent' })).toBeInTheDocument();
      expect(screen.getByText(/cancellation email has been sent/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Free Slot' })).toBeDisabled();
    });

    expect(fetch.mock.calls[7][0]).toBe('/api/reservations/2026-03-24?time=19%3A00');
    expect(fetch.mock.calls[7][1].method).toBe('DELETE');
    expect(fetch.mock.calls[7][1].headers.get('Authorization')).toBe('Bearer staff-token');
  });
});
