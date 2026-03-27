# E2E Tests

## Purpose

The Playwright suite verifies the full browser flow against an isolated Docker
stack so test runs do not depend on your normal local app state.

## Stack

- Playwright
- Chromium, Firefox, WebKit
- `Mobile Chrome`
- `Mobile Safari`

## Key Files

- `bistro.spec.js`
- `../../playwright.config.js`
- `../../../env/test.env`

## Running The Suite

```bash
docker compose --env-file env/test.env --profile test run --rm e2e sh -lc \
  "npm ci && npx playwright test tests/e2e/bistro.spec.js --reporter=line"
```

For desktop plus mobile coverage:

```bash
docker compose --env-file env/test.env --profile test run --rm e2e sh -lc \
  "npm ci && npx playwright test --project=chromium --project=\"Mobile Chrome\" --reporter=line"
```

## Cleanup

```bash
docker compose --env-file env/test.env --profile test down -v
```
