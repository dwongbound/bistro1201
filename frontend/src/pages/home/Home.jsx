import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandWordmark from '../../common/BrandWordmark';
import Reveal from '../../common/Reveal';
import { ArrowRightIcon } from '../../common/icons';
import { fetchGalleryEvent } from '../gallery/galleryApi';

const CYCLE_INTERVAL_MS = 5000;
const TRANSITION_MS = 1500;
const FADE_IN_DELAY_MS = 100;

// What a guest can expect, shown under the hero.
const highlights = [
  {
    title: 'Fresh ingredients',
    copy: 'Menus shift with the season so the kitchen can spotlight produce, seafood, and meats at their best.',
  },
  {
    title: 'Warm hospitality',
    copy: 'We want reservations, arrivals, and service to feel calm, easy, and personal from start to finish.',
  },
  {
    title: 'Evening atmosphere',
    copy: 'Soft lighting, crisp pours, and a room designed for date nights, celebrations, and unhurried dinners.',
  },
];

/**
 * Small animated line at the bottom of the hero hinting that the page keeps going.
 */
function ScrollCue({ visible }) {
  return (
    <div
      aria-hidden="true"
      className={`hero-copy-out absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 transition-opacity duration-1000 md:flex ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <span className="text-[10px] font-semibold tracking-[0.3em] text-muted uppercase">Scroll</span>
      <span className="relative h-10 w-px overflow-hidden bg-line-strong">
        <span className="scroll-cue absolute inset-x-0 top-0 h-1/2 bg-sand" />
      </span>
    </div>
  );
}

/**
 * Shows the landing-page hero over a crossfading photo slideshow, then a short
 * "what to expect" section and a reserve prompt.
 * Photos are managed via the Home Slideshow section in the Gallery Admin.
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
    }, CYCLE_INTERVAL_MS);
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
      <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-end overflow-hidden">
        {/* Crossfading slideshow behind the hero copy. */}
        <div className="absolute inset-0 -z-10 overflow-hidden bg-ink-950" aria-hidden="true">
          <div className="hero-parallax absolute inset-0">
          {slides.map((slide, i) => (
            <div
              key={slide.src}
              data-testid={`home-slide-${i}`}
              data-slide-src={slide.src}
              className="ken-burns absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${slide.src})`,
                opacity: visible && loadedSlides.has(slide.src) && i === currentIndex ? 1 : 0,
                transition: `opacity ${TRANSITION_MS}ms ease`,
              }}
            />
          ))}
          </div>
          {/* Darkens the bottom-left corner so the copy always reads, whatever the photo. */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-ink-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/70 via-transparent to-transparent" />
        </div>

        <div className="hero-copy-out w-full">
        <div
          className="mx-auto grid w-full max-w-6xl gap-6 px-5 pt-24 pb-14 sm:px-8 md:pb-24"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(12px)',
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
          }}
        >
          <h1 className="grid gap-4">
            <span className="eyebrow">Welcome to</span>
            <span className="text-5xl text-cream sm:text-7xl md:text-8xl">
              <BrandWordmark className="tracking-[0.04em]" cycleSuffix />
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-cream/80">
            An intimate supper club experience with refined plates, thoughtful pours, and an easy way
            to reserve your next evening.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/reserve" className="btn btn-primary">
              Reserve
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link to="/gallery" className="btn btn-ghost backdrop-blur-sm">
              View Gallery
            </Link>
          </div>
        </div>
        </div>
        <ScrollCue visible={visible} />
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <div className="grid gap-12 md:grid-cols-[1fr_2fr] md:gap-16">
          <Reveal className="grid content-start gap-4">
            <p className="eyebrow">The evening</p>
            <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              Small room, seasonal plates, no rush.
            </h2>
          </Reveal>
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
            {highlights.map((item, index) => (
              <Reveal as="li" key={item.title} delay={index * 120} className="grid content-start gap-3 bg-ink-950 p-6">
                <span className="font-display text-sm text-brass-bright">0{index + 1}</span>
                <h3 className="text-base font-semibold text-cream">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{item.copy}</p>
              </Reveal>
            ))}
          </ol>
        </div>
        <Reveal className="mt-16 flex flex-col items-start justify-between gap-6 rounded-2xl border border-line bg-gradient-to-br from-ink-800 to-ink-900 p-8 sm:flex-row sm:items-center md:p-10">
          <div className="grid gap-2">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Save a seat at the table</h2>
            <p className="text-muted">Openings are posted as soon as the next menu is set.</p>
          </div>
          <Link to="/reserve" className="btn btn-primary shrink-0">
            See availability
            <ArrowRightIcon className="size-4" />
          </Link>
        </Reveal>
      </section>
    </>
  );
}

export default Home;
