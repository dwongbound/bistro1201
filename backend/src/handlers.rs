use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};

use crate::db::{
    create_session, delete_availability_date, delete_guest_access_code, delete_reservation_by_slot, fetch_access_code,
    fetch_available_dates, fetch_gallery_event_detail, fetch_gallery_event_summaries, fetch_guest_access_codes,
    fetch_reservations, find_role_for_token, insert_available_date, insert_reservation, parse_expiration_timestamp,
    reservation_slot_is_available, resolve_access_code, upsert_access_code,
};
use crate::email::{send_cancellation_email, send_confirmation_email};
use crate::error::{ApiError, ErrorResponse};
use crate::models::{
    AccessCodeLookup, AccessCodeRecord, AccessCodeSeed, AccessRole, AvailabilityDate, CreateAccessCodeRequest,
    CreateReservationResponse, DeleteAvailabilityParams, DeleteAvailabilityResponse, DeleteReservationParams,
    DeleteReservationResponse, GalleryEventDetail, GalleryEventSummary, LoginRequest, LoginResponse, Reservation,
    GUEST_ROLE,
};
use crate::state::AppState;

/// Provides a simple health-check response for the root URL.
#[utoipa::path(
    get,
    path = "/",
    tag = "health",
    responses(
        (status = 200, description = "Backend health check", body = String)
    )
)]
pub(crate) async fn root() -> &'static str {
    "Hello from 1201 Bistro Backend"
}

/// Provides a dedicated health-check endpoint for load balancers and uptime monitors.
#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = String)
    )
)]
pub(crate) async fn health() -> &'static str {
    "ok"
}

/// Returns every gallery event summary for the public gallery index.
#[utoipa::path(
    get,
    path = "/api/gallery",
    tag = "gallery",
    responses(
        (status = 200, description = "Gallery event summaries", body = [GalleryEventSummary]),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn get_gallery_events(
    State(state): State<AppState>,
) -> std::result::Result<Json<Vec<GalleryEventSummary>>, ApiError> {
    let events = fetch_gallery_event_summaries(&state.db).await.map_err(|error| {
        tracing::error!(?error, "Failed to load gallery events");
        ApiError::internal("Unable to load gallery")
    })?;
    Ok(Json(events))
}

/// Returns one public gallery event by slug for the detail page.
#[utoipa::path(
    get,
    path = "/api/gallery/{slug}",
    tag = "gallery",
    params(
        ("slug" = String, Path, description = "Gallery event slug")
    ),
    responses(
        (status = 200, description = "Full gallery event detail", body = GalleryEventDetail),
        (status = 404, description = "Gallery event not found", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn get_gallery_event(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> std::result::Result<Json<GalleryEventDetail>, ApiError> {
    let event = fetch_gallery_event_detail(&state.db, slug.trim())
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to load gallery event");
            ApiError::internal("Unable to load gallery event")
        })?
        .ok_or_else(|| ApiError::not_found("Gallery event was not found"))?;
    Ok(Json(event))
}

/// Issues a bearer token when a submitted access code matches a configured role.
#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Bearer token created", body = LoginResponse),
        (status = 400, description = "Blank code", body = ErrorResponse),
        (status = 401, description = "Invalid or expired code", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> std::result::Result<Json<LoginResponse>, ApiError> {
    let code = payload.code.trim();
    if code.is_empty() {
        return Err(ApiError::bad_request("Access code is required"));
    }

    let role = match resolve_access_code(&state.db, code, &state.staff_access_code)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to validate access code");
            ApiError::internal("Unable to validate access code")
        })?
    {
        AccessCodeLookup::Valid(role) => role,
        AccessCodeLookup::Expired => return Err(ApiError::unauthorized("This access code has expired")),
        AccessCodeLookup::Missing => return Err(ApiError::unauthorized("Invalid access code")),
    };
    let token = create_session(&state.db, &role).await.map_err(|error| {
        tracing::error!(?error, "Failed to create API session");
        ApiError::internal("Unable to create API session")
    })?;

    Ok(Json(LoginResponse {
        token,
        role: role.to_string(),
    }))
}

/// Returns every reservation after validating that the caller has guest-level access.
#[utoipa::path(
    get,
    path = "/api/reservations",
    tag = "reservations",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Reservations", body = [Reservation]),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn get_reservations(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> std::result::Result<Json<Vec<Reservation>>, ApiError> {
    require_role(&state, &headers, AccessRole::Guest).await?;
    let reservations = fetch_reservations(&state.db).await.map_err(|error| {
        tracing::error!(?error, "Failed to load reservations");
        ApiError::internal("Unable to load reservations")
    })?;
    Ok(Json(reservations))
}

