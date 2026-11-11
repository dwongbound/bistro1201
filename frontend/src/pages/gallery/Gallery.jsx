import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FadeInImage from '../../common/FadeInImage';
import Notice from '../../common/Notice';
import PageIntro from '../../common/PageIntro';
import Reveal from '../../common/Reveal';
import Spinner from '../../common/Spinner';
import { ArrowRightIcon } from '../../common/icons';
import { fetchGalleryEvents } from './galleryApi';

const galleryLoadingPlaceholders = Array.from({ length: 2 }, (_, index) => ({
  id: `gallery-loading-${index}`,
}));

/**
 * Presents the event-based Gallery index with preview photography for each evening.
 */
function Gallery() {
  const [galleryEvents, setGalleryEvents] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [galleryError, setGalleryError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadGallery() {
      setLoadingGallery(true);
      setGalleryError('');

      try {
        const events = await fetchGalleryEvents();
        if (active) {
          setGalleryEvents(events);
        }
      } catch (error) {
        console.error('Error loading gallery events:', error);
        if (active) {
          setGalleryError(error.message || 'Unable to load the gallery right now.');
        }
      } finally {
        if (active) {
          setLoadingGallery(false);
        }
      }
    }

    loadGallery();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-12 md:gap-16">
      <PageIntro
        eyebrow="Gallery"
        title="Collections"
        description="Browse past evenings, preview a few moments from each event, and open the full photo set for a closer look."
      />
      {galleryError ? <Notice tone="error">{galleryError}</Notice> : null}
      {!loadingGallery && !galleryError && galleryEvents.length === 0 ? (
        <Notice>No gallery events have been published yet. Add event metadata in Postgres when you are ready.</Notice>
      ) : null}
      {loadingGallery ? (
        <div className="grid gap-12" aria-busy="true">
          <Spinner label="Loading gallery..." />
          {galleryLoadingPlaceholders.map((placeholder) => (
            <div key={placeholder.id} className="grid animate-pulse gap-6 md:grid-cols-[1.4fr_1fr] md:gap-10" aria-hidden="true">
              <div className="aspect-[4/3] rounded-2xl bg-white/[0.05]" />
              <div className="grid content-center gap-4">
                <div className="h-6 w-40 rounded-full bg-white/[0.06]" />
                <div className="h-10 w-3/4 rounded-lg bg-white/[0.07]" />
                <div className="h-4 w-full rounded bg-white/[0.04]" />
                <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {!loadingGallery && !galleryError ? (
        <ul className="grid gap-16 md:gap-24">
          {galleryEvents.map((event, index) => {
            const eventHref = `/gallery/${event.slug}`;
            // Alternate the photo side on wide screens so the page has some rhythm.
            const flip = index % 2 === 1;
            return (
              <Reveal as="li" key={event.slug} className="reveal-zoom group grid items-center gap-6 md:grid-cols-[1.4fr_1fr] md:gap-12">
                <Link
                  to={eventHref}
                  tabIndex={-1}
                  aria-hidden="true"
                  className={`block overflow-hidden rounded-2xl ${flip ? 'md:order-2' : ''}`}
                >
                  <FadeInImage
                    src={event.coverImage}
                    alt={event.title}
                    className="aspect-[4/3] w-full"
                    imgClassName="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
                  />
                </Link>
                <div className="grid content-center gap-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="tag tag-accent">{event.eventType}</span>
                    <span className="tag">{event.dateLabel}</span>
                  </div>
                  <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">{event.title}</h2>
                  <p className="leading-relaxed text-muted">{event.summary}</p>
                  {event.previewImages.length ? (
                    <div className="grid grid-cols-3 gap-3">
                      {event.previewImages.slice(0, 3).map((image) => (
                        <FadeInImage
                          key={`${event.slug}-${image.src}`}
                          src={image.src}
                          alt={image.alt}
                          className="aspect-square w-full rounded-lg"
                        />
                      ))}
                    </div>
                  ) : null}
                  <Link to={eventHref} className="btn btn-ghost w-fit">
                    View Event Gallery
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default Gallery;
