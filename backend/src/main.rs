mod db;
mod docs;
mod email;
mod error;
mod gallery_handlers;
mod handlers;
mod models;
mod state;
mod storage;

use axum::{
    extract::DefaultBodyLimit,
    routing::{delete, get, post},
    Router,
};
use std::{env, net::SocketAddr};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::Level;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::db::{ensure_default_guest_access_code, init_db, load_default_guest_access_code_from_env};
use crate::storage::load_storage_state;
use crate::docs::ApiDoc;
use crate::email::load_email_config;
use crate::gallery_handlers::{
    create_gallery_event, create_gallery_image, delete_gallery_event_handler, delete_gallery_image_handler,
    get_gallery_event, get_gallery_events, list_gallery_images, upload_gallery_file,
};
use crate::handlers::{
    create_access_code, create_available_date, create_reservation, delete_access_code, delete_available_date,
    delete_reservation, get_access_codes, get_available_dates, get_reservations, health, login, root,
};
use crate::state::AppState;

/// Builds the shared Axum router so both `main` and backend tests exercise the same routes.
fn build_app(state: AppState) -> Router {
    Router::new()
        .merge(SwaggerUi::new("/api/docs").url("/api/openapi.json", ApiDoc::openapi()))
        .route("/", get(root))
        .route("/health", get(health))
        .route("/api/gallery", get(get_gallery_events).post(create_gallery_event))
        .route("/api/gallery/:slug", get(get_gallery_event).delete(delete_gallery_event_handler))
        .route("/api/gallery/:slug/upload", post(upload_gallery_file).layer(DefaultBodyLimit::max(50 * 1024 * 1024)))
        .route("/api/gallery/:slug/images", get(list_gallery_images).post(create_gallery_image))
        .route("/api/gallery/:slug/images/:id", delete(delete_gallery_image_handler))
        .route("/api/auth/login", post(login))
        .route("/api/access-codes", get(get_access_codes).post(create_access_code))
        .route("/api/access-codes/:code", delete(delete_access_code))
        .route("/api/reservations", get(get_reservations).post(create_reservation))
        .route("/api/reservations/:date", delete(delete_reservation))
        .route("/api/availability", get(get_available_dates).post(create_available_date))
        .route("/api/availability/:date", delete(delete_available_date))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(
            // Keep container logs compact while still showing enough detail to monitor API traffic.
            TraceLayer::new_for_http()
                .make_span_with(|request: &axum::http::Request<axum::body::Body>| {
                    tracing::info_span!(
                        "http",
                        method = %request.method(),
                        path = %request.uri().path()
                    )
                })
                .on_response(
                    |response: &axum::http::Response<axum::body::Body>,
                     latency: std::time::Duration,
                     span: &tracing::Span| {
                        tracing::event!(
                            parent: span,
                            Level::INFO,
                            status = response.status().as_u16(),
                            elapsed_ms = latency.as_millis(),
                            "response finished"
                        );
                    },
                ),
        )
}

/// Waits for container shutdown signals so Docker can stop the backend promptly.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to listen for Ctrl+C shutdown signal");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received");
}

#[tokio::main]
/// Boots the backend, initializes Postgres, and registers the API routes.
async fn main() {
    println!("Starting bistro backend...");
    dotenv::dotenv().ok();
    tracing_subscriber::fmt()
        .with_target(false)
        .compact()
        .init();

    // Keep the env parsing close to startup so the app's runtime inputs are easy to spot.
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@postgres:5432/bistro1201".to_string());
    tracing::info!("connecting to database: {}", database_url);
    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .unwrap();
    let staff_access_code = env::var("STAFF_ACCESS_CODE").unwrap_or_else(|_| "service1201".to_string());
    let default_guest_access_code = load_default_guest_access_code_from_env().unwrap();

    let db = init_db(&database_url).await.unwrap();
    // New databases start with one guest code, but existing databases keep whatever staff already stored.
    ensure_default_guest_access_code(&db, &default_guest_access_code).await.unwrap();

    let storage = load_storage_state();
    if storage.is_some() {
        tracing::info!("object storage configured");
    } else {
        tracing::info!("object storage not configured — file uploads will be unavailable");
    }

    let state = AppState {
        db,
        email: load_email_config().unwrap(),
        staff_access_code,
        storage,
    };

    let app = build_app(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("Listening on {}", addr);
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use crate::db::{create_session, ensure_schema, insert_available_date, insert_reservation};
    use crate::models::{AvailabilityDate, Reservation};
    use tower::util::ServiceExt;

    fn test_state(pool: sqlx::PgPool) -> AppState {
        AppState {
            db: pool,
            email: None,
            staff_access_code: "service1201".to_string(),
            storage: None,
        }
    }

    #[sqlx::test]
    async fn test_swagger_ui_route_is_served(pool: sqlx::PgPool) {
        let app = build_app(test_state(pool));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/docs/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let html = String::from_utf8(body.to_vec()).unwrap();
        assert!(html.contains("Swagger UI"));
    }

    #[sqlx::test]
    async fn test_openapi_json_mentions_core_routes(pool: sqlx::PgPool) {
        let app = build_app(test_state(pool));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/openapi.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let json = String::from_utf8(body.to_vec()).unwrap();
        assert!(json.contains("/api/gallery"));
        assert!(json.contains("/api/auth/login"));
        assert!(json.contains("bearer_auth"));
    }

    #[sqlx::test]
    async fn test_delete_availability_cancels_matching_reservation(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        insert_available_date(
            &pool,
            AvailabilityDate {
                date: "2026-12-25".to_string(),
                dinner_time: Some("19:00".to_string()),
            },
        )
        .await
        .unwrap();
        insert_reservation(
            &pool,
            Reservation {
                id: None,
                date: "2026-12-25".to_string(),
                time: "19:00".to_string(),
                name: "Jane Doe".to_string(),
                email: Some("jane@example.com".to_string()),
            },
        )
        .await
        .unwrap();

        let token = create_session(&pool, "staff").await.unwrap();
        let app = build_app(test_state(pool.clone()));

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/api/availability/2026-12-25?dinner_time=19%3A00")
                    .header("Authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let json = String::from_utf8(body.to_vec()).unwrap();
        assert!(json.contains("\"cancellation_email_sent\":false"));
        assert!(json.contains("\"removed_reservation\""));
        assert!(json.contains("\"Jane Doe\""));
    }

    #[sqlx::test]
    async fn test_create_reservation_succeeds_without_email_config(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        insert_available_date(
            &pool,
            AvailabilityDate {
                date: "2026-12-25".to_string(),
                dinner_time: Some("19:00".to_string()),
            },
        )
        .await
        .unwrap();

        let token = create_session(&pool, "guest").await.unwrap();
        let app = build_app(test_state(pool));

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/reservations")
                    .header("Authorization", format!("Bearer {token}"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        r#"{"date":"2026-12-25","time":"19:00","name":"Jane Doe","email":"jane@example.com"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let json = String::from_utf8(body.to_vec()).unwrap();
        assert!(json.contains("\"confirmation_email_sent\":false"));
        assert!(json.contains("\"Jane Doe\""));
    }
}
