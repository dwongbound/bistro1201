import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WaitlistForm from '../pages/reserve/WaitlistForm';

const API_URL = 'http://localhost:3000/api';

function renderForm() {
  return render(<WaitlistForm apiUrl={API_URL} />);
}

function fillForm(user, overrides = {}) {
  const values = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    notes: '',
    ...overrides,
  };
  return async () => {
    await user.type(screen.getByRole('textbox', { name: /first name/i }), values.firstName);
    await user.type(screen.getByRole('textbox', { name: /last name/i }), values.lastName);
    await user.type(screen.getByRole('textbox', { name: /email/i }), values.email);
    await user.type(screen.getByRole('textbox', { name: /phone/i }), values.phone);
    if (values.notes) {
      await user.type(screen.getByRole('textbox', { name: /anything else/i }), values.notes);
    }
  };
}

describe('WaitlistForm', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('layout', () => {
    it('renders the join the waitlist heading', () => {
      renderForm();
      expect(screen.getByRole('heading', { name: /join the waitlist/i })).toBeInTheDocument();
    });

    it('renders all required fields', () => {
      renderForm();
      expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /last name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /phone/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /anything else/i })).toBeInTheDocument();
    });

    it('renders a submit button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /join the waitlist/i })).toBeInTheDocument();
    });
  });

  describe('successful submission', () => {
    it('posts the form data and shows a success message', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          phone: '555-0100',
          notes: '',
          staff_note: '',
          sort_order: 0,
          created_at: 1000000,
          contacted_code: null,
        }),
      });

      renderForm();
      await fillForm(user)();
      await user.click(screen.getByRole('button', { name: /join the waitlist/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/you're on the waitlist/i);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/waitlist`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('clears the form after a successful submission', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1, first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com',
          phone: '555-0100', notes: '', staff_note: '', sort_order: 0,
          created_at: 1000000, contacted_code: null,
        }),
      });

      renderForm();
      await fillForm(user)();
      await user.click(screen.getByRole('button', { name: /join the waitlist/i }));

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /first name/i })).toHaveValue('');
      });
    });
  });

  describe('error handling', () => {
    it('shows inline styled errors instead of the browser validation tooltip for missing required fields', async () => {
      const user = userEvent.setup();

      renderForm();
      await user.click(screen.getByRole('button', { name: /join the waitlist/i }));

      expect(screen.getByRole('alert')).toHaveTextContent(/please fill in the required fields/i);
      expect(screen.getByRole('textbox', { name: /first name/i })).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('Required.')).not.toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('shows an error alert when the server returns a non-ok response', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email is required' }),
      });

      renderForm();
      await fillForm(user)();
      await user.click(screen.getByRole('button', { name: /join the waitlist/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/email is required/i);
      });
    });

    it('shows a generic error when the network fails', async () => {
      const user = userEvent.setup();
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      renderForm();
      await fillForm(user)();
      await user.click(screen.getByRole('button', { name: /join the waitlist/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/unable to join the waitlist/i);
      });
    });

    it('disables the submit button while the request is in flight', async () => {
      const user = userEvent.setup();
      let resolve;
      global.fetch.mockReturnValueOnce(new Promise((r) => { resolve = r; }));

      renderForm();
      await fillForm(user)();
      await user.click(screen.getByRole('button', { name: /join the waitlist/i }));

      expect(screen.getByRole('button', { name: /join the waitlist/i })).toBeDisabled();
      resolve({ ok: true, json: async () => ({ id: 1, first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', phone: '555-0100', notes: '', staff_note: '', sort_order: 0, created_at: 1000000, contacted_code: null }) });
    });
  });
});
