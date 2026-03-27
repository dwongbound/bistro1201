import { getApiUrl } from '../../common/appConfig';

function normalizeImage(image) {
  return {
    src: image?.src || '',
    alt: image?.alt || '',
  };
}

function normalizeGalleryEvent(event) {
  return {
    slug: event?.slug || '',
    title: event?.title || '',
    dateLabel: event?.date_label || '',
    summary: event?.summary || '',
    coverImage: event?.cover_image || '',
    previewImages: Array.isArray(event?.preview_images) ? event.preview_images.map(normalizeImage) : [],
    galleryImages: Array.isArray(event?.gallery_images) ? event.gallery_images.map(normalizeImage) : [],
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
