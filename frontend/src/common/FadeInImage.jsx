import { useEffect, useRef, useState } from 'react';
import { PlateIcon } from './icons';

/**
 * Shows an image that fades in once loaded, with a soft shimmer while waiting.
 * Falls back to a placeholder panel if there is no src or the image fails to load.
 */
function FadeInImage({ src, alt = '', className = '', imgClassName = '' }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    // Already cached images will not fire onLoad again, so check right away.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
  }, [src]);

  if (!src || errored) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        className={`grid place-items-center bg-gradient-to-b from-ink-700 to-ink-800 text-sand/50 ${className}`}
      >
        <PlateIcon className="size-12" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-ink-800 ${className}`}>
      {!loaded ? <div className="absolute inset-0 animate-pulse bg-white/[0.04]" aria-hidden="true" /> : null}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
      />
    </div>
  );
}

export default FadeInImage;
