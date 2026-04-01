/**
 * Converts an event title into a URL-safe slug using underscores.
 * Exported so unit tests can exercise it directly.
 */
export function titleToSlug(title) {
  return title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Returns a new array with the item identified by fromId moved to the
 * position currently occupied by toId. Does not mutate the input.
 * Exported so unit tests can exercise it directly.
 */
export function reorderHomeImages(images, fromId, toId) {
  const oldIdx = images.findIndex((img) => img.id === fromId);
  const newIdx = images.findIndex((img) => img.id === toId);
  if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return images;
  const result = [...images];
  const [moved] = result.splice(oldIdx, 1);
  result.splice(newIdx, 0, moved);
  return result;
}
