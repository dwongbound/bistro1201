FROM rust:latest AS chef
RUN cargo install cargo-chef
WORKDIR /app

FROM chef AS planner
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies only — cached unless Cargo.toml/Cargo.lock changes.
RUN cargo chef cook --release --recipe-path recipe.json
# Build the app binary.
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
COPY backend/templates ./templates
RUN cargo build --release

FROM debian:bookworm-slim

# TLS-backed SMTP and Postgres connections need root certificates in the runtime image.
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/bistro-backend /usr/local/bin/
COPY --from=builder /app/templates /app/templates

CMD ["bistro-backend"]
