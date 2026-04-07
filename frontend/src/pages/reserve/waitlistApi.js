/**
 * Submits a new waitlist entry as a public visitor (no auth required).
 */
export async function submitWaitlistEntry(apiUrl, data) {
  return fetch(`${apiUrl}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Fetches a page of waitlist entries for staff.
 */
export async function fetchWaitlist(apiFetch, offset = 0, limit = 50) {
  return apiFetch(`/waitlist?offset=${offset}&limit=${limit}`);
}

/**
 * Deletes one waitlist entry by id.
 */
export async function deleteWaitlistEntry(apiFetch, id) {
  return apiFetch(`/waitlist/${id}`, { method: 'DELETE' });
}

/**
 * Contacts a waitlist entry: creates a temporary guest code and sends an email.
 */
export async function contactWaitlistEntry(apiFetch, id, code) {
  return apiFetch(`/waitlist/${id}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

/**
 * Updates the staff-only note on a waitlist entry.
 */
export async function updateWaitlistNote(apiFetch, id, staffNote) {
  return apiFetch(`/waitlist/${id}/note`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_note: staffNote }),
  });
}

/**
 * Saves a new sort order for waitlist entries by sending an array of ids.
 */
export async function reorderWaitlist(apiFetch, order) {
  return apiFetch('/waitlist/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
}
