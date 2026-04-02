/**
 * Builds an authenticated fetch helper for pages that talk to the backend repeatedly.
 *
 * When `getServiceKey` is provided its return value is sent as the `X-Service-Key` header
 * on every request so that staff write endpoints can validate the caller's identity beyond
 * the session token alone.
 */
export function createApiFetch({ apiUrl, getToken, getServiceKey, onUnauthorized }) {
  return async function apiFetch(path, options = {}, tokenOverride) {
    const token = tokenOverride || getToken();
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const serviceKey = getServiceKey ? getServiceKey() : '';
    if (serviceKey) {
      headers.set('X-Service-Key', serviceKey);
    }

    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }

    return response;
  };
}

/**
 * Converts a fetch response into readable text while preserving JSON formatting when possible.
 */
export async function formatResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (error) {
    return text;
  }
}

/**
 * Parses a formatted JSON string back into data when possible.
 */
export function parseFormattedJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}
