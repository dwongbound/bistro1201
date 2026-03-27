FROM rust:1.89 as builder

WORKDIR /app

# Copy the backend source directly so the produced binary always matches the current app.
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