/// Creates a reservation after confirming both auth and date availability.
#[utoipa::path(
    post,
    path = "/api/reservations",
    tag = "reservations",
    security(
        ("bearer_auth" = [])
    ),
    request_body = Reservation,
    responses(
        (status = 200, description = "Reservation created", body = CreateReservationResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Selected slot is not open", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn create_reservation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(res): Json<Reservation>,
) -> std::result::Result<Json<CreateReservationResponse>, ApiError> {
    require_role(&state, &headers, AccessRole::Guest).await?;
    if !reservation_slot_is_available(&state.db, &res.date, &res.time)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to validate availability before reservation");
            ApiError::internal("Unable to validate availability")
        })?
    {
        return Err(ApiError::forbidden("That reservation time is not currently open"));
    }

    let saved = insert_reservation(&state.db, res).await.map_err(|error| {
        tracing::error!(?error, "Failed to save reservation");
        ApiError::internal("Unable to save reservation")
    })?;

    let confirmation_email_sent = send_confirmation_email(&state, &saved).await?;

    Ok(Json(CreateReservationResponse {
        reservation: saved,
        confirmation_email_sent,
    }))
}

/// Frees a reserved dinner slot and emails the guest attached to that reservation.
#[utoipa::path(
    delete,
    path = "/api/reservations/{date}",
    tag = "reservations",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("date" = String, Path, description = "Reservation date in YYYY-MM-DD format"),
        ("time" = Option<String>, Query, description = "Reserved dinner time to free in HH:MM format")
    ),
    responses(
        (status = 200, description = "Reservation released", body = DeleteReservationResponse),
        (status = 400, description = "Missing time", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Reservation not found", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn delete_reservation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(date): Path<String>,
    Query(params): Query<DeleteReservationParams>,
) -> std::result::Result<Json<DeleteReservationResponse>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let time = params
        .time
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::bad_request("Reservation time is required"))?
        .to_string();

    let removed = delete_reservation_by_slot(&state.db, &date, &time)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to free reserved slot");
            ApiError::internal("Unable to free slot")
        })?
        .ok_or_else(|| ApiError::not_found("Reserved slot was not found"))?;

    let cancellation_email_sent = send_cancellation_email(&state, &removed).await?;

    Ok(Json(DeleteReservationResponse {
        reservation: removed,
        cancellation_email_sent,
    }))
}

/// Returns the list of dates currently open for reservations.
#[utoipa::path(
    get,
    path = "/api/availability",
    tag = "reservations",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Availability list", body = [AvailabilityDate]),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn get_available_dates(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> std::result::Result<Json<Vec<AvailabilityDate>>, ApiError> {
    require_role(&state, &headers, AccessRole::Guest).await?;
    let availability = fetch_available_dates(&state.db).await.map_err(|error| {
        tracing::error!(?error, "Failed to load availability");
        ApiError::internal("Unable to load availability")
    })?;
    Ok(Json(availability))
}

/// Opens a date for reservations and requires staff access.
#[utoipa::path(
    post,
    path = "/api/availability",
    tag = "reservations",
    security(
        ("bearer_auth" = [])
    ),
    request_body = AvailabilityDate,
    responses(
        (status = 200, description = "Dinner slot opened", body = AvailabilityDate),
        (status = 400, description = "Missing date or dinner time", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn create_available_date(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(availability): Json<AvailabilityDate>,
) -> std::result::Result<Json<AvailabilityDate>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    if availability.date.trim().is_empty() {
        return Err(ApiError::bad_request("Date is required"));
    }
    if availability
        .dinner_time
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        return Err(ApiError::bad_request("Dinner time is required"));
    }
    let saved = insert_available_date(&state.db, availability).await.map_err(|error| {
        tracing::error!(?error, "Failed to open dinner slot");
        ApiError::internal("Unable to open date")
    })?;
    Ok(Json(saved))
}

/// Closes a single dinner slot for a date and requires staff access.
#[utoipa::path(
    delete,
    path = "/api/availability/{date}",
    tag = "reservations",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("date" = String, Path, description = "Reservation date in YYYY-MM-DD format"),
        ("dinner_time" = Option<String>, Query, description = "Dinner time to delete in HH:MM format")
    ),
    responses(
        (status = 200, description = "Dinner slot removed", body = DeleteAvailabilityResponse),
        (status = 400, description = "Missing dinner time", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn delete_available_date(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(date): Path<String>,
    Query(params): Query<DeleteAvailabilityParams>,
) -> std::result::Result<Json<DeleteAvailabilityResponse>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let dinner_time = params
        .dinner_time
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::bad_request("Dinner time is required"))?
        .to_string();

    let removed_reservation = delete_reservation_by_slot(&state.db, &date, &dinner_time)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to release reservation while closing dinner slot");
            ApiError::internal("Unable to close date")
        })?;

    let cancellation_email_sent = if let Some(reservation) = removed_reservation.as_ref() {
        send_cancellation_email(&state, reservation).await?
    } else {
        false
    };

    delete_availability_date(&state.db, &date, &dinner_time)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to close dinner slot");
            ApiError::internal("Unable to close date")
        })?;
    Ok(Json(DeleteAvailabilityResponse {
        availability: AvailabilityDate {
            date,
            dinner_time: Some(dinner_time),
        },
        removed_reservation,
        cancellation_email_sent,
    }))
}

