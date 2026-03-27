/**
 * Builds an authenticated fetch helper for pages that talk to the backend repeatedly.
 */
export function createApiFetch({ apiUrl, getToken, onUnauthorized }) {
  return async function apiFetch(path, options = {}, tokenOverride) {
    const token = tokenOverride || getToken();
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
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
