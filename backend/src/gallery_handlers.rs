use axum::{
    extract::{Multipart, Path, State},
    http::HeaderMap,
    Json,
};
use aws_sdk_s3::primitives::ByteStream;

use crate::db::{
    delete_gallery_event, delete_gallery_image, fetch_gallery_event_detail,
    fetch_gallery_event_summaries, fetch_gallery_images_for_event, insert_gallery_event,
    insert_gallery_image, update_gallery_event, update_gallery_image,
};
use crate::error::{ApiError, ErrorResponse};
use crate::handlers::require_role;
use crate::models::{
    AccessRole, CreateGalleryEventRequest, CreateGalleryImageRequest, DeleteGalleryEventResponse,
    DeleteGalleryImageResponse, GalleryEventDetail, GalleryEventSummary, GalleryImageRecord,
    UpdateGalleryEventRequest, UpdateGalleryImageRequest,
};
use crate::state::AppState;

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

/// Creates a gallery event and requires staff access.
#[utoipa::path(
    post,
    path = "/api/gallery",
    tag = "gallery",
    security(("bearer_auth" = [])),
    request_body = CreateGalleryEventRequest,
    responses(
        (status = 200, description = "Gallery event created", body = GalleryEventSummary),
        (status = 400, description = "Invalid payload or duplicate slug", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn create_gallery_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateGalleryEventRequest>,
) -> std::result::Result<Json<GalleryEventSummary>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    if payload.slug.trim().is_empty() {
        return Err(ApiError::bad_request("Slug is required"));
    }
    if payload.title.trim().is_empty() {
        return Err(ApiError::bad_request("Title is required"));
    }

    let event = insert_gallery_event(&state.db, &payload).await.map_err(|error| {
        if let Some(db_err) = error.as_database_error() {
            if db_err.code().as_deref() == Some("23505") {
                return ApiError::bad_request("A gallery event with that slug already exists");
            }
        }
        tracing::error!(?error, "Failed to create gallery event");
        ApiError::internal("Unable to create gallery event")
    })?;
    Ok(Json(event))
}

/// Deletes a gallery event (and its images) and requires staff access.
#[utoipa::path(
    delete,
    path = "/api/gallery/{slug}",
    tag = "gallery",
    security(("bearer_auth" = [])),
    params(("slug" = String, Path, description = "Gallery event slug")),
    responses(
        (status = 200, description = "Gallery event deleted", body = DeleteGalleryEventResponse),
        (status = 404, description = "Gallery event not found", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn delete_gallery_event_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> std::result::Result<Json<DeleteGalleryEventResponse>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let removed = delete_gallery_event(&state.db, slug.trim())
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to delete gallery event");
            ApiError::internal("Unable to delete gallery event")
        })?
        .ok_or_else(|| ApiError::not_found("Gallery event was not found"))?;
    Ok(Json(removed))
}

/// Updates editable metadata on a gallery event and requires staff access.
pub(crate) async fn update_gallery_event_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
    Json(payload): Json<UpdateGalleryEventRequest>,
) -> std::result::Result<Json<GalleryEventSummary>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let updated = update_gallery_event(&state.db, slug.trim(), &payload)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to update gallery event");
            ApiError::internal("Unable to update gallery event")
        })?
        .ok_or_else(|| ApiError::not_found("Gallery event was not found"))?;
    Ok(Json(updated))
}

/// Returns all image records for one event with real DB ids — requires staff access.
pub(crate) async fn list_gallery_images(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> std::result::Result<Json<Vec<GalleryImageRecord>>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let images = fetch_gallery_images_for_event(&state.db, slug.trim())
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to load gallery images");
            ApiError::internal("Unable to load gallery images")
        })?;
    Ok(Json(images))
}

