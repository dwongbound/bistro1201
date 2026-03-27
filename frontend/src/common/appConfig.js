/**
 * Returns the runtime app configuration injected by nginx or the dev server.
 */
export function getAppConfig() {
  return globalThis.__APP_CONFIG__ || {};
}

/**
 * Resolves the backend API base path used across the frontend.
 */
export function getApiUrl() {
  return getAppConfig().apiUrl || '/api';
}

/**
 * Returns the current named app instance, such as dev, staging, or prod.
 */
export function getAppInstance() {
  return getAppConfig().instance || 'dev';
}
