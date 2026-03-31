import { getR2BaseUrl } from '../../common/appConfig';

async function readJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function buildGalleryAssetUrl(slug, assetPath) {
  const rawPath = String(assetPath || '').trim();
  if (!rawPath) return '';
  if (/^https?:\/\//i.test(rawPath)) return rawPath;

  const baseUrl = trimSlashes(getR2BaseUrl());
  const eventSlug = trimSlashes(slug);
  const filePath = trimSlashes(rawPath);
  const normalizedPath = eventSlug && filePath.startsWith(`${eventSlug}/`) ? filePath : eventSlug ? `${eventSlug}/${filePath}` : filePath;

  if (!baseUrl) return normalizedPath;
  return `${baseUrl}/${normalizedPath}`;
}

function normalizeImageRecord(record) {
  return {
    id: record.id,
    eventSlug: record.event_slug,
    imageUrl: buildGalleryAssetUrl(record.event_slug, record.image_url),
    altText: record.alt_text,
    sortOrder: record.sort_order,
    isPreview: record.is_preview,
  };
}

/**
 * Uploads a file to the event's folder in object storage.
 * Returns { filename } on success.
 */
export async function uploadGalleryFile(apiFetch, slug, file) {
  const form = new FormData();
  form.append('file', file, file.name);
  const response = await apiFetch(`/gallery/${encodeURIComponent(slug)}/upload`, {
    method: 'POST',
    body: form,
  });
  return readJson(response, 'Unable to upload file.');
}

/**
 * Creates a gallery event. Requires a staff bearer token via apiFetch.
 */
export async function createGalleryEvent(apiFetch, payload) {
  const request = {
    ...payload,
    cover_image_url: buildGalleryAssetUrl(payload.slug, payload.cover_image_url),
  };
  const response = await apiFetch('/gallery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, 'Unable to create gallery event.');
}

/**
 * Deletes a gallery event and all its images.
 */
export async function deleteGalleryEvent(apiFetch, slug) {
  const response = await apiFetch(`/gallery/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  return readJson(response, 'Unable to delete gallery event.');
}

/**
 * Adds an image to a gallery event.
 */
export async function addGalleryImage(apiFetch, slug, payload) {
  const request = {
    ...payload,
    image_url: buildGalleryAssetUrl(slug, payload.image_url),
  };
  const response = await apiFetch(`/gallery/${encodeURIComponent(slug)}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const record = await readJson(response, 'Unable to add gallery image.');
  return normalizeImageRecord(record);
}

/**
 * Deletes one gallery image by id.
 */
export async function deleteGalleryImage(apiFetch, slug, id) {
  const response = await apiFetch(`/gallery/${encodeURIComponent(slug)}/images/${id}`, {
    method: 'DELETE',
  });
  return readJson(response, 'Unable to delete gallery image.');
}

/**
 * Loads all gallery images for one event via the staff endpoint, returning real DB ids.
 */
export async function fetchAdminEventImages(apiFetch, slug) {
  const response = await apiFetch(`/gallery/${encodeURIComponent(slug)}/images`);
  const records = await readJson(response, 'Unable to load event images.');
  return records.map((record) => normalizeImageRecord(record));
}
