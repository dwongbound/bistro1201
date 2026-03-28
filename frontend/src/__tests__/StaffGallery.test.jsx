import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StaffGallery from '../pages/gallery/StaffGallery';
import { fetchGalleryEvents } from '../pages/gallery/galleryApi';
import { fetchAdminEventImages } from '../pages/gallery/galleryAdminApi';

jest.mock('../pages/gallery/galleryApi', () => ({
  fetchGalleryEvents: jest.fn(),
}));

jest.mock('../pages/gallery/galleryAdminApi', () => ({
  createGalleryEvent: jest.fn(),
  deleteGalleryEvent: jest.fn(),
  addGalleryImage: jest.fn(),
  deleteGalleryImage: jest.fn(),
  fetchAdminEventImages: jest.fn(),
}));

jest.mock('../common/apiClient', () => ({
  createApiFetch: jest.fn(() => jest.fn()),
}));

const GALLERY_STAFF_COOKIE = 'bistro_gallery_staff_code';

function renderGallery() {
  return render(
    <MemoryRouter>
      <StaffGallery />
    </MemoryRouter>,
  );
}

function mockFetchLogin(ok, payload) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(payload),
  });
}

async function performLogin(code) {
  fireEvent.change(screen.getByLabelText(/Staff Access Code/i), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

async function loginAsStaff() {
  mockFetchLogin(true, { token: 'staff-token', role: 'staff' });
  await performLogin('service1201');
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
  });
}

describe('StaffGallery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie = `${GALLERY_STAFF_COOKIE}=; Max-Age=0; Path=/`;
    fetchGalleryEvents.mockResolvedValue([]);
    fetchAdminEventImages.mockResolvedValue([]);
  });

  test('shows the login gate when not authenticated', () => {
    renderGallery();

    expect(screen.getByText('Staff Access Only')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Staff Login' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Staff Access Code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  test('shows an error for an invalid access code', async () => {
    mockFetchLogin(false, { error: 'Invalid access code.' });
    renderGallery();

    await performLogin('wrongcode');

    await waitFor(() => {
      expect(screen.getByText('Invalid access code.')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Staff Login' })).toBeInTheDocument();
  });

  test('shows an error when a guest-role code is used', async () => {
    mockFetchLogin(true, { token: 'guest-token', role: 'guest' });
    renderGallery();

    await performLogin('bistro1201');

    await waitFor(() => {
      expect(screen.getByText('This page requires a staff access code.')).toBeInTheDocument();
    });
  });

  test('shows the authenticated gallery admin panel after valid staff login', async () => {
    renderGallery();
    await loginAsStaff();

    expect(screen.getByText('New Event')).toBeInTheDocument();
    expect(screen.getByText('No events yet.')).toBeInTheDocument();
  });

  test('new event form has all seven fields', async () => {
    renderGallery();
    await loginAsStaff();

    expect(screen.getByLabelText(/^Slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date Label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Event Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Cover Image/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Sort Order/i)).toBeInTheDocument();
  });

  test('renders loaded events in the list', async () => {
    fetchGalleryEvents.mockResolvedValue([
      { slug: 'spring-2026', title: 'Spring Supper', dateLabel: 'April 2026', coverImageUrl: '/img.jpg', summary: 'Nice event', sortOrder: 1 },
    ]);
    renderGallery();
    await loginAsStaff();

    await waitFor(() => {
      expect(screen.getByText('Spring Supper')).toBeInTheDocument();
    });
    // The caption text is split across text nodes by React's JSX interpolation
    expect(screen.getByText(/April 2026.*spring-2026/)).toBeInTheDocument();
  });

  test('clicking an event shows the image management panel', async () => {
    fetchGalleryEvents.mockResolvedValue([
      { slug: 'spring-2026', title: 'Spring Supper', dateLabel: 'April 2026', coverImageUrl: '/img.jpg', summary: 'Nice event', sortOrder: 1 },
    ]);
    const user = userEvent.setup();
    renderGallery();
    await loginAsStaff();

    await waitFor(() => {
      expect(screen.getByTestId('event-row')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('event-row'));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Image File/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/^Alt Text/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /preview/i })).toBeInTheDocument();
  });

  test('clicking the delete icon opens a confirmation dialog', async () => {
    fetchGalleryEvents.mockResolvedValue([
      { slug: 'spring-2026', title: 'Spring Supper', dateLabel: 'April 2026', coverImageUrl: '/img.jpg', summary: 'Nice event', sortOrder: 1 },
    ]);
    renderGallery();
    await loginAsStaff();

    await waitFor(() => {
      expect(screen.getByText('Spring Supper')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));

    const dialog = await waitFor(() => screen.getByRole('dialog', { name: 'Delete Event' }));
    expect(within(dialog).getByText(/Spring Supper/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
