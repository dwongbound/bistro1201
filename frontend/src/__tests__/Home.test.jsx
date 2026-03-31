import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/home/Home';
import { fetchGalleryEvent } from '../pages/gallery/galleryApi';

jest.mock('../pages/gallery/galleryApi', () => ({
  fetchGalleryEvent: jest.fn(),
}));

describe('Home', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const slide = Array.from(container.querySelectorAll('div')).find((node) =>
        node.style.backgroundImage.includes('hero-home.jpg'),
      );
      expect(slide).toBeTruthy();
      expect(slide.style.backgroundImage).toContain('https://cdn.1201bistrocafe.com/home/hero-home.jpg');
    });
  });
});
