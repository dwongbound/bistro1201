import EastRoundedIcon from '@mui/icons-material/EastRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import BrandWordmark from '../../common/BrandWordmark';
import { fetchGalleryEvent } from '../gallery/galleryApi';

const SLIDE_INTERVAL_MS = 5000;
const TRANSITION_MS = 1500;
const FADE_IN_MS = 1200;
const FADE_IN_DELAY_MS = 80;

/**
 * Shows the landing-page hero over a full-screen crossfading photo slideshow.
 * Photos are managed via the Home Slideshow section in the Gallery Admin.
 *
 * The slideshow uses zIndex: 1 (not -1) so it sits above the body/html background
 * paint. Hero content uses zIndex: 2 to stay on top of the slideshow.
 * The Home component only mounts on the home route, so other pages are unaffected.
 */
function Home() {
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loadedSlides, setLoadedSlides] = useState(() => new Set());
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchGalleryEvent('home')
      .then((event) => setSlides(event.galleryImages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) return;

    let cancelled = false;
    const cleanups = slides.map((slide) => {
      const img = new Image();
      const markLoaded = () => {
        if (cancelled) return;
        setLoadedSlides((current) => {
          if (current.has(slide.src)) return current;
          const next = new Set(current);
          next.add(slide.src);
          return next;
        });
      };

      img.addEventListener('load', markLoaded);
      img.src = slide.src;

      if (img.complete && img.naturalWidth > 0) {
        markLoaded();
      }

      return () => {
        img.removeEventListener('load', markLoaded);
      };
    });

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [slides]);

  useEffect(() => {
    if (!slides.length) {
      setVisible(true);
      return;
    }

    const firstSlideSrc = slides[0]?.src;
    if (!firstSlideSrc || !loadedSlides.has(firstSlideSrc)) {
      setVisible(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVisible(true);
    }, FADE_IN_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [loadedSlides, slides]);

  return (
    <>
      {/* Fixed full-screen slideshow. zIndex:1 places it above the body/html background. */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          backgroundColor: '#120f0d',
          overflow: 'hidden',
        }}
      >
        {slides.map((slide, i) => (
          <Box
            key={slide.src}
            data-testid={`home-slide-${i}`}
            data-slide-src={slide.src}
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${slide.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: visible && loadedSlides.has(slide.src) && i === currentIndex ? 1 : 0,
              transition: i === currentIndex
                ? `opacity ${visible ? FADE_IN_MS : TRANSITION_MS}ms ease`
                : `opacity ${TRANSITION_MS}ms ease`,
            }}
          />
        ))}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(18,15,13,0.82) 0%, rgba(18,15,13,0.64) 50%, rgba(18,15,13,0.9) 100%)',
            opacity: visible ? 1 : 0,
            transition: `opacity ${FADE_IN_MS}ms ease`,
          }}
        />
      </Box>

      {/* Hero content. zIndex:2 keeps it above the slideshow. */}
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          py: { xs: 4, md: 8 },
          minHeight: { md: '70vh' },
          alignContent: 'center',
          position: 'relative',
          zIndex: 2,
          opacity: visible ? 1 : 0,
          transform: visible ? 'none' : 'translateY(12px)',
          transition: `opacity ${FADE_IN_MS}ms ease, transform ${FADE_IN_MS}ms ease`,
        }}
      >
        <Box
          sx={{
            width: '50%',
            height: '1px',
            backgroundColor: 'rgba(217, 195, 161, 0.55)',
            display: 'block',
            flexShrink: 0,
          }}
        />
        <Typography variant="h4">
          Welcome to
        </Typography>
        <Typography
          component="h1"
          variant="h2"
          sx={{
            maxWidth: 760,
            fontWeight: 800,
            letterSpacing: '-0.04em',
          }}
        >
          <BrandWordmark sx={{ fontSize: '1em', letterSpacing: '0.05em' }} cycleSuffix/>
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 640, lineHeight: 1.7 }}>
          An intimate supper club experience with refined plates, thoughtful pours, and an easy way
          to reserve your next evening.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button component={RouterLink} to="/reserve" variant="contained" size="large" endIcon={<EastRoundedIcon />}>
            Reserve
          </Button>
          <Button component={RouterLink} to="/gallery" variant="outlined" size="large">
            View Gallery
          </Button>
        </Stack>
      </Box>
    </>
  );
}

export default Home;