/// Uploads a file into the event's folder in object storage and requires staff access.
pub(crate) async fn upload_gallery_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
    mut multipart: Multipart,
) -> std::result::Result<Json<serde_json::Value>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;

    let storage = state
        .storage
        .as_ref()
        .ok_or_else(|| ApiError::internal("Storage is not configured"))?;

    while let Some(field) = multipart.next_field().await.map_err(|error| {
        tracing::error!(?error, "Multipart read error");
        ApiError::bad_request("Invalid file upload")
    })? {
        if field.name() != Some("file") {
            continue;
        }

        let filename = field.file_name().unwrap_or("upload.jpg").to_string();
        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();
        let key = format!("{}/{}", slug.trim(), &filename);

        let data = field.bytes().await.map_err(|error| {
            tracing::error!(?error, "Failed to read uploaded bytes");
            ApiError::internal("Failed to read uploaded file")
        })?;

        storage
            .client
            .put_object()
            .bucket(&storage.bucket)
            .key(&key)
            .body(ByteStream::from(data))
            .content_type(content_type)
            .send()
            .await
            .map_err(|error| {
                tracing::error!(?error, "Failed to upload file to storage");
                ApiError::internal("Failed to store file")
            })?;

        return Ok(Json(serde_json::json!({ "filename": filename })));
    }

    Err(ApiError::bad_request("No file field found in request"))
}

/// Adds an image to a gallery event and requires staff access.
#[utoipa::path(
    post,
    path = "/api/gallery/{slug}/images",
    tag = "gallery",
    security(("bearer_auth" = [])),
    params(("slug" = String, Path, description = "Gallery event slug")),
    request_body = CreateGalleryImageRequest,
    responses(
        (status = 200, description = "Gallery image added", body = GalleryImageRecord),
        (status = 400, description = "Invalid payload", body = ErrorResponse),
        (status = 404, description = "Gallery event not found", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn create_gallery_image(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
    Json(payload): Json<CreateGalleryImageRequest>,
) -> std::result::Result<Json<GalleryImageRecord>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    if payload.image_url.trim().is_empty() {
        return Err(ApiError::bad_request("Image URL is required"));
    }
    if payload.alt_text.trim().is_empty() {
        return Err(ApiError::bad_request("Alt text is required"));
    }

    let image = insert_gallery_image(&state.db, slug.trim(), &payload)
        .await
        .map_err(|error| {
            if let Some(db_err) = error.as_database_error() {
                if db_err.code().as_deref() == Some("23503") {
                    return ApiError::not_found("Gallery event was not found");
                }
            }
            tracing::error!(?error, "Failed to add gallery image");
            ApiError::internal("Unable to add gallery image")
        })?;
    Ok(Json(image))
}

/// Updates sort_order and/or is_preview on one gallery image — requires staff access.
pub(crate) async fn update_gallery_image_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((slug, id)): Path<(String, i64)>,
    Json(payload): Json<UpdateGalleryImageRequest>,
) -> std::result::Result<Json<GalleryImageRecord>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let updated = update_gallery_image(&state.db, slug.trim(), id, &payload)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to update gallery image");
            ApiError::internal("Unable to update gallery image")
        })?
        .ok_or_else(|| ApiError::not_found("Gallery image was not found"))?;
    Ok(Json(updated))
}

/// Deletes one gallery image and requires staff access.
#[utoipa::path(
    delete,
    path = "/api/gallery/{slug}/images/{id}",
    tag = "gallery",
    security(("bearer_auth" = [])),
    params(
        ("slug" = String, Path, description = "Gallery event slug"),
        ("id" = i64, Path, description = "Gallery image id")
    ),
    responses(
        (status = 200, description = "Gallery image deleted", body = DeleteGalleryImageResponse),
        (status = 404, description = "Gallery image not found", body = ErrorResponse),
        (status = 401, description = "Missing or invalid token", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 500, description = "Backend error", body = ErrorResponse)
    )
)]
pub(crate) async fn delete_gallery_image_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((slug, id)): Path<(String, i64)>,
) -> std::result::Result<Json<DeleteGalleryImageResponse>, ApiError> {
    require_role(&state, &headers, AccessRole::Staff).await?;
    let removed = delete_gallery_image(&state.db, slug.trim(), id)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Failed to delete gallery image");
            ApiError::internal("Unable to delete gallery image")
        })?
        .ok_or_else(|| ApiError::not_found("Gallery image was not found"))?;
    Ok(Json(removed))
}
