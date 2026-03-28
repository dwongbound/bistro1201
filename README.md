# 1201 Bistro Website

A full-stack restaurant site for 1201 Bistro with a React frontend, a Rust
backend, and `nginx` serving the production-style app entrypoint. This was mostly vibe coded with my prior full stack knowledge and good patterns, thank you technology.

## Contents

- [Features](#features)
- [Stack Overview](#stack-overview)
- [API Documentation](#api-documentation)
  - [How The Pieces Connect](#how-the-pieces-connect)
  - [Services Used](#services-used)
  - [Runtime Boundaries](#runtime-boundaries)
  - [Gallery Content](#gallery-content)
- [Setup](#setup)
  - [Docker](#docker)
  - [Container-less](#container-less)
- [Testing](#testing)
  - [Test Types](#test-types)
  - [Running Tests](#running-tests)
  - [Test Order](#test-order)
- [Environments](#environments)
- [Deployment](#deployment)
  - [Recommended Server Setup](#recommended-server-setup)
  - [Before First Deploy](#before-first-deploy)
- [GitHub Actions](#github-actions)
  - [Required GitHub Secrets](#required-github-secrets)
  - [Suggested GitHub Flow](#suggested-github-flow)
- [Environment Variables](#environment-variables)
  - [Shared Compose Variables](#shared-compose-variables)
  - [Backend Variables](#backend-variables)
  - [Postmark Setup](#postmark-setup)
  - [Prod Env Example](#prod-env-example)
- [Troubleshooting](#troubleshooting)

## Features

- Branded Home, About, Gallery, Team, and Reserve pages
- Backend-driven gallery content backed by PostgreSQL
- Guest reservation flow with per-slot availability
- Staff-managed slot opening, freeing, and removal
- Persistent guest access-code management from the staff UI
- PostgreSQL-backed reservation, availability, session, and gallery data
- Postmark-backed transactional reservation email support

## Stack Overview

This project is a small full-stack restaurant site. The main pieces are:

- React frontend
- Rust API server
- PostgreSQL database
- Postmark for outgoing reservation emails
- Cloudflare for DNS, frontend hosting, and optional email routing

## API Documentation

The API documentation surfaces in this project are:

- Swagger UI: `/api/docs`
- Raw OpenAPI JSON: `/api/openapi.json`

- `/api/docs` is the standard Swagger UI hosted by the Rust backend
- `/api/openapi.json` is the generated OpenAPI document that Swagger reads

If you are running locally through `nginx`, the easiest URL is:

- `http://localhost/api/docs`

If you are talking directly to the backend container instead of `nginx`, use:

- `http://localhost:3000/api/docs`

### How The Pieces Connect

At a high level, the request flow looks like this:

1. A guest opens the site in the browser.
2. The React frontend loads and sends API requests to the Rust backend.
3. The Rust backend reads and writes reservation data in PostgreSQL.
4. When a reservation includes an email address, the backend sends the confirmation through Postmark.
5. If you use Cloudflare Email Routing, replies to `reservations@1201bistrocafe.com` can forward into your real inbox.

That means each layer has a clear job:

- Frontend: render the UI and collect user input
- Backend: validate access, enforce business rules, and expose API endpoints
- Database: persist reservations, availability, sessions, and guest access codes
- Email provider: deliver confirmation emails
- Cloudflare: host the frontend, manage DNS, and optionally route reply email

### Services Used

#### React

React powers the frontend UI. It renders the public pages, the reserve flow,
and the staff controls.

- In this repo: `frontend/`
- Official site: https://react.dev/

#### Rust API Server

The backend is a Rust service using `axum` for HTTP routing. It handles:

- guest and staff access-code login
- reservation creation
- availability management
- guest access-code management
- confirmation email delivery

Rust is a strong fit here because it gives you a compiled server with strong
type safety, memory safety, and good performance without needing a large runtime.

- In this repo: `backend/src/`
- Rust official site: https://www.rust-lang.org/
- Learn Rust: https://rust-lang.org/learn/

#### PostgreSQL

PostgreSQL is the app's relational database. It stores:

- reservations
- available dinner slots
- guest access codes
- bearer-token sessions
- gallery event metadata and image records

This is the persistent source of truth for reserve data.

- Official site: https://www.postgresql.org/
- Documentation: https://www.postgresql.org/docs/

#### Postmark

Postmark is the transactional email provider used for reservation confirmation
emails. In this app, the backend talks to Postmark over SMTP. Postmark handles
outbound delivery, while your own mailbox or forwarding setup handles replies.

- Official site: https://postmarkapp.com/
- Developer docs: https://postmarkapp.com/developer
- SMTP guide: https://postmarkapp.com/developer/user-guide/send-email-with-smtp

#### Cloudflare

Cloudflare is a good fit for this project because it can cover several pieces:

- DNS for `1201bistrocafe.com`
- Cloudflare Pages for the frontend
- optional Email Routing for addresses like `reservations@1201bistrocafe.com`
- optional image/file products later like R2

Cloudflare Email Routing forwards inbound mail only. It does not replace
Postmark for outbound app email.

- Cloudflare Pages overview: https://developers.cloudflare.com/pages/
- Cloudflare Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Email Routing overview: https://developers.cloudflare.com/email-routing/
- Cloudflare Email Routing setup: https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/

### Runtime Boundaries

The deployment boundary in this repo is intentionally simple:

- Frontend config is controlled by `APP_API_BASE_PATH`
- Backend config is controlled by env vars like `DATABASE_URL`, access codes,
  and Postmark settings

So you can host the frontend on Cloudflare while placing the backend and
database somewhere else entirely, as long as:

- the frontend knows the backend API URL
- the backend knows the database URL
- the backend has valid Postmark credentials

### Gallery Content

The Gallery is now backend-driven instead of hardcoded in the frontend. That means
you can add new events and swap image URLs without rebuilding the React app.

- `gallery_events` stores event-level metadata like:
  - `slug`
  - `title`
  - `date_label`
  - `summary`
  - `cover_image_url`
- `gallery_images` stores the ordered images for each event, including:
  - `event_slug`
  - `image_url`
  - `alt_text`
  - `sort_order`
  - `is_preview`

The intended flow is:

1. Upload your images to Cloudflare R2 or Cloudflare Images.
2. Copy the public delivery URLs.
3. Save those URLs and the event metadata into PostgreSQL.
4. The frontend Gallery pages load that data from `/api/gallery` and `/api/gallery/:slug`.

This keeps image hosting, event metadata, and frontend deploys nicely decoupled.

## Setup

App-specific guides:

- [Frontend notes](./frontend/README.md)
- [Backend notes](./backend/README.md)
- [E2E notes](./frontend/tests/e2e/README.md)

### Docker

1. Make sure Docker and Docker Compose are installed.
2. Pick the instance env file you want from `env/`.
3. Start the app stack:

   ```bash
   docker compose --env-file env/dev.env up --build
   ```

Available endpoints:

- App through `nginx`: `http://localhost`
- Vite dev server: `http://localhost:5173`
- Backend API: `http://localhost:3000`

`nginx` is the production-style entrypoint in this repo. It serves the built
frontend bundle and proxies API traffic to the Rust backend. The main files for
that layer are:

- `nginx.Dockerfile`
- `nginx.conf`
- `frontend/dist/` at build time

If frontend dependencies change and Docker has an older `node_modules` volume,
restart with:

```bash
docker compose --env-file env/dev.env up --build
```

### Container-less

#### Frontend

1. Go to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`.

#### Backend

1. Go to the backend directory:

   ```bash
   cd backend
   ```

2. Build and run the server:

   ```bash
   cargo run
   ```

The backend will be available at `http://localhost:3000`.

## Testing

This project includes frontend unit tests, backend Rust tests, and Playwright
end-to-end tests.

### Test Types

#### Frontend Unit Tests

- Location: `frontend/src/__tests__/`
- Framework: Jest with React Testing Library
- Run: `cd frontend && npm test`

#### Backend Tests

- Location: `backend/src/`
- Framework: Rust built-in test runner
- Run: `cd backend && cargo test`

#### E2E Tests

- Location: `frontend/tests/e2e/`
- Framework: Playwright
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Isolated test env: `env/test.env`

### Running Tests

#### Local Development

```bash
# Frontend unit tests
cd frontend && npm test

# Backend tests
cd backend && cargo test

# E2E tests against the Vite dev server
cd frontend && npm run test:e2e
```

#### Docker Test Commands

```bash
# Start the application services
docker compose --env-file env/dev.env up -d

# Frontend unit tests
docker compose exec frontend npm test -- --runInBand

# Backend tests
docker compose exec backend cargo test

# E2E tests against an isolated nginx/backend/postgres stack
docker compose --env-file env/test.env --profile test run --rm e2e sh -lc \
  "cd /work && ./scripts/run_e2e_in_docker.sh"
```

### Test Order

Run tests in this order when possible:

1. Frontend unit tests
2. Backend tests
3. E2E tests

## Environments

### Dev

- Frontend dev server: `http://localhost:5173`
- Backend: `http://localhost:3000`
- `nginx`: `http://localhost`
- Database: `postgres://postgres:postgres@localhost:5432/bistro1201`
- Start command: `docker compose --env-file env/dev.env up --build`

### Staging

- App through `nginx`: `http://localhost:5174`
- Backend: `http://localhost:3001`
- Database: `postgres://postgres:postgres@localhost:5432/bistro1201_staging`
- Start command: `docker compose --env-file env/staging.env up --build`

### Prod

- App through `nginx`: `http://localhost`
- Backend: `http://localhost:3000`
- Database: whatever `DATABASE_URL` points at in your production env
- Start command: `docker compose --env-file env/prod.env up --build`

## Deployment

The simplest production deployment for this repo is a small Linux server or VPS
running Docker Compose.

If you want the frontend hosted separately from the backend, you can still host
the built frontend on Cloudflare and point it at a separately hosted backend.

### Recommended Server Setup

1. Install Docker and Docker Compose on the server.
2. Clone this repo onto the server in a stable deploy directory such as `/opt/bistro1201`.
3. Create a production env file on the server only, for example:

   ```bash
   /opt/bistro1201/env/prod.env
   ```

4. Make sure Postgres data lives on persistent storage, either through a Docker volume or a managed database service.
5. Start the app:

   ```bash
   cd /opt/bistro1201
   docker compose --env-file env/prod.env up --build -d
   ```

6. Put your real domain and HTTPS in front of the `nginx` service.

### Before First Deploy

- Replace any default access codes in production.
- Set real SMTP values if reservation emails should be sent.
- Make sure the production Postgres database is backed up regularly.
- Keep the production env file on the server instead of committing secrets to GitHub.

## GitHub Actions

This repo now uses separate GitHub Actions workflows for checks, E2E, and deploy:

- [.github/workflows/checks.yml](/Users/dwong/Documents/bistro1201/.github/workflows/checks.yml)
  Runs frontend Jest and backend `cargo test` on pushes and pull requests.
- [.github/workflows/e2e-on-develop.yml](/Users/dwong/Documents/bistro1201/.github/workflows/e2e-on-develop.yml)
  Runs the isolated Playwright suite on pushes to `develop`.
- [.github/workflows/deploy-fly-production.yml](/Users/dwong/Documents/bistro1201/.github/workflows/deploy-fly-production.yml)
  Deploys to Fly.io on pushes to `main`.

### Required GitHub Secrets

For Fly.io deployment from GitHub Actions, add this repository secret:

- `FLY_API_TOKEN`

GitHub path:

1. Open the repository.
2. Go to `Settings`.
3. Open `Secrets and variables`.
4. Open `Actions`.
5. Add a repository secret named `FLY_API_TOKEN`.

### Suggested GitHub Flow

1. Push feature branches and open pull requests.
2. Let `CI` validate frontend unit tests, backend tests, and the Playwright E2E suite.
3. Merge `develop` into `staging` once CI is green.
4. Merge `staging` into `main` once the promotion path is approved.
5. Let the `main` push trigger the Fly.io deploy workflow.

## Environment Variables

Instance settings now live in the `env/` directory. Use `--env-file` to inject
the right values for dev, staging, or prod.

### Shared Compose Variables

- `FRONTEND_NODE_ENV`: Frontend container mode, such as `development` or `production`
- `APP_INSTANCE`: Named app instance used for environment-specific UI/runtime behavior
- `FRONTEND_HOST_PORT`: Host port exposed for the Vite dev server
- `BACKEND_HOST_PORT`: Host port exposed for the Rust backend
- `NGINX_HOST_PORT`: Host port exposed for the `nginx` entrypoint
- `APP_API_BASE_PATH`: Base API path compiled into the frontend build
- `DEV_API_PROXY_TARGET`: Dev-only Vite proxy target for `/api`
- `E2E_BASE_URL`: Base URL used by the Playwright test container

For a split prod deployment, the main variable boundary is:

- Frontend: `APP_API_BASE_PATH`
- Backend: `DATABASE_URL`, access codes, and Postmark settings

That means the frontend can be hosted separately from the backend and database,
as long as `APP_API_BASE_PATH` points at the backend's public `/api` origin.

### Backend Variables

- `POSTGRES_DB`: Database name used by the local Compose Postgres service
- `POSTGRES_USER`: Database user used by the local Compose Postgres service
- `POSTGRES_PASSWORD`: Database password used by the local Compose Postgres service
- `DATABASE_URL`: Full Postgres connection string used by the Rust backend
- `PORT`: Port the Rust server listens on
- `GUEST_ACCESS_CODE`: Access code that can load reserve availability and
  create reservations
- `GUEST_ACCESS_CODE_EXPIRES_AT`: Optional expiration for the default guest
  code used to bootstrap a fresh database. Accepts either RFC3339 like
  `2026-04-01T00:00:00Z` or a Unix timestamp
- `STAFF_ACCESS_CODE`: Access code that can also open and close available
  reservation dates
- `POSTMARK_SERVER_TOKEN`: Optional shortcut for Postmark SMTP. When set, the
  backend defaults to `smtp.postmarkapp.com:587` and uses this token for both
  SMTP username and password unless you override them explicitly.
- `SMTP_HOST`: SMTP relay host used for reservation confirmation emails
- `SMTP_PORT`: SMTP relay port, defaults to `587`
- `SMTP_USERNAME`: SMTP username when email delivery is enabled
- `SMTP_PASSWORD`: SMTP password when email delivery is enabled
- `SMTP_FROM_ADDRESS`: From-address used on reservation confirmation emails
- `SMTP_FROM_NAME`: Optional display name for the confirmation sender
- `SMTP_REPLY_TO_ADDRESS`: Optional reply-to mailbox if guest replies should go
  somewhere different than the sender address
- `SMTP_REPLY_TO_NAME`: Optional display name paired with
  `SMTP_REPLY_TO_ADDRESS`
- `SMTP_CONFIRMATION_TEMPLATE_PATH`: Optional path to the plain-text reservation email template. Defaults to `/app/templates/reservation_confirmation.txt`

The default confirmation email template lives at [backend/templates/reservation_confirmation.txt](/Users/dwong/Documents/bistro1201/backend/templates/reservation_confirmation.txt) and supports:

- `{{date}}`
- `{{time}}`
- `{{name}}`

### Postmark Setup

The easiest prod email setup for this app is Postmark plus a real inbox
or forwarder for guest replies.

Use this env configuration:

```env
POSTMARK_SERVER_TOKEN=pm_server_token_here
SMTP_FROM_ADDRESS=reservations@1201bistrocafe.com
SMTP_FROM_NAME=1201 Bistro
SMTP_REPLY_TO_ADDRESS=reservations@1201bistrocafe.com
SMTP_REPLY_TO_NAME=1201 Bistro Reservations
```

With `POSTMARK_SERVER_TOKEN` set, you do not need to manually set
`SMTP_HOST`, `SMTP_USERNAME`, or `SMTP_PASSWORD` unless you want to override
the defaults. The backend will use Postmark's SMTP endpoint automatically.

### Prod Env Example

The checked-in [env/prod.env](/Users/dwong/Documents/bistro1201/env/prod.env)
is now written as a decoupled template:

- `APP_API_BASE_PATH` should point at your public backend URL
- `DATABASE_URL` should point at whichever Postgres host you choose later
- Postmark sender and reply-to values are ready to use with `1201bistrocafe.com`

That keeps the frontend, backend, database, and email provider independently
replaceable.

## Troubleshooting

### Blank Frontend Through `nginx`

- Make sure the `nginx` service is running.
- Make sure the backend is healthy and reachable on port `3000`.
- Rebuild the stack after config changes:

  ```bash
  docker compose --env-file env/dev.env up --build
  ```

### Reserve Availability

- Guests can reserve only dates that staff has opened in the reserve calendar.
- The reserve page signs in against the backend and stores a server-issued
  session token.
- Front-of-house staff can unlock `Staff Controls` with `STAFF_ACCESS_CODE`.
- The default guest access code is permanent unless you explicitly set
  `GUEST_ACCESS_CODE_EXPIRES_AT`, and it is only bootstrapped into a fresh
  database.
- Guest access codes persist in the `access_codes` Postgres table, so additional
  codes can be managed through the staff UI and survive restarts.
- Staff sessions can create and remove guest access codes directly from the
  schedule page's `Staff Controls` card.
- The staff access code is read directly from `STAFF_ACCESS_CODE` in the env
  file instead of being database-backed.
- Staff can add, free, and remove individual slots on the currently selected
  date without restarting the app.

### API Documentation

- Visit `/api/docs` through `nginx` to browse the Swagger UI.
- The raw OpenAPI document is available at `/api/openapi.json`.
- Swagger is the source of truth for the backend HTTP contract.

### Existing Data

- The reserve page reflects whatever is already stored in the configured Postgres database.
- If an old date appears open unexpectedly, inspect the `available_dates` table in Postgres.
- End-to-end and manual testing can leave example rows behind unless you reset the dev database.

### Database Location

- Development and staging data now live in the named Docker volume `postgres_data`.
- Production should use a persistent Postgres volume or managed Postgres service.
- If you are migrating from older SQLite-based local data, those `.db` files are no
  longer read by the backend and can be archived or deleted once you no longer need them.

### E2E Runner

- The `e2e` service is test-only and is behind the `test` profile.
- It will not start during a normal `docker compose up`.
