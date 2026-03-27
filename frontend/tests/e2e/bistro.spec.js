import { test, expect } from '@playwright/test';

test.describe('1201 Bistro Website', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const availableDate = `2032-12-${`${Math.floor(Math.random() * 9) + 10}`.padStart(2, '0')}`;
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

    await Promise.race([
      reserveHeading.waitFor({ state: 'visible', timeout: 10000 }),
      accessGateHeading.waitFor({ state: 'visible', timeout: 10000 }),
    ]);

    if (await accessGateHeading.isVisible().catch(() => false)) {
      await page.getByLabel('Access Code').fill(accessCode);
      await page.getByRole('button', { name: 'Submit' }).click();
    }

    await expect(reserveHeading).toBeVisible();
  };

  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/1201 Bistro/);
    await expect(page.getByRole('heading', { name: /Welcome to/i })).toBeVisible();
    await expect(page.getByText('1201 Bistro')).toBeVisible();
  });

  test('should navigate to About page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('heading', { name: /About/i })).toBeVisible();
    await expect(page.getByText('1201 Bistro')).toBeVisible();
  });

  test('should navigate to Gallery page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'View Gallery' }).click();
    await expect(page.getByRole('heading', { name: 'Event Gallery' })).toBeVisible();
  });

  test('should open the Swagger API docs page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/api/docs/');
    await expect(page.getByText('Swagger UI')).toBeVisible();
    await expect(page.getByText('/api/auth/login')).toBeVisible();
    await expect(page.getByText('/api/gallery')).toBeVisible();
  });

  test('should access reserve page and unlock staff controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Reserve' }).click();

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

  test('should let staff add, free, and then remove a reserved slot', async ({ page }) => {
    const targetDateObject = new Date();
    targetDateObject.setDate(targetDateObject.getDate() + 3 + Math.floor(Math.random() * 4));
    const targetDate = formatIsoDate(targetDateObject);
    const flowDinnerTimeOptions = ['18:15', '18:30', '18:45', '19:15'];
    const flowDinnerTime =
      flowDinnerTimeOptions[Math.floor(Math.random() * flowDinnerTimeOptions.length)];
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

    await page.getByRole('button', { name: 'Sign Out' }).click();
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
          response.url().includes(`/api/reservations/${targetDate}?time=${encodeURIComponent(flowDinnerTime)}`) &&
          response.request().method() === 'DELETE' &&
          response.ok(),
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
          response
            .url()
            .includes(`/api/availability/${targetDate}?dinner_time=${encodeURIComponent(flowDinnerTime)}`) &&
          response.request().method() === 'DELETE' &&
          response.ok(),
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

    await page.getByRole('button', { name: formatCalendarLabel(targetDate) }).click();
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
    await expect(page.getByText(dinnerTimeLabel)).toBeVisible();

    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);

    await loginToReserve(page, 'service1201');
    await page.getByRole('button', { name: formatCalendarLabel(targetDate) }).click();

    const targetTile = page.getByRole('button', { name: formatCalendarLabel(targetDate) });
    await expect(targetTile).toContainText(targetDay);
    await expect(page.getByText('These are the dinner slots currently open for this date.')).toBeVisible();
    await expect(page.getByText(dinnerTimeLabel)).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(formatIsoDate(targetDate));
  });
});

function formatIsoDate(date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

function formatCalendarLabel(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
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

async function selectCalendarDate(page, date) {
  const targetLabel = formatCalendarLabel(date);
  const targetButton = page.getByRole('button', { name: targetLabel }).first();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await targetButton.count()) {
      await targetButton.click();
      return;
    }
    await page.getByRole('button', { name: 'Next' }).click();
  }

  throw new Error(`Could not find calendar date button for ${targetLabel}`);
}
