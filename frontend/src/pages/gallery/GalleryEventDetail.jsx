import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Notice from '../../common/Notice';
import PageIntro from '../../common/PageIntro';
import Reveal from '../../common/Reveal';
import Spinner from '../../common/Spinner';
import { ArrowLeftIcon } from '../../common/icons';
import { fetchGalleryEvent } from './galleryApi';

/**
 * Renders the full image gallery for a single event selected from the Gallery index.
 */
function GalleryEventDetail() {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEvent() {
      if (!eventSlug) {
        setEvent(null);
        setLoadingEvent(false);
        setEventError('That event gallery is not available right now.');
        return;
      }

      setLoadingEvent(true);
      setEventError('');

      try {
        const nextEvent = await fetchGalleryEvent(eventSlug);
        if (active) {
          setEvent(nextEvent);
        }
      } catch (error) {
        console.error(`Error loading gallery event "${eventSlug}":`, error);
        if (active) {
          setEvent(null);
          setEventError(error.message || 'That event gallery is not available right now.');
        }
      } finally {
        if (active) {
          setLoadingEvent(false);
        }
      }
    }

    loadEvent();

    return () => {
      active = false;
    };
  }, [eventSlug]);

  const backLink = (
    <Link to="/gallery" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-cream">
      <ArrowLeftIcon className="size-4" />
      Back to Gallery
    </Link>
  );

  if (loadingEvent) {
    return (
      <div className="grid gap-10">
        <PageIntro eyebrow="Gallery" title="Loading Event Gallery" description="Pulling the latest event photos." />
        <Spinner label="Loading event gallery..." />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="grid gap-8">
        {backLink}
        <PageIntro
          eyebrow="Gallery"
          title="Event Not Found"
          description={eventError || 'That event gallery is not available right now.'}
        />
        <Notice tone="warning">Try returning to the Gallery index to choose another event.</Notice>
      </div>
    );
  }

  return (
    <div className="grid gap-10 md:gap-14">
      <div className="grid gap-6">
        {backLink}
        <PageIntro eyebrow={event.eventType} title={event.title} description={event.summary} />
        <div className="flex flex-wrap gap-2">
          <span className="tag tag-accent">{event.eventType}</span>
          <span className="tag">{event.dateLabel}</span>
          <span className="tag">{event.galleryImages.length} photos</span>
        </div>
      </div>
      {event.galleryImages.length === 0 ? (
        <Notice>No gallery images have been added to this event yet.</Notice>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {event.galleryImages.map((image, index) => (
            <Reveal as="figure" key={`${image.src}-${image.alt}`} delay={(index % 3) * 80} className="mb-4 break-inside-avoid overflow-hidden rounded-xl bg-ink-800">
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                // Fade each photo in as it arrives instead of popping in.
                onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
                className="block w-full opacity-0 transition-opacity duration-700"
              />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

export default GalleryEventDetail;
