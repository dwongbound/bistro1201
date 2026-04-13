use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use chrono::Utc;

use crate::db::{
    count_waitlist, current_timestamp, delete_waitlist_entry, fetch_waitlist_entry,
    fetch_waitlist_page, insert_waitlist_entry, reorder_waitlist_entries, upsert_access_code,
    update_waitlist_contacted_code, update_waitlist_note,
};
use crate::email::send_waitlist_contact_email;
use crate::error::{ApiError, ErrorResponse};
use crate::handlers::{require_role, require_service_key};
use crate::models::{
    AccessCodeSeed, AccessRole, ContactWaitlistEntryRequest, ContactWaitlistEntryResponse,
    CreateWaitlistEntryRequest, ReorderWaitlistRequest, UpdateWaitlistNoteRequest, WaitlistEntry,
    WaitlistPageParams, WaitlistPageResponse, GUEST_ROLE,
};
use crate::state::AppState;

/// Returns a page of waitlist entries to staff.
#[utoipa::path(
    get,
    path = "/api/waitlist",
    tag = "waitlist",
    security(("bearer_auth" = [])),
    params(
        ("offset" = Option<i64>, Query, description = "Zero-based entry offset"),
        ("limit" = Option<i64>, Query, description = "Number of entries to return (max 50)")
    ),
    responses(
        (status = 200, description = "Waitlist page", body = WaitlistPageResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn get_waitlist(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<WaitlistPageParams>,
) -> std::result::Result<Json<WaitlistPageResponse>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let offset = params.offset.unwrap_or(0).max(0);
    let limit = params.limit.unwrap_or(50).clamp(1, 50);

    let (entries, total) = tokio::try_join!(
        fetch_waitlist_page(&state.db, offset, limit),
        count_waitlist(&state.db),
    )
    .map_err(|error| {
        tracing::error!(?error, "Failed to load waitlist");
        ApiError::internal("Unable to load waitlist")
    })?;

    Ok(Json(WaitlistPageResponse { entries, total }))
}

/// Adds a visitor to the public waitlist (no authentication required).
#[utoipa::path(
    post,
    path = "/api/waitlist",
    tag = "waitlist",
    request_body = CreateWaitlistEntryRequest,
    responses(
        (status = 200, description = "Waitlist entry created", body = WaitlistEntry),
        (status = 400, description = "Invalid payload", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn create_waitlist_entry(
    State(state): State<AppState>,
    Json(payload): Json<CreateWaitlistEntryRequest>,
) -> std::result::Result<Json<WaitlistEntry>, ApiError> {
    if payload.first_name.trim().is_empty() {
        return Err(ApiError::bad_request("First name is required"));
    }
    if payload.last_name.trim().is_empty() {
        return Err(ApiError::bad_request("Last name is required"));
    }
    if payload.email.trim().is_empty() {
        return Err(ApiError::bad_request("Email is required"));
    }
    if payload.phone.trim().is_empty() {
        return Err(ApiError::bad_request("Phone number is required"));
    }

    let entry = insert_waitlist_entry(&state.db, &payload).await.map_err(|error| {
        tracing::error!(?error, "Failed to save waitlist entry");
        ApiError::internal("Unable to save waitlist entry")
    })?;

    Ok(Json(entry))
}

/// Removes one waitlist entry and requires staff access.
#[utoipa::path(
    delete,
    path = "/api/waitlist/{id}",
    tag = "waitlist",
    security(("bearer_auth" = [])),
    params(("id" = i64, Path, description = "Waitlist entry id")),
    responses(
        (status = 200, description = "Waitlist entry removed", body = WaitlistEntry),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Entry not found", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn delete_waitlist_entry_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> std::result::Result<Json<WaitlistEntry>, ApiError> {
    require_service_key(&state, &headers)?;
    require_role(&state, &headers, AccessRole::Staff).await?;

    let removed = delete_waitlist_entry(&state.db, id)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to delete waitlist entry");
            ApiError::internal("Unable to delete waitlist entry")
        })?
        .ok_or_else(|| ApiError::not_found("Waitlist entry was not found"))?;

    Ok(Json(removed))
}

/// Sends a temporary access code to a waitlist member and requires staff access.
#[utoipa::path(
    post,
    path = "/api/waitlist/{id}/contact",
    tag = "waitlist",
    security(("bearer_auth" = [])),
    params(("id" = i64, Path, description = "Waitlist entry id")),
    responses(
        (status = 200, description = "Contact email sent and code created", body = ContactWaitlistEntryResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Entry not found", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn contact_waitlist_entry_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    payload: Option<Json<ContactWaitlistEntryRequest>>,
) -> std::result::Result<Json<ContactWaitlistEntryResponse>, ApiError> {
    require_service_key(&state, &headers)?;
    require_role(&state, &headers, AccessRole::Staff).await?;

    let entry = fetch_waitlist_entry(&state.db, id)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to load waitlist entry for contact");
            ApiError::internal("Unable to load waitlist entry")
        })?
        .ok_or_else(|| ApiError::not_found("Waitlist entry was not found"))?;

    let code = payload
        .as_ref()
        .and_then(|Json(body)| body.code.as_deref())
        .map(str::trim)
        .filter(|code| !code.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| generate_waitlist_code(&entry.first_name, &entry.last_name, entry.id));
    // Expires 3 days from now.
    let expires_at = current_timestamp() as i64 + 3 * 24 * 60 * 60;

    upsert_access_code(
        &state.db,
        &AccessCodeSeed {
            role: GUEST_ROLE.to_string(),
            code: code.clone(),
            expires_at: Some(expires_at),
        },
    )
    .await
    .map_err(|error| {
        tracing::error!(?error, "Failed to create waitlist guest code");
        ApiError::internal("Unable to create guest access code")
    })?;

    let updated_entry = update_waitlist_contacted_code(&state.db, id, &code)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to record contacted code on waitlist entry");
            ApiError::internal("Unable to update waitlist entry")
        })?
        .ok_or_else(|| ApiError::not_found("Waitlist entry was not found after update"))?;

    let email_sent = send_waitlist_contact_email(&state, &updated_entry, &code, expires_at)
        .await
        .unwrap_or_else(|error| {
            tracing::error!(?error, "Failed to send waitlist contact email");
            false
        });

    Ok(Json(ContactWaitlistEntryResponse {
        entry: updated_entry,
        code,
        expires_at,
        email_sent,
    }))
}

