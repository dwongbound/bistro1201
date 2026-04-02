# Backend

## Purpose

The `backend` app is the Rust API server. It owns reservation persistence,
availability management, access-code validation, gallery metadata, and session
handling.

## Stack

- Rust
- `axum`
- PostgreSQL
- Postmark SMTP for reservation email delivery

## Key Files

- `src/main.rs`
- `src/handlers.rs`
- `src/db.rs`
- `src/models.rs`
- `src/email.rs`
- `Cargo.toml`
- `Dockerfile`

## Environment Variables

- `BACKEND_HOST_PORT`: Host port exposed for the Rust API
- `POSTGRES_DB`: Database name for the local Compose Postgres service
- `POSTGRES_USER`: Database user for the local Compose Postgres service
- `POSTGRES_PASSWORD`: Database password for the local Compose Postgres service
- `DATABASE_URL`: Postgres connection string used by the backend
- `PORT`: Port the Rust server listens on
- `GUEST_ACCESS_CODE`: Access code that can read availability and create
  reservations, and is ensured at backend startup
- `GUEST_ACCESS_CODE_EXPIRES_AT`: Optional expiration applied to that default
  guest code at backend startup
- `STAFF_ACCESS_CODE`: Access code that can also open and close available dates
- `SMTP_HOST`: Enables SMTP delivery for confirmation emails when set
- `SMTP_PORT`: SMTP relay port, usually `587`
- `SMTP_USERNAME`: SMTP username used for authenticated email delivery
- `SMTP_PASSWORD`: SMTP password used for authenticated email delivery
- `SMTP_FROM_ADDRESS`: From address shown on reservation confirmation emails
- `SMTP_FROM_NAME`: Optional friendly sender name for reservation emails

## Common Commands

```bash
docker compose --env-file env/dev.env up backend
docker compose --env-file env/dev.env up -d postgres
cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/bistro1201 cargo test
```

Guest access codes persist in the Postgres `access_codes` table, and the
env-configured default guest code is re-ensured at backend startup.
