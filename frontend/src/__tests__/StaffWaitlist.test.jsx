import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffWaitlist from '../pages/reserve/StaffWaitlist';

// Mock cookie helpers so saved codes don't bleed between tests.
jest.mock('../common/reserveAccessCookie', () => ({
  readStaffAccessCode: jest.fn(() => ''),
  saveStaffAccessCode: jest.fn(),
  clearStaffAccessCode: jest.fn(),
}));

jest.mock('../common/appConfig', () => ({
  getApiUrl: jest.fn(() => 'http://localhost:3000/api'),
}));

jest.mock('../common/apiClient', () => ({
  createApiFetch: jest.fn(() => jest.fn()),
}));

const { createApiFetch } = require('../common/apiClient');
const { readStaffAccessCode } = require('../common/reserveAccessCookie');

const STAFF_CODE = 'staffcode';

function makeEntry(overrides = {}) {
  return {
    id: 1,
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    notes: 'No nuts please',
    staff_note: '',
    sort_order: 0,
    created_at: 1000000,
    contacted_code: null,
    ...overrides,
  };
}

function makePageResponse(entries = [makeEntry()], total = null) {
  return {
    ok: true,
    json: async () => ({ entries, total: total ?? entries.length }),
  };
}

function mockLoginResponse(role = 'staff') {
  return {
    ok: true,
    json: async () => ({ token: 'test-token', role }),
  };
}