/// Updates the staff-only note on a waitlist entry and requires staff access.
#[utoipa::path(
    patch,
    path = "/api/waitlist/{id}/note",
    tag = "waitlist",
    security(("bearer_auth" = [])),
    params(("id" = i64, Path, description = "Waitlist entry id")),
    request_body = UpdateWaitlistNoteRequest,
    responses(
        (status = 200, description = "Note updated", body = WaitlistEntry),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Entry not found", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn update_waitlist_note_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateWaitlistNoteRequest>,
) -> std::result::Result<Json<WaitlistEntry>, ApiError> {
    require_service_key(&state, &headers)?;
    require_role(&state, &headers, AccessRole::Staff).await?;

    let trimmed_note = payload.staff_note.trim();
    if trimmed_note.is_empty() {
        return Err(ApiError::bad_request("Note is required"));
    }

    let next_history_entry = format_waitlist_staff_note_entry(trimmed_note);

    let updated = update_waitlist_note(&state.db, id, &next_history_entry)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to update waitlist note");
            ApiError::internal("Unable to update waitlist note")
        })?
        .ok_or_else(|| ApiError::not_found("Waitlist entry was not found"))?;

    Ok(Json(updated))
}

/// Reorders waitlist entries by applying a new sort_order to each id in the supplied list.
#[utoipa::path(
    patch,
    path = "/api/waitlist/reorder",
    tag = "waitlist",
    security(("bearer_auth" = [])),
    request_body = ReorderWaitlistRequest,
    responses(
        (status = 200, description = "Waitlist reordered"),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn reorder_waitlist_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ReorderWaitlistRequest>,
) -> std::result::Result<Json<()>, ApiError> {
    require_service_key(&state, &headers)?;
    require_role(&state, &headers, AccessRole::Staff).await?;

    reorder_waitlist_entries(&state.db, &payload.order)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to reorder waitlist");
            ApiError::internal("Unable to reorder waitlist")
        })?;

    Ok(Json(()))
}

/// Derives a guest access code from the entry's name and id for uniqueness.
fn generate_waitlist_code(first_name: &str, last_name: &str, id: i64) -> String {
    let sanitize = |s: &str| {
        s.to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect::<String>()
    };
    format!("{}_{}{:x}", sanitize(first_name), sanitize(last_name), id)
}

