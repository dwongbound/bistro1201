import { defineConfig, devices } from '@playwright/test';

const availableProjects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
  {
    name: 'Mobile Chrome',
    use: { ...devices['Pixel 5'] },
  },
  {
    name: 'Mobile Safari',
    use: { ...devices['iPhone 12'] },
  },
];

const requestedProjects = (process.env.PLAYWRIGHT_PROJECTS || '')
  .split(',')
  .map((projectName) => projectName.trim())
  .filter(Boolean);

const projects =
  requestedProjects.length > 0
    ? availableProjects.filter((project) => requestedProjects.includes(project.name))
    : availableProjects;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './playwright-artifacts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Do not retry failures automatically; fix flakes at the source. */
  retries: 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    /* Save a screenshot for failed tests so the HTML report has a visual snapshot. */
    screenshot: 'only-on-failure',

    /* Keep traces for real failures so debugging stays clear without retries. */
    trace: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects,

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      DEV_API_PROXY_TARGET: process.env.DEV_API_PROXY_TARGET || 'http://localhost:3000',
    },
  },
});