async function loginAsStaff(user) {
  await user.type(screen.getByLabelText(/staff access code/i), STAFF_CODE);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('StaffWaitlist', () => {
  let mockApiFetch;

  beforeEach(() => {
    jest.resetAllMocks();
    readStaffAccessCode.mockReturnValue('');
    mockApiFetch = jest.fn();
    createApiFetch.mockReturnValue(mockApiFetch);
    global.fetch = jest.fn();
  });

  describe('auth gate', () => {
    it('shows a sign-in form before authentication', () => {
      render(<StaffWaitlist />);
      expect(screen.getByRole('heading', { name: /waitlist admin/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/staff access code/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('shows an error when the access code is rejected', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Invalid access code.' }) });

      render(<StaffWaitlist />);
      await loginAsStaff(user);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid access code/i);
      });
    });

    it('shows an error when a guest code is submitted instead of a staff code', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce(mockLoginResponse('guest'));

      render(<StaffWaitlist />);
      await loginAsStaff(user);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/staff access required/i);
      });
    });
  });

  describe('authenticated — waitlist display', () => {
    async function renderAndLogin(entries) {
      const user = userEvent.setup();
      // login
      global.fetch.mockResolvedValueOnce(mockLoginResponse('staff'));
      // GET /waitlist
      mockApiFetch.mockResolvedValueOnce(makePageResponse(entries));

      render(<StaffWaitlist />);
      await loginAsStaff(user);
      await waitFor(() => {
        expect(screen.queryByLabelText(/staff access code/i)).not.toBeInTheDocument();
      });
      return user;
    }

    it('shows the entry name while keeping personal details behind the details trigger', async () => {
      await renderAndLogin([makeEntry()]);
      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /view details for jane doe/i })).toBeInTheDocument();
      });
      expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();
    });

    it('shows a Contacted chip for entries that have been contacted', async () => {
      await renderAndLogin([makeEntry({ contacted_code: 'jane_doe1' })]);
      await waitFor(() => {
        expect(screen.getByText('Contacted')).toBeInTheDocument();
      });
    });

    it('shows an empty message when the list is empty', async () => {
      await renderAndLogin([]);
      await waitFor(() => {
        expect(screen.getByText(/the waitlist is empty/i)).toBeInTheDocument();
      });
    });

    it('shows hidden details in a tooltip when the details button is clicked', async () => {
      const user = await renderAndLogin([makeEntry()]);
      const detailsButton = await screen.findByRole('button', { name: /view details for jane doe/i });

      expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();
      await user.click(detailsButton);
      expect(await screen.findByText('jane@example.com')).toBeVisible();
      expect(screen.getByText('555-0100')).toBeVisible();
      expect(screen.getByText('No nuts please')).toBeVisible();
    });

  });

  describe('authenticated — delete', () => {
    async function renderWithEntry() {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce(mockLoginResponse('staff'));
      mockApiFetch.mockResolvedValueOnce(makePageResponse([makeEntry()]));

      render(<StaffWaitlist />);
      await loginAsStaff(user);
      await waitFor(() => screen.getByText('Jane Doe'));
      return user;
    }

    it('opens a confirmation dialog when Delete is clicked', async () => {
      const user = await renderWithEntry();
      await user.click(screen.getByRole('button', { name: /delete jane doe/i }));
      expect(await screen.findByRole('dialog', { name: /remove from waitlist/i })).toBeInTheDocument();
    });

    it('removes the entry after confirming delete', async () => {
      const user = await renderWithEntry();
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => makeEntry() });

      await user.click(screen.getByRole('button', { name: /delete jane doe/i }));
      const dialog = await screen.findByRole('dialog', { name: /remove from waitlist/i });
      await user.click(within(dialog).getByRole('button', { name: /remove/i }));

      await waitFor(() => {
        expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
      });
    });
  });

  describe('authenticated — note', () => {
    async function renderWithEntry(entry = makeEntry()) {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce(mockLoginResponse('staff'));
      mockApiFetch.mockResolvedValueOnce(makePageResponse([entry]));

      render(<StaffWaitlist />);
      await loginAsStaff(user);
      await waitFor(() => screen.getByText('Jane Doe'));
      return user;
    }

    it('opens the note dialog when edit note is clicked', async () => {
      const user = await renderWithEntry();
      await user.click(screen.getByRole('button', { name: /edit note for jane doe/i }));
      expect(await screen.findByRole('dialog', { name: /staff note/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /add note/i })).toHaveValue('');
    });

    it('saves the note as a timestamped history entry', async () => {
      const user = await renderWithEntry();
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeEntry({ staff_note: 'VIP guest - 2026-04-08T02:30:00Z' }),
      });

      await user.click(screen.getByRole('button', { name: /edit note for jane doe/i }));
      const dialog = await screen.findByRole('dialog', { name: /staff note/i });
      await user.type(within(dialog).getByRole('textbox', { name: /add note/i }), 'VIP guest');
      await user.click(within(dialog).getByRole('button', { name: /save note/i }));

      const detailsButton = await screen.findByRole('button', { name: /view details for jane doe/i });
      await user.click(detailsButton);
      expect(await screen.findByText('VIP guest')).toBeVisible();
    });

    it('shows existing note history separately from the add-note input', async () => {
      const user = await renderWithEntry(makeEntry({ staff_note: 'Earlier note - 2026-04-06T15:15:00Z' }));
      await user.click(screen.getByRole('button', { name: /edit note for jane doe/i }));
      const dialog = await screen.findByRole('dialog', { name: /staff note/i });
      expect(within(dialog).getByText(/note history/i)).toBeInTheDocument();
      expect(within(dialog).getByText('Earlier note')).toBeInTheDocument();
      expect(within(dialog).getByRole('textbox', { name: /add note/i })).toHaveValue('');
    });
  });

  describe('authenticated — contact', () => {
    async function renderWithEntry() {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce(mockLoginResponse('staff'));
      mockApiFetch.mockResolvedValueOnce(makePageResponse([makeEntry()]));

      render(<StaffWaitlist />);
      await loginAsStaff(user);
      await waitFor(() => screen.getByText('Jane Doe'));
      return user;
    }

    it('opens a confirmation dialog when Send access code is clicked', async () => {
      const user = await renderWithEntry();
      await user.click(screen.getByRole('button', { name: /send access code to jane doe/i }));
      const dialog = await screen.findByRole('dialog', { name: /send access code/i });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByRole('textbox', { name: /access code/i })).toHaveValue('jane_doe1');
    });

    it('sends a customized code and shows the result dialog', async () => {
      const user = await renderWithEntry();
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entry: makeEntry({ contacted_code: 'vip_jane' }),
          code: 'vip_jane',
          expires_at: 9999999999,
          email_sent: false,
        }),
      });

      await user.click(screen.getByRole('button', { name: /send access code to jane doe/i }));
      const confirmDialog = await screen.findByRole('dialog', { name: /send access code/i });
      await user.clear(within(confirmDialog).getByRole('textbox', { name: /access code/i }));
      await user.type(within(confirmDialog).getByRole('textbox', { name: /access code/i }), 'vip_jane');
      await user.click(within(confirmDialog).getByRole('button', { name: /send code/i }));

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenLastCalledWith(
          '/waitlist/1/contact',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ code: 'vip_jane' }),
          }),
        );
      });

      const resultDialog = await screen.findByRole('dialog', { name: /access code sent/i });
      expect(within(resultDialog).getByText(/vip_jane/)).toBeInTheDocument();
    });
  });

  describe('manual entry form', () => {
    async function renderAndLogin() {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce(mockLoginResponse('staff'));
      mockApiFetch.mockResolvedValueOnce(makePageResponse([]));

      render(<StaffWaitlist />);
      await loginAsStaff(user);
      await waitFor(() => screen.getByRole('button', { name: /add to waitlist/i }));
      return user;
    }

    it('adds a new entry via the manual form', async () => {
      const user = await renderAndLogin();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeEntry({ first_name: 'Bob', last_name: 'Smith', email: 'bob@example.com', phone: '555-9999' }),
      });

      await user.type(screen.getAllByRole('textbox', { name: /first name/i })[0], 'Bob');
      await user.type(screen.getAllByRole('textbox', { name: /last name/i })[0], 'Smith');
      await user.type(screen.getAllByRole('textbox', { name: /email/i })[0], 'bob@example.com');
      await user.type(screen.getAllByRole('textbox', { name: /phone/i })[0], '555-9999');
      await user.click(screen.getByRole('button', { name: /add to waitlist/i }));

      await waitFor(() => {
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      });
    });
  });
});
