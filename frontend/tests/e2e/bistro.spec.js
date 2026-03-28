import { test, expect } from '@playwright/test';
import { formatDateKey, formatHumanDate } from '../../src/pages/reserve/reserve';

test.describe('1201 Bistro Website', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  const dinnerTime = '19:00';
  const dinnerTimeLabel = formatUiTime(dinnerTime);

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
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
    const targetDateObject = new Date();
    targetDateObject.setDate(targetDateObject.getDate() + 14 + Math.floor(Math.random() * 7));
    const targetDate = formatIsoDate(targetDateObject);

    await loginToReserve(page, 'service1201');

    await selectCalendarDate(page, targetDateObject);
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(dinnerTime);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);

    await loginToReserve(page, 'bistro1201');

    await selectCalendarDate(page, targetDateObject);
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await page.getByRole('button', { name: dinnerTimeLabel }).click();
    await page.fill('#reservation-name', 'John Doe');
    await page.fill('#reservation-email', 'john@example.com');
    await expect(page.getByRole('button', { name: 'Confirm Reservation' })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirm Reservation' }).click();

    await expect(page.getByRole('heading', { name: 'Reservation Confirmed' })).toBeVisible();
    await expect(
      page.getByText('Your reservation is confirmed. Email confirmation is not configured yet.'),
    ).toBeVisible();
  });

  test('should keep the second slot available after booking one of two seatings', async ({ page }) => {
    const firstDinnerTime = '17:30';
    const secondDinnerTime = '20:45';
    const firstDinnerTimeLabel = formatUiTime(firstDinnerTime);
    const secondDinnerTimeLabel = formatUiTime(secondDinnerTime);
    const targetDateObject = new Date();
    targetDateObject.setDate(targetDateObject.getDate() + 45 + Math.floor(Math.random() * 10));
    const targetDate = formatIsoDate(targetDateObject);

    await loginToReserve(page, 'service1201');

    await selectCalendarDate(page, targetDateObject);
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(firstDinnerTime);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(secondDinnerTime);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);

    await loginToReserve(page, 'bistro1201');

    await selectCalendarDate(page, targetDateObject);
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await expect(page.getByRole('button', { name: firstDinnerTimeLabel })).toBeVisible();
    await expect(page.getByRole('button', { name: secondDinnerTimeLabel })).toBeVisible();

    await page.getByRole('button', { name: firstDinnerTimeLabel }).click();
    await page.fill('#reservation-name', 'John Doe');
    await page.fill('#reservation-email', 'john@example.com');
    await page.getByRole('button', { name: 'Confirm Reservation' }).click();

    await expect(page.getByRole('heading', { name: 'Reservation Confirmed' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await selectCalendarDate(page, targetDateObject);
    await expect(page.locator('input[name="date"]')).toHaveValue(targetDate);
    await expect(page.getByRole('button', { name: secondDinnerTimeLabel })).toBeVisible();
    await expect(page.getByRole('button', { name: firstDinnerTimeLabel })).toHaveCount(0);
  });

  test('should let staff add, free, and then remove a reserved slot', async ({ page, context }) => {
    const targetDateObject = new Date();
    targetDateObject.setDate(targetDateObject.getDate() + 5);
    const targetDate = formatIsoDate(targetDateObject);
    const flowDinnerTime = '18:30';
    const flowDinnerTimeLabel = formatUiTime(flowDinnerTime);

    await loginToReserve(page, 'service1201');
    await expect(page.getByRole('heading', { name: 'Reserve an Evening' })).toBeVisible();

    await selectCalendarDate(page, targetDateObject);
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

    await expect(page.locator('p', { hasText: flowDinnerTimeLabel }).first()).toBeVisible();

    await resetReserveAccess(page, context);
    await expect(page.getByRole('heading', { name: 'Enter an Access Code' })).toBeVisible();

    await loginToReserve(page, 'bistro1201');
    if ((await page.locator('input[name="date"]').inputValue()) !== targetDate) {
      await selectCalendarDate(page, targetDateObject);
    }
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

    await expect(page.getByRole('heading', { name: 'Reservation Confirmed' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByPlaceholder('Staff Access Code').fill('service1201');
    await page.getByRole('button', { name: 'Unlock Staff Controls' }).click();
    await expect(page.getByRole('heading', { name: '1201 Team Access' })).toBeVisible();

    if ((await page.locator('input[name="date"]').inputValue()) !== targetDate) {
      await selectCalendarDate(page, targetDateObject);
    }
    await expect(page.getByRole('button', { name: 'Free Slot' })).toBeEnabled();
    await page.getByRole('button', { name: 'Free Slot' }).click();
    await expect(page.getByRole('heading', { name: 'Free Reserved Slot' })).toBeVisible();
    await expect(page.getByRole('button', { name: flowDinnerTimeLabel })).toBeVisible();

    await Promise.all([
      page.waitForResponse(
        (response) =>
          matchesDeleteRequest(response, `/api/reservations/${targetDate}`, 'time', flowDinnerTime),
      ),
      page.getByRole('button', { name: 'Confirm' }).click(),
    ]);

    await expect(page.getByRole('heading', { name: 'Cancellation Sent' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: 'Free Slot' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Remove Slot' })).toBeEnabled();

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
      page.getByRole('button', { name: 'Remove Slot' }).click(),
    ]);

    await expect(page.getByText('No dinner slots are open for this date yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Slot' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Free Slot' })).toBeDisabled();
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

    const targetDateObject = new Date();
    targetDateObject.setDate(targetDateObject.getDate() + 10 + Math.floor(Math.random() * 5));
    const targetDate = formatIsoDate(targetDateObject);
    const mobileDinnerTime = '18:15';
    const mobileDinnerTimeLabel = formatUiTime(mobileDinnerTime);

    await loginToReserve(page, 'service1201');
    await selectCalendarDate(page, targetDateObject);
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

    await loginToReserve(page, 'bistro1201');
    await selectCalendarDate(page, targetDateObject);
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

  test('should keep an opened reservation slot visible after leaving reserve and coming back', async ({ page }) => {
    await loginToReserve(page, 'service1201');

    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
    const targetDay = targetDate.getDate().toString();

    await selectCalendarDate(page, targetDate);
    await expect(page.locator('input[name="date"]')).toHaveValue(formatIsoDate(targetDate));

    await page.getByRole('button', { name: 'Add Slot' }).click();
    await page.locator('input[name="dinner_time"]').fill(dinnerTime);

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/availability') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Save and Open' }).click(),
    ]);

    await expect(page.getByText('These are the dinner slots currently open for this date.')).toBeVisible();
    await expect(page.getByRole('button', { name: dinnerTimeLabel })).toBeVisible();

    await navigateToPrimaryRoute(page, 'About');
    await expect(page).toHaveURL(/\/about$/);

    await loginToReserve(page, 'service1201');
    await selectCalendarDate(page, targetDate);

    const targetTile = page.getByRole('button', { name: formatCalendarLabel(targetDate) });
    await expect(targetTile).toContainText(targetDay);
    await expect(page.getByText('These are the dinner slots currently open for this date.')).toBeVisible();
    await expect(page.getByRole('button', { name: dinnerTimeLabel })).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(formatIsoDate(targetDate));
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
