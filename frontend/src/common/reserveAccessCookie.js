const GUEST_ACCESS_COOKIE = 'bistro_guest_access_code';
const STAFF_ACCESS_COOKIE = 'bistro_staff_access_code';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const COOKIE_PATH = 'Path=/';
const COOKIE_SAME_SITE = 'SameSite=Lax';
const EXPIRED_COOKIE_DATE = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT';

function saveCookie(name, value) {
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    COOKIE_PATH,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    COOKIE_SAME_SITE,
  ].join('; ');
}

function readCookie(name) {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) {
    return '';
  }

  return decodeURIComponent(cookie.slice(`${name}=`.length));
}

function clearCookie(name) {
  document.cookie = [
    `${name}=`,
    COOKIE_PATH,
    'Max-Age=0',
    EXPIRED_COOKIE_DATE,
    COOKIE_SAME_SITE,
  ].join('; ');
}

/**
 * Persists the guest reserve code so returning visitors can re-authenticate on `/reserve`.
 */
export function saveGuestAccessCode(code) {
  saveCookie(GUEST_ACCESS_COOKIE, code);
}

/**
 * Reads the stored guest reserve code from cookies, if one exists.
 */
export function readGuestAccessCode() {
  return readCookie(GUEST_ACCESS_COOKIE);
}

/**
 * Removes the remembered guest reserve code.
 */
export function clearGuestAccessCode() {
  clearCookie(GUEST_ACCESS_COOKIE);
}

/**
 * Persists the staff upgrade code so returning staff can silently re-unlock controls.
 */
export function saveStaffAccessCode(code) {
  saveCookie(STAFF_ACCESS_COOKIE, code);
}

/**
 * Reads the stored staff upgrade code from cookies, if one exists.
 */
export function readStaffAccessCode() {
  return readCookie(STAFF_ACCESS_COOKIE);
}

/**
 * Removes the remembered staff upgrade code.
 */
export function clearStaffAccessCode() {
  clearCookie(STAFF_ACCESS_COOKIE);
}