fn format_waitlist_staff_note_entry(note: &str) -> String {
    let timestamp = Utc::now().to_rfc3339();
    format!("{note} - {timestamp}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::ensure_schema;
    use crate::models::CreateWaitlistEntryRequest;

    fn sample_request(suffix: &str) -> CreateWaitlistEntryRequest {
        CreateWaitlistEntryRequest {
            first_name: format!("Jane{suffix}"),
            last_name: "Doe".to_string(),
            email: format!("jane{suffix}@example.com"),
            phone: "555-0100".to_string(),
            notes: Some("Allergic to nuts".to_string()),
        }
    }

    #[test]
    fn test_generate_waitlist_code_basic() {
        let code = generate_waitlist_code("Jane", "Doe", 1);
        assert_eq!(code, "jane_doe1");
    }

    #[test]
    fn test_generate_waitlist_code_spaces_become_underscores() {
        let code = generate_waitlist_code("Mary Jane", "O'Brien", 42);
        assert_eq!(code, "mary_jane_o_brien2a");
    }

    #[test]
    fn test_format_waitlist_staff_note_entry_appends_timestamp() {
        let formatted = format_waitlist_staff_note_entry("VIP guest");
        assert!(formatted.starts_with("VIP guest - "));
        assert!(formatted.len() > "VIP guest - ".len());
    }

    #[sqlx::test]
    async fn test_insert_and_fetch_waitlist_entry(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        let req = sample_request("");
        let entry = insert_waitlist_entry(&pool, &req).await.unwrap();
        assert_eq!(entry.first_name, "Jane");
        assert_eq!(entry.last_name, "Doe");
        assert_eq!(entry.email, "jane@example.com");
        assert_eq!(entry.phone, "555-0100");
        assert_eq!(entry.notes, "Allergic to nuts");
        assert_eq!(entry.staff_note, "");
        assert!(entry.contacted_code.is_none());
    }

    #[sqlx::test]
    async fn test_fetch_waitlist_page_returns_entries_in_order(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        insert_waitlist_entry(&pool, &sample_request("_a")).await.unwrap();
        insert_waitlist_entry(&pool, &sample_request("_b")).await.unwrap();
        let page = fetch_waitlist_page(&pool, 0, 50).await.unwrap();
        assert_eq!(page.len(), 2);
    }

    #[sqlx::test]
    async fn test_count_waitlist(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        assert_eq!(count_waitlist(&pool).await.unwrap(), 0);
        insert_waitlist_entry(&pool, &sample_request("")).await.unwrap();
        assert_eq!(count_waitlist(&pool).await.unwrap(), 1);
    }

    #[sqlx::test]
    async fn test_delete_waitlist_entry(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        let entry = insert_waitlist_entry(&pool, &sample_request("")).await.unwrap();
        let removed = delete_waitlist_entry(&pool, entry.id).await.unwrap();
        assert!(removed.is_some());
        assert_eq!(count_waitlist(&pool).await.unwrap(), 0);
    }

    #[sqlx::test]
    async fn test_update_waitlist_note(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        let entry = insert_waitlist_entry(&pool, &sample_request("")).await.unwrap();
        let updated = update_waitlist_note(&pool, entry.id, "VIP guest").await.unwrap().unwrap();
        assert_eq!(updated.staff_note, "VIP guest");
    }

    #[sqlx::test]
    async fn test_update_waitlist_contacted_code(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        let entry = insert_waitlist_entry(&pool, &sample_request("")).await.unwrap();
        let updated = update_waitlist_contacted_code(&pool, entry.id, "jane_doe1")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(updated.contacted_code.as_deref(), Some("jane_doe1"));
    }

    #[sqlx::test]
    async fn test_reorder_waitlist_entries(pool: sqlx::PgPool) {
        ensure_schema(&pool).await.unwrap();
        let a = insert_waitlist_entry(&pool, &sample_request("_a")).await.unwrap();
        let b = insert_waitlist_entry(&pool, &sample_request("_b")).await.unwrap();
        // Reverse the order.
        reorder_waitlist_entries(&pool, &[b.id, a.id]).await.unwrap();
        let page = fetch_waitlist_page(&pool, 0, 50).await.unwrap();
        assert_eq!(page[0].id, b.id);
        assert_eq!(page[1].id, a.id);
    }
}
