import { test, expect } from '@playwright/test';
import { formatDateKey, formatHumanDate } from '../../src/pages/reserve/reserve';

test.describe('1201 Bistro Website', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  const primaryDinnerTime = '19:00';
  const secondaryDinnerTime = '20:45';
  const primaryDinnerTimeLabel = formatUiTime(primaryDinnerTime);
  const secondaryDinnerTimeLabel = formatUiTime(secondaryDinnerTime);
  let createdSlots = [];
  let createdReservations = [];

  test.beforeEach(async ({ context, page }) => {
    createdSlots = [];
    createdReservations = [];
    await context.clearCookies();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test.afterEach(async ({ request }) => {
    if (!createdSlots.length && !createdReservations.length) {
      return;
    }

    const loginResponse = await request.post('/api/auth/login', {
      data: { code: 'service1201' },
    });

    if (!loginResponse.ok()) {
      return;
    }

    const { token } = await loginResponse.json();
    const headers = { Authorization: `Bearer ${token}` };

    for (const reservation of dedupeTrackedItems(createdReservations)) {
      try {
        await request.delete(`/api/reservations/${reservation.date}?time=${encodeURIComponent(reservation.time)}`, {
          headers,
        });
      } catch {
        // Tests may already free this reservation as part of the scenario.
      }
    }

    for (const slot of dedupeTrackedItems(createdSlots)) {
      try {
        await request.delete(`/api/availability/${slot.date}?dinner_time=${encodeURIComponent(slot.time)}`, {
          headers,
        });
      } catch {
        // Tests may already remove this slot as part of the scenario.
      }
    }
  });

  const loginToReserve = async (page, accessCode) => {
    await page.goto('/reserve');

    const reserveHeading = page.getByRole('heading', { name: 'Reserve an Evening' });
    const accessGateHeading = page.getByRole('heading', { name: 'Enter an Access Code' });
    const signOutButton = page.getByRole('button', { name: 'Sign Out' });

    await Promise.race([
      reserveHeading.waitFor({ state: 'visible', timeout: 10000 }),
      accessGateHeading.waitFor({ state: 'visible', timeout: 10000 }),
    ]);

    if (await signOutButton.isVisible().catch(() => false)) {
      await signOutButton.click();
      await expect(accessGateHeading).toBeVisible();
    }

    if (await accessGateHeading.isVisible().catch(() => false)) {
      await page.getByLabel('Access Code').fill(accessCode);
      const submitButton = page.getByRole('button', { name: 'Submit' });
      await expect(submitButton).toBeEnabled();
      await Promise.all([
        reserveHeading.waitFor({ state: 'visible', timeout: 10000 }),
        submitButton.click(),
      ]);
    }

    await expect(reserveHeading).toBeVisible();
  };

  const resetReserveAccess = async (page, context) => {
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto('/reserve');
  };

  const trackSlot = (date, time) => {
    createdSlots.push({ date, time });
  };

  const trackReservation = (date, time) => {
    createdReservations.push({ date, time });
  };

  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/1201 Bistro/);
    const heroHeading = page.getByRole('heading', { name: /Welcome to/i });
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText(/1201/i);
  });

  test('should navigate to About page', async ({ page }) => {
    await page.goto('/');
    await navigateToPrimaryRoute(page, 'About');
    const aboutHeading = page.getByRole('heading', { name: /About/i });
    await expect(aboutHeading).toBeVisible();
    await expect(aboutHeading).toContainText(/1201/i);
  });

  test('should navigate to Gallery page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'View Gallery' }).click();
    await expect(page.getByRole('heading', { name: 'Event Gallery' })).toBeVisible();
  });

  test('should open the Swagger API docs page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/api/docs/');
    await expect(page).toHaveTitle(/Swagger UI/);
    await expect(page.locator('#swagger-ui')).toBeVisible();
    await expect(page.locator('#swagger-ui')).toContainText('/api/auth/login');
    await expect(page.locator('#swagger-ui')).toContainText('/api/gallery');
  });

  test('should access reserve page and unlock staff controls', async ({ page }) => {
    await page.goto('/');
    await navigateToPrimaryRoute(page, 'Reserve');

    await expect(page.getByRole('heading', { name: 'Enter an Access Code' })).toBeVisible();

    await page.getByPlaceholder('Access Code').fill('service1201');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByRole('heading', { name: 'Reserve an Evening' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1201 Team Access' })).toBeVisible();
    await expect(page.getByText('Add Slot')).toBeVisible();
  });

  test('should let a guest sign in and see reserve access', async ({ page }) => {
    await loginToReserve(page, 'bistro1201');

    await expect(page.getByRole('heading', { name: 'Reserve an Evening' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unlock Staff Controls' })).toBeVisible();
  });

  test('should book a reservation on an opened date', async ({ page }) => {
    await loginToReserve(page, 'service1201');
    const targetDate = await page.locator('input[name="date"]').inputValue();
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(primaryDinnerTime);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);
    trackSlot(targetDate, primaryDinnerTime);

    await loginToReserve(page, 'bistro1201');
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await page.getByRole('button', { name: primaryDinnerTimeLabel }).click();
    await page.fill('#reservation-name', 'John Doe');
    await page.fill('#reservation-email', 'john@example.com');
    await expect(page.getByRole('button', { name: 'Confirm Reservation' })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirm Reservation' }).click();
    trackReservation(targetDate, primaryDinnerTime);

    await expect(page.getByRole('heading', { name: 'Reservation Confirmed' })).toBeVisible();
    await expect(
      page.getByText('Your reservation is confirmed. Email confirmation is not configured yet.'),
    ).toBeVisible();
  });

  test('should keep the second slot available after booking one of two seatings', async ({ page }) => {
    await loginToReserve(page, 'service1201');
    const targetDate = await page.locator('input[name="date"]').inputValue();
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(primaryDinnerTime);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);
    trackSlot(targetDate, primaryDinnerTime);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(secondaryDinnerTime);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);
    trackSlot(targetDate, secondaryDinnerTime);

    await loginToReserve(page, 'bistro1201');
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await expect(page.getByRole('button', { name: primaryDinnerTimeLabel })).toBeVisible();
    await expect(page.getByRole('button', { name: secondaryDinnerTimeLabel })).toBeVisible();

    await page.getByRole('button', { name: primaryDinnerTimeLabel }).click();
    await page.fill('#reservation-name', 'John Doe');
    await page.fill('#reservation-email', 'john@example.com');
    await page.getByRole('button', { name: 'Confirm Reservation' }).click();
    trackReservation(targetDate, primaryDinnerTime);

    await expect(page.getByRole('heading', { name: 'Reservation Confirmed' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await expect(page.getByRole('button', { name: secondaryDinnerTimeLabel })).toBeVisible();
    await expect(page.getByRole('button', { name: primaryDinnerTimeLabel })).toHaveCount(0);
  });

  test('should let staff add, free, and then remove a reserved slot', async ({ page, context }) => {
    const flowDinnerTime = secondaryDinnerTime;
    const flowDinnerTimeLabel = secondaryDinnerTimeLabel;
    const visibleActionButton = (label) => page.getByRole('button', { name: label, exact: true });

    await loginToReserve(page, 'service1201');
    await expect(page.getByRole('heading', { name: 'Reserve an Evening' })).toBeVisible();
    const targetDate = await page.locator('input[name="date"]').inputValue();
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(flowDinnerTime);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);
    trackSlot(targetDate, flowDinnerTime);

    await expect(page.locator('p', { hasText: flowDinnerTimeLabel }).first()).toBeVisible();

    await resetReserveAccess(page, context);
    await expect(page.getByRole('heading', { name: 'Enter an Access Code' })).toBeVisible();

    await loginToReserve(page, 'bistro1201');
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await page.getByRole('button', { name: flowDinnerTimeLabel }).click();
    await page.fill('#reservation-name', 'John Doe');
    await page.fill('#reservation-email', 'john@example.com');
    await expect(page.getByRole('button', { name: 'Confirm Reservation' })).toBeEnabled();
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/reservations') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Confirm Reservation' }).click(),
    ]);
    trackReservation(targetDate, flowDinnerTime);

    await expect(page.getByRole('heading', { name: 'Reservation Confirmed' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByPlaceholder('Staff Access Code').fill('service1201');
    await page.getByRole('button', { name: 'Unlock Staff Controls' }).click();
    await expect(page.getByRole('heading', { name: '1201 Team Access' })).toBeVisible();

    await expect(visibleActionButton('Free Slot')).toBeEnabled();
    await visibleActionButton('Free Slot').click();
    const freeDialog = page.getByRole('dialog', { name: 'Free Reserved Slot' });
    await expect(freeDialog).toBeVisible();
    await expect(freeDialog.getByRole('button', { name: flowDinnerTimeLabel })).toBeVisible();
    await freeDialog.getByRole('button', { name: flowDinnerTimeLabel }).click();

    await Promise.all([
      page.waitForResponse(
        (response) =>
          matchesDeleteRequest(response, `/api/reservations/${targetDate}`, 'time', flowDinnerTime),
      ),
      freeDialog.getByRole('button', { name: 'Confirm' }).click(),
    ]);

    const cancellationDialog = page.getByRole('dialog', { name: 'Cancellation Sent' });
    await expect(cancellationDialog).toBeVisible();
    await cancellationDialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Cancellation Sent' })).toHaveCount(0);
    await expect(visibleActionButton('Remove Slot')).toBeEnabled();

    await visibleActionButton('Remove Slot').click();
    const removeDialog = page.getByRole('dialog', { name: 'Remove Dinner Slot' });
    await expect(removeDialog).toBeVisible();
    await removeDialog.getByRole('button', { name: flowDinnerTimeLabel }).click();

    await Promise.all([
      page.waitForResponse(
        (response) =>
          matchesDeleteRequest(
            response,
            `/api/availability/${targetDate}`,
            'dinner_time',
            flowDinnerTime,
          ),
      ),
      removeDialog.getByRole('button', { name: 'Confirm' }).click(),
    ]);

    await expect(page.getByRole('button', { name: flowDinnerTimeLabel })).toHaveCount(0);
  });

  test('should show error for a wrong access code', async ({ page }) => {
    await page.goto('/reserve');

    await page.getByPlaceholder('Access Code').fill('wrongpassword');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText('Invalid access code')).toBeVisible();
  });

  test('should use the mobile navigation drawer on phone-sized browsers', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('Mobile'), 'Mobile-only navigation coverage');

    await page.goto('/');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await expect(page.getByRole('link', { name: 'Reserve' })).toBeVisible();

    await page.getByRole('link', { name: 'Reserve' }).click();

    await expect(page).toHaveURL(/\/reserve$/);
    await expect(page.getByRole('heading', { name: 'Enter an Access Code' })).toBeVisible();
  });

  test('should keep the reserve page mobile-friendly after sign-in', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('Mobile'), 'Mobile-only reserve coverage');

    await loginToReserve(page, 'service1201');

    await expect(page.getByRole('heading', { name: 'Reserve an Evening' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Reservation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Slot' })).toBeVisible();

    const hasPageOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth + 1;
    });

    expect(hasPageOverflow).toBe(false);
  });

  test('should let a mobile guest select an opened seating', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('Mobile'), 'Mobile-only booking coverage');

    const mobileDinnerTime = primaryDinnerTime;
    const mobileDinnerTimeLabel = primaryDinnerTimeLabel;

    await loginToReserve(page, 'service1201');
    const targetDate = await page.locator('input[name="date"]').inputValue();
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(mobileDinnerTime);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);
    trackSlot(targetDate, mobileDinnerTime);

    await loginToReserve(page, 'bistro1201');
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);

    const timeButton = page.getByRole('button', { name: mobileDinnerTimeLabel });
    await expect(timeButton).toBeVisible();
    await timeButton.click();
    await expect(page.getByText(`Selected time: ${mobileDinnerTimeLabel}`)).toBeVisible();

    const hasPageOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth + 1;
    });

    expect(hasPageOverflow).toBe(false);
  });

  test('should load the gallery admin login gate and allow staff sign-in at /staff/gallery', async ({ page }) => {
    await page.goto('/staff/gallery');

    // Login gate is visible — page is not linked in the public nav
    await expect(page.getByText('Staff Access Only')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Staff login succeeds
    await page.getByLabel('Staff Access Code').fill('service1201');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Authenticated gallery admin panel is rendered
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible();
    await expect(page.getByText('New Event')).toBeVisible();
    await expect(page.getByLabel(/^Slug/)).toBeVisible();
    await expect(page.getByText('Events')).toBeVisible();
  });

  test('should keep an opened reservation slot visible after leaving reserve and coming back', async ({ page }) => {
    const persistentDinnerTime = secondaryDinnerTime;
    const persistentDinnerTimeLabel = secondaryDinnerTimeLabel;

    await loginToReserve(page, 'service1201');
    const targetDate = await page.locator('input[name="date"]').inputValue();
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(persistentDinnerTime);

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);
    trackSlot(targetDate, persistentDinnerTime);

    await resetReserveAccess(page, page.context());
    await loginToReserve(page, 'bistro1201');
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await expect(page.getByRole('button', { name: persistentDinnerTimeLabel })).toBeVisible();

    await navigateToPrimaryRoute(page, 'About');
    await expect(page).toHaveURL(/\/about$/);

    await loginToReserve(page, 'bistro1201');
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await expect(page.getByRole('button', { name: persistentDinnerTimeLabel })).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
  });
});

