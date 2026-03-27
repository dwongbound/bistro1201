# Frontend

## Purpose

The `frontend` app is a React + Vite UI for the public site, the gallery, the
reservation flow, and staff tools.

## Stack

- React
- Vite
- Material UI
- Jest + React Testing Library
- Playwright for end-to-end coverage

## Key Files

- `src/App.jsx`
- `src/common/`
- `src/pages/`
- `vite.config.js`
- `package.json`

## Environment Variables

- `APP_API_BASE_PATH`: Base path the React app uses for API requests
- `DEV_API_PROXY_TARGET`: Backend target that Vite proxies `/api` to during
  local development
- `FRONTEND_HOST_PORT`: Host port exposed for the Vite dev server
- `FRONTEND_NODE_ENV`: Frontend runtime mode

## Common Commands

```bash
docker compose --env-file env/dev.env up frontend
docker compose exec frontend npm test -- --runInBand src/__tests__/Scheduling.test.jsx
docker compose exec frontend npm run build
```
