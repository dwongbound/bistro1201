import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/home/Home';
import { fetchGalleryEvent } from '../pages/gallery/galleryApi';

jest.mock('../pages/gallery/galleryApi', () => ({
  fetchGalleryEvent: jest.fn(),
}));

describe('Home', () => {
  let OriginalImage;

  beforeEach(() => {
    jest.clearAllMocks();
    OriginalImage = global.Image;
    global.Image = class MockImage {
      constructor() {
        this._src = '';
        this.complete = false;
        this.naturalWidth = 0;
        this.listeners = {};
      }

      addEventListener(type, callback) {
        this.listeners[type] = callback;
      }

      removeEventListener(type) {
        delete this.listeners[type];
      }

      set src(value) {
        this._src = value;
        this.complete = true;
        this.naturalWidth = 1200;
        if (this.listeners.load) {
          this.listeners.load();
        }
      }

      get src() {
        return this._src;
      }
    };

    fetchGalleryEvent.mockResolvedValue({
      slug: 'home',
      title: 'Home Slideshow',
      galleryImages: [
        {
          src: 'https://cdn.1201bistrocafe.com/home/hero-home.jpg',
          alt: 'hero home',
        },
      ],
    });
  });

  afterEach(() => {
    global.Image = OriginalImage;
  });

  test('loads slideshow images from the home gallery event and renders the slide background', async () => {
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchGalleryEvent).toHaveBeenCalledWith('home');
    });

    await waitFor(() => {
      const slide = container.querySelector('[data-slide-src="https://cdn.1201bistrocafe.com/home/hero-home.jpg"]');
      expect(slide).toBeTruthy();
      expect(slide).toHaveAttribute('data-testid', 'home-slide-0');
    });
  });
});