function formatIsoDate(date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

function formatCalendarLabel(date) {
  return formatHumanDate(formatDateKey(date));
}

function formatUiTime(timeValue) {
  const [hours, minutes] = timeValue.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function matchesDeleteRequest(response, pathname, queryKey, queryValue) {
  if (response.request().method() !== 'DELETE' || !response.ok()) {
    return false;
  }

  const url = new URL(response.url());
  return url.pathname.endsWith(pathname) && url.searchParams.get(queryKey) === queryValue;
}

function dedupeTrackedItems(items) {
  const seen = new Set();
  return [...items].reverse().filter((item) => {
    const key = `${item.date}::${item.time}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function navigateToPrimaryRoute(page, linkName) {
  const headerLink = page.getByRole('banner').getByRole('link', { name: linkName }).first();

  if (await headerLink.isVisible().catch(() => false)) {
    await headerLink.click();
    return;
  }

  const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await page.getByRole('link', { name: linkName }).last().click();
}

async function selectCalendarDate(page, date) {
  const targetLabel = formatCalendarLabel(date);
  const targetMonthLabel = date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const currentMonthHeading = page.locator('h6').filter({ hasText: /^[A-Za-z]+ \d{4}$/ }).first();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const targetButton = page.getByRole('button', { name: targetLabel }).first();
    if (await targetButton.count()) {
      await targetButton.click();
      return;
    }

    const currentMonthLabel = (await currentMonthHeading.textContent())?.trim() || '';
    if (!currentMonthLabel) {
      throw new Error('Could not determine the visible calendar month');
    }

    const currentMonthDate = new Date(`${currentMonthLabel} 1`);
    const targetMonthDate = new Date(`${targetMonthLabel} 1`);
    const shouldMoveForward = currentMonthDate < targetMonthDate;

    await page.getByRole('button', { name: shouldMoveForward ? 'Next' : 'Previous' }).click();
  }

  throw new Error(`Could not find calendar date button for ${targetLabel}`);
}
