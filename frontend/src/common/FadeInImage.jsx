import { Box, Skeleton } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

/**
 * Renders a background-image that fades in once loaded, with a skeleton shimmer while waiting.
 * Falls back gracefully to a placeholder if no src is provided or the image fails to load.
 */
function FadeInImage({ src, alt, aspectRatio = '4 / 5', overlay, placeholder, sx }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) return;

    setLoaded(false);
    setErrored(false);

    const img = imgRef.current;
    if (!img) return;

    let raf1, raf2;
    const fade = () => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setLoaded(true));
      });
    };
    const fail = () => setErrored(true);

    img.addEventListener('load', fade);
    img.addEventListener('error', fail);

    // Already cached — onLoad won't re-fire so trigger manually
    if (img.complete && img.naturalWidth > 0) fade();

    return () => {
      img.removeEventListener('load', fade);
      img.removeEventListener('error', fail);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [src]);

  if (!src || errored) {
    return (
      <Box
        sx={{
          aspectRatio,
          width: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, rgba(56, 44, 34, 0.92), rgba(29, 23, 18, 0.98))',
          ...sx,
        }}
      >
        {placeholder}
      </Box>
    );
  }

  const bgOverlay = overlay ?? 'linear-gradient(180deg, rgba(18, 15, 13, 0.06), rgba(18, 15, 13, 0.28))';

  return (
    <Box sx={{ position: 'relative', aspectRatio, width: '100%', ...sx }}>
      <Skeleton
        variant="rectangular"
        animation={loaded ? false : 'wave'}
        sx={{
          position: 'absolute',
          inset: 0,
          height: '100%',
          bgcolor: 'rgba(255, 255, 255, 0.08)',
          transform: 'none',
          opacity: loaded ? 0 : 1,
          transition: 'opacity 0.7s ease',
          pointerEvents: 'none',
        }}
      />
      <Box
        role="img"
        aria-label={alt}
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `${bgOverlay}, url(${src})`,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          opacity: loaded ? 1 : 0,
          animation: loaded ? 'imageFadeIn 0.7s ease forwards' : 'none',
          '@keyframes imageFadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        }}
      />
      <Box ref={imgRef} component="img" src={src} alt="" aria-hidden sx={{ display: 'none' }} />
    </Box>
  );
}

export default FadeInImage;
