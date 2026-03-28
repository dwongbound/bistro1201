import { getApiUrl, getR2BaseUrl } from '../../common/appConfig';

/**
 * Converts a raw image path from the DB into a fully-qualified URL.
 * Paths that are already absolute (http/https) are returned unchanged.
 * Relative paths are prefixed with the R2 CDN base URL and event slug.
 */
function buildImageUrl(rawPath, eventSlug) {
  if (!rawPath) return '';
  if (/^https?:\/\//.test(rawPath)) return rawPath;
  const base = getR2BaseUrl().replace(/\/+$/, '');
  if (!base) return rawPath;
  const slug = (eventSlug || '').replace(/^\/+|\/+$/g, '');
  const file = rawPath.replace(/^\/+/, '');
  return slug ? `${base}/${slug}/${file}` : `${base}/${file}`;
}

function normalizeImage(image, eventSlug) {
  return {
    src: buildImageUrl(image?.src || '', eventSlug),
    alt: image?.alt || '',
  };
}

function normalizeGalleryEvent(event) {
  const slug = event?.slug || '';
  return {
    slug,
    title: event?.title || '',
    dateLabel: event?.date_label || '',
    summary: event?.summary || '',
    eventType: event?.event_type || 'Event',
    coverImage: buildImageUrl(event?.cover_image || '', slug),
    previewImages: Array.isArray(event?.preview_images) ? event.preview_images.map((img) => normalizeImage(img, slug)) : [],
    galleryImages: Array.isArray(event?.gallery_images) ? event.gallery_images.map((img) => normalizeImage(img, slug)) : [],
  };
}

async function readJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

/**
 * Loads gallery summaries from the backend so new events can appear without a frontend rebuild.
 */
export async function fetchGalleryEvents() {
  const response = await fetch(`${getApiUrl()}/gallery`);
  const payload = await readJson(response, 'Unable to load the gallery right now.');
  return Array.isArray(payload) ? payload.map(normalizeGalleryEvent) : [];
}

/**
 * Loads one full gallery event by slug for the detail page.
 */
export async function fetchGalleryEvent(slug) {
  const response = await fetch(`${getApiUrl()}/gallery/${encodeURIComponent(slug)}`);
  const payload = await readJson(response, 'Unable to load that gallery event right now.');
  return normalizeGalleryEvent(payload);
}