/// Returns all guest access codes and requires staff access.
#[utoipa::path(
    get,
    path = "/api/access-codes",
    tag = "access-codes",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Guest access codes", body = [AccessCodeRecord]),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn get_access_codes(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> std::result::Result<Json<Vec<AccessCodeRecord>>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let access_codes = fetch_guest_access_codes(&state.db).await.map_err(|error| {
        tracing::error!(?error, "Failed to load guest access codes");
        ApiError::internal("Unable to load access codes")
    })?;
    Ok(Json(access_codes))
}

/// Creates one guest access code and requires staff access.
#[utoipa::path(
    post,
    path = "/api/access-codes",
    tag = "access-codes",
    security(
        ("bearer_auth" = [])
    ),
    request_body = CreateAccessCodeRequest,
    responses(
        (status = 200, description = "Guest access code created or updated", body = AccessCodeRecord),
        (status = 400, description = "Invalid payload", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn create_access_code(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateAccessCodeRequest>,
) -> std::result::Result<Json<AccessCodeRecord>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let code = payload.code.trim();
    if code.is_empty() {
        return Err(ApiError::bad_request("Access code is required"));
    }

    let expires_at = payload
        .expires_at
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(parse_expiration_timestamp)
        .transpose()
        .map_err(|error| ApiError::bad_request(&error))?;

    upsert_access_code(
        &state.db,
        &AccessCodeSeed {
            role: GUEST_ROLE.to_string(),
            code: code.to_string(),
            expires_at,
        },
    )
    .await
    .map_err(|error| {
        tracing::error!(?error, "Failed to save guest access code");
        ApiError::internal("Unable to save access code")
    })?;
    let saved = fetch_access_code(&state.db, code)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to load saved access code");
            ApiError::internal("Unable to load saved access code")
        })?
        .ok_or_else(|| ApiError::internal("Saved access code was not found"))?;
    Ok(Json(saved))
}

/// Removes one guest access code and requires staff access.
#[utoipa::path(
    delete,
    path = "/api/access-codes/{code}",
    tag = "access-codes",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("code" = String, Path, description = "Guest access code value")
    ),
    responses(
        (status = 200, description = "Guest access code removed", body = AccessCodeRecord),
        (status = 400, description = "Invalid or unknown code", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn delete_access_code(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> std::result::Result<Json<AccessCodeRecord>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let trimmed_code = code.trim();
    if trimmed_code.is_empty() {
        return Err(ApiError::bad_request("Access code is required"));
    }

    let removed = fetch_access_code(&state.db, trimmed_code)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to load guest access code before deletion");
            ApiError::internal("Unable to load access code")
        })?
        .ok_or_else(|| ApiError::bad_request("Access code was not found"))?;
    delete_guest_access_code(&state.db, trimmed_code)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to delete guest access code");
            ApiError::internal("Unable to delete access code")
        })?;
    Ok(Json(removed))
}

/// Verifies the bearer token on a request and enforces the required access role.
async fn require_role(
    state: &AppState,
    headers: &HeaderMap,
    required_role: AccessRole,
) -> std::result::Result<AccessRole, ApiError> {
    // Every protected handler comes through here so frontend-only checks cannot bypass auth.
    let token = bearer_token(headers).ok_or_else(|| ApiError::unauthorized("Missing API token"))?;
    let role = find_role_for_token(&state.db, token).await.map_err(|error| {
        tracing::error!(?error, "Failed to validate API token");
        ApiError::internal("Unable to validate API token")
    })?;
    let role = role.ok_or_else(|| ApiError::unauthorized("Invalid API token"))?;
    let role = AccessRole::try_from(role.as_str())?;

    if !role.allows(required_role) {
        return Err(ApiError::forbidden("You do not have permission for this request"));
    }

    Ok(role)
}

/// Extracts the bearer token from the Authorization header.
fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let value = headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?;
    value.strip_prefix("Bearer ")
}
