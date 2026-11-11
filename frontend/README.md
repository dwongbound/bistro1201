# Frontend

## Purpose

The `frontend` app is a React + Vite UI for the public site, the gallery, the
reservation flow, and staff tools.

## Stack

- React
- Vite
- Tailwind CSS 4 (via PostCSS; design tokens in `src/index.css`)
- Material UI, only on the staff tools (and the reserve date picker and staff card) until they move to Tailwind
- Jest + React Testing Library
- Playwright for end-to-end coverage

## Key Files

- `src/App.jsx`
- `src/index.css` (Tailwind theme: colors, fonts, shared `btn`/`tag`/`eyebrow` classes)
- `src/common/theme.js` (MUI theme, kept in step with the Tailwind tokens)
- `src/common/Reveal.jsx` + scroll animation CSS in `src/index.css` (scroll reveals, hero parallax; all off under reduced motion)
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
