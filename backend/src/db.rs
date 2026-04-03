use crate::models::{
    AccessCodeLookup, AccessCodeRecord, AccessCodeSeed, AvailabilityDate, CreateGalleryEventRequest,
    CreateGalleryImageRequest, DeleteGalleryEventResponse, DeleteGalleryImageResponse, GalleryEventDetail,
    GalleryEventSummary, GalleryImage, GalleryImageRecord, Reservation, UpdateGalleryEventRequest,
    UpdateGalleryImageRequest, GUEST_ROLE, STAFF_ROLE,
};
use chrono::DateTime;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Result, Row};
use std::env;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(sqlx::FromRow)]
struct GalleryEventRow {
    slug: String,
    title: String,
    date_label: String,
    summary: String,
    event_type: String,
    cover_image_url: String,
}

#[derive(sqlx::FromRow)]
struct GalleryImageRow {
    event_slug: String,
    image_url: String,
    alt_text: String,
    is_preview: bool,
}

/// Extra counter mixed into generated session tokens so two calls in the same second still differ.
static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Opens the shared Postgres pool and makes sure the schema exists before requests arrive.
pub(crate) async fn init_db(database_url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    ensure_schema(&pool).await?;
    let removed_orphaned_reservations = prune_orphaned_reservations(&pool).await?;
    if removed_orphaned_reservations > 0 {
        tracing::warn!(
            removed_orphaned_reservations,
            "Removed orphaned reservations that no longer had matching availability"
        );
    }

    Ok(pool)
}

/// Creates the tables the app expects if this database starts empty.
pub(crate) async fn ensure_schema(pool: &PgPool) -> Result<()> {
    // Keeping schema creation here is a lightweight alternative to a migrations crate for now.
    // The app still starts with a known schema, and the SQL stays easy to inspect in one place.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS reservations (
            id BIGSERIAL PRIMARY KEY,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS available_dates (
            date TEXT NOT NULL,
            dinner_time TEXT NOT NULL,
            PRIMARY KEY (date, dinner_time)
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS access_codes (
            code TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            expires_at BIGINT,
            created_at BIGINT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS api_sessions (
            token TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            created_at BIGINT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS gallery_events (
            slug TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            date_label TEXT NOT NULL,
            summary TEXT NOT NULL,
            event_type TEXT NOT NULL DEFAULT 'Event',
            cover_image_url TEXT NOT NULL,
            sort_order BIGINT NOT NULL DEFAULT 0,
            created_at BIGINT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "ALTER TABLE gallery_events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'Event'",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS gallery_images (
            id BIGSERIAL PRIMARY KEY,
            event_slug TEXT NOT NULL REFERENCES gallery_events(slug) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            alt_text TEXT NOT NULL,
            sort_order BIGINT NOT NULL DEFAULT 0,
            is_preview BOOLEAN NOT NULL DEFAULT FALSE
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Removes reservations whose slot is no longer present in availability.
pub(crate) async fn prune_orphaned_reservations(pool: &PgPool) -> Result<u64> {
    let result = sqlx::query(
        "DELETE FROM reservations r
         WHERE NOT EXISTS (
           SELECT 1
           FROM available_dates a
           WHERE a.date = r.date
             AND a.dinner_time = r.time
         )",
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Loads all reservations in the same order shown on the frontend.
pub(crate) async fn fetch_reservations(pool: &PgPool) -> Result<Vec<Reservation>> {
    sqlx::query_as::<_, Reservation>(
        "SELECT id, date, time, name, email
         FROM reservations
         ORDER BY date, time, id",
    )
    .fetch_all(pool)
    .await
}

/// Persists a reservation row and returns the saved record with its generated id.
pub(crate) async fn insert_reservation(pool: &PgPool, res: Reservation) -> Result<Reservation> {
    // `RETURNING` is a handy Postgres feature: the insert and id lookup happen in one round-trip.
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO reservations (date, time, name, email)
         VALUES ($1, $2, $3, $4)
         RETURNING id",
    )
    .bind(&res.date)
    .bind(&res.time)
    .bind(&res.name)
    .bind(res.email.as_deref())
    .fetch_one(pool)
    .await?;

    Ok(Reservation { id: Some(id), ..res })
}

/// Loads all currently available reservation dates.
pub(crate) async fn fetch_available_dates(pool: &PgPool) -> Result<Vec<AvailabilityDate>> {
    sqlx::query_as::<_, AvailabilityDate>(
        "SELECT date, dinner_time
         FROM available_dates
         WHERE dinner_time IS NOT NULL AND btrim(dinner_time) <> ''
         ORDER BY date, dinner_time",
    )
    .fetch_all(pool)
    .await
}

/// Loads the Gallery index data from Postgres so staff can update content without a frontend redeploy.
pub(crate) async fn fetch_gallery_event_summaries(pool: &PgPool) -> Result<Vec<GalleryEventSummary>> {
    let event_rows = sqlx::query_as::<_, GalleryEventRow>(
        "SELECT slug, title, date_label, summary, event_type, cover_image_url
         FROM gallery_events
         WHERE slug != 'home'
         ORDER BY sort_order, created_at DESC, slug",
    )
    .fetch_all(pool)
    .await?;

    if event_rows.is_empty() {
        return Ok(Vec::new());
    }

    let image_rows = sqlx::query_as::<_, GalleryImageRow>(
        "SELECT event_slug, image_url, alt_text, is_preview
         FROM gallery_images
         WHERE is_preview = TRUE
         ORDER BY event_slug, sort_order, id",
    )
    .fetch_all(pool)
    .await?;

    Ok(build_gallery_summaries(event_rows, image_rows))
}

/// Loads one full gallery event and all of its ordered images.
pub(crate) async fn fetch_gallery_event_detail(pool: &PgPool, slug: &str) -> Result<Option<GalleryEventDetail>> {
    let event_row = sqlx::query_as::<_, GalleryEventRow>(
        "SELECT slug, title, date_label, summary, event_type, cover_image_url
         FROM gallery_events
         WHERE slug = $1
         LIMIT 1",
    )
    .bind(slug)
    .fetch_optional(pool)
    .await?;

    let Some(event_row) = event_row else {
        return Ok(None);
    };

    let image_rows = sqlx::query_as::<_, GalleryImageRow>(
        "SELECT event_slug, image_url, alt_text, is_preview
         FROM gallery_images
         WHERE event_slug = $1
         ORDER BY sort_order, id",
    )
    .bind(slug)
    .fetch_all(pool)
    .await?;

    let preview_images = image_rows
        .iter()
        .filter(|image| image.is_preview)
        .map(|image| GalleryImage {
            src: image.image_url.clone(),
            alt: image.alt_text.clone(),
        })
        .collect::<Vec<_>>();
    let gallery_images = image_rows
        .iter()
        .filter(|image| !image.is_preview)
        .map(|image| GalleryImage {
            src: image.image_url.clone(),
            alt: image.alt_text.clone(),
        })
        .collect::<Vec<_>>();

    Ok(Some(GalleryEventDetail {
        slug: event_row.slug,
        title: event_row.title,
        date_label: event_row.date_label,
        summary: event_row.summary,
        event_type: event_row.event_type,
        cover_image: event_row.cover_image_url,
        preview_images,
        gallery_images,
    }))
}

/// Inserts an open date while safely ignoring duplicates.
pub(crate) async fn insert_available_date(pool: &PgPool, availability: AvailabilityDate) -> Result<AvailabilityDate> {
    sqlx::query(
        "INSERT INTO available_dates (date, dinner_time)
         VALUES ($1, $2)
         ON CONFLICT (date, dinner_time) DO NOTHING",
    )
    .bind(&availability.date)
    .bind(availability.dinner_time.as_deref())
    .execute(pool)
    .await?;

    Ok(availability)
}

/// Removes one open dinner slot from the availability table.
pub(crate) async fn delete_availability_date(pool: &PgPool, date: &str, dinner_time: &str) -> Result<()> {
    sqlx::query(
        "DELETE FROM available_dates
         WHERE date = $1
           AND dinner_time = $2",
    )
    .bind(date)
    .bind(dinner_time)
    .execute(pool)
    .await?;

    Ok(())
}

/// Checks whether a given reservation slot is currently open.
pub(crate) async fn reservation_slot_is_available(pool: &PgPool, date: &str, time: &str) -> Result<bool> {
    let result = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
           SELECT 1
           FROM available_dates
           WHERE date = $1
             AND dinner_time = $2
             AND dinner_time IS NOT NULL
             AND btrim(dinner_time) <> ''
             AND NOT EXISTS (
               SELECT 1
               FROM reservations
               WHERE reservations.date = $1
                 AND reservations.time = $2
             )
         )",
    )
    .bind(date)
    .bind(time)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Deletes the reservation attached to one dinner slot and returns the freed record.
pub(crate) async fn delete_reservation_by_slot(pool: &PgPool, date: &str, time: &str) -> Result<Option<Reservation>> {
    sqlx::query_as::<_, Reservation>(
        "DELETE FROM reservations
         WHERE id = (
           SELECT id
           FROM reservations
           WHERE date = $1
             AND time = $2
           ORDER BY id
           LIMIT 1
         )
         RETURNING id, date, time, name, email",
    )
    .bind(date)
    .bind(time)
    .fetch_optional(pool)
    .await
}

/// Inserts or updates one guest access code, including its optional expiration timestamp.
pub(crate) async fn upsert_access_code(pool: &PgPool, seed: &AccessCodeSeed) -> Result<()> {
    sqlx::query(
        "INSERT INTO access_codes (code, role, expires_at, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
         SET role = EXCLUDED.role,
             expires_at = EXCLUDED.expires_at",
    )
    .bind(&seed.code)
    .bind(&seed.role)
    .bind(seed.expires_at)
    .bind(current_timestamp() as i64)
    .execute(pool)
    .await?;

    Ok(())
}

/// Ensures the env-configured default guest access code exists alongside any staff-managed codes.
pub(crate) async fn ensure_default_guest_access_code(pool: &PgPool, seed: &AccessCodeSeed) -> Result<()> {
    upsert_access_code(pool, seed).await
}

/// Loads all guest access codes in a stable order for staff management.
pub(crate) async fn fetch_guest_access_codes(pool: &PgPool) -> Result<Vec<AccessCodeRecord>> {
    sqlx::query_as::<_, AccessCodeRecord>(
        "SELECT code, role, expires_at, created_at
         FROM access_codes
         WHERE role = $1
         ORDER BY created_at DESC, code",
    )
    .bind(GUEST_ROLE)
    .fetch_all(pool)
    .await
}

/// Loads one guest access code by value.
pub(crate) async fn fetch_access_code(pool: &PgPool, code: &str) -> Result<Option<AccessCodeRecord>> {
    sqlx::query_as::<_, AccessCodeRecord>(
        "SELECT code, role, expires_at, created_at
         FROM access_codes
         WHERE code = $1
           AND role = $2
         LIMIT 1",
    )
    .bind(code)
    .bind(GUEST_ROLE)
    .fetch_optional(pool)
    .await
}

/// Deletes one guest access code without affecting the staff env code.
pub(crate) async fn delete_guest_access_code(pool: &PgPool, code: &str) -> Result<()> {
    sqlx::query(
        "DELETE FROM access_codes
         WHERE code = $1
           AND role = $2",
    )
    .bind(code)
    .bind(GUEST_ROLE)
    .execute(pool)
    .await?;

    Ok(())
}

/// Looks up a guest access code and reports whether it is valid, expired, or unknown.
pub(crate) async fn find_role_for_code(pool: &PgPool, code: &str) -> Result<AccessCodeLookup> {
    let access_code = sqlx::query(
        "SELECT role, expires_at
         FROM access_codes
         WHERE code = $1
           AND role = $2
         LIMIT 1",
    )
    .bind(code)
    .bind(GUEST_ROLE)
    .fetch_optional(pool)
    .await?;

    let Some(row) = access_code else {
        return Ok(AccessCodeLookup::Missing);
    };

    let role: String = row.try_get("role")?;
    let expires_at: Option<i64> = row.try_get("expires_at")?;

    if expires_at.is_some_and(|timestamp| timestamp <= current_timestamp() as i64) {
        return Ok(AccessCodeLookup::Expired);
    }

    Ok(AccessCodeLookup::Valid(role))
}

/// Resolves the staff env code first, then falls back to database-backed guest codes.
pub(crate) async fn resolve_access_code(
    pool: &PgPool,
    submitted_code: &str,
    staff_access_code: &str,
) -> Result<AccessCodeLookup> {
    if submitted_code == staff_access_code {
        return Ok(AccessCodeLookup::Valid(STAFF_ROLE.to_string()));
    }

    find_role_for_code(pool, submitted_code).await
}

/// Creates a new API session token for the given role.
pub(crate) async fn create_session(pool: &PgPool, role: &str) -> Result<String> {
    // Sessions are server-issued so the browser can present a token without shipping the source access code.
    let token = generate_session_token();
    let created_at = current_timestamp() as i64;

    sqlx::query(
        "INSERT INTO api_sessions (token, role, created_at)
         VALUES ($1, $2, $3)",
    )
    .bind(&token)
    .bind(role)
    .bind(created_at)
    .execute(pool)
    .await?;

    Ok(token)
}

/// Resolves the role attached to an active API session token.
pub(crate) async fn find_role_for_token(pool: &PgPool, token: &str) -> Result<Option<String>> {
    sqlx::query_scalar(
        "SELECT role
         FROM api_sessions
         WHERE token = $1
         LIMIT 1",
    )
    .bind(token)
    .fetch_optional(pool)
    .await
}

/// Inserts a new gallery event and returns it.
pub(crate) async fn insert_gallery_event(
    pool: &PgPool,
    req: &CreateGalleryEventRequest,
) -> Result<GalleryEventSummary> {
    let sort_order = req.sort_order.unwrap_or(0);
    let created_at = current_timestamp() as i64;
    let event_type = req.event_type.clone().unwrap_or_else(|| "Event".to_string());
    let cover_image_url = req.cover_image_url.clone().unwrap_or_default();
    sqlx::query(
        "INSERT INTO gallery_events (slug, title, date_label, summary, event_type, cover_image_url, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(&req.slug)
    .bind(&req.title)
    .bind(&req.date_label)
    .bind(&req.summary)
    .bind(&event_type)
    .bind(&cover_image_url)
    .bind(sort_order)
    .bind(created_at)
    .execute(pool)
    .await?;

    Ok(GalleryEventSummary {
        slug: req.slug.clone(),
        title: req.title.clone(),
        date_label: req.date_label.clone(),
        summary: req.summary.clone(),
        event_type,
        cover_image: cover_image_url,
        preview_images: vec![],
    })
}

/// Updates editable fields on an existing gallery event and returns the updated summary.
pub(crate) async fn update_gallery_event(
    pool: &PgPool,
    slug: &str,
    req: &UpdateGalleryEventRequest,
) -> Result<Option<GalleryEventSummary>> {
    let row = sqlx::query_as::<_, GalleryEventRow>(
        "UPDATE gallery_events
         SET title          = COALESCE($2, title),
             date_label     = COALESCE($3, date_label),
             summary        = COALESCE($4, summary),
             event_type     = COALESCE($5, event_type),
             cover_image_url = COALESCE($6, cover_image_url),
             sort_order     = COALESCE($7, sort_order)
         WHERE slug = $1
         RETURNING slug, title, date_label, summary, event_type, cover_image_url",
    )
    .bind(slug)
    .bind(&req.title)
    .bind(&req.date_label)
    .bind(&req.summary)
    .bind(&req.event_type)
    .bind(&req.cover_image_url)
    .bind(req.sort_order)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| GalleryEventSummary {
        slug: r.slug,
        title: r.title,
        date_label: r.date_label,
        summary: r.summary,
        event_type: r.event_type,
        cover_image: r.cover_image_url,
        preview_images: vec![],
    }))
}

/// Deletes a gallery event by slug and returns the slug if it existed.
pub(crate) async fn delete_gallery_event(
    pool: &PgPool,
    slug: &str,
) -> Result<Option<DeleteGalleryEventResponse>> {
    let deleted: Option<String> = sqlx::query_scalar(
        "DELETE FROM gallery_events WHERE slug = $1 RETURNING slug",
    )
    .bind(slug)
    .fetch_optional(pool)
    .await?;

    Ok(deleted.map(|s| DeleteGalleryEventResponse { slug: s }))
}

/// Inserts an image into a gallery event and returns the full record.
pub(crate) async fn insert_gallery_image(
    pool: &PgPool,
    event_slug: &str,
    req: &CreateGalleryImageRequest,
) -> Result<GalleryImageRecord> {
    let sort_order = req.sort_order.unwrap_or(0);
    let is_preview = req.is_preview.unwrap_or(false);
    sqlx::query_as::<_, GalleryImageRecord>(
        "INSERT INTO gallery_images (event_slug, image_url, alt_text, sort_order, is_preview)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, event_slug, image_url, alt_text, sort_order, is_preview",
    )
    .bind(event_slug)
    .bind(&req.image_url)
    .bind(&req.alt_text)
    .bind(sort_order)
    .bind(is_preview)
    .fetch_one(pool)
    .await
}

/// Returns all image records for one event with their real database ids (used by the staff admin).
pub(crate) async fn fetch_gallery_images_for_event(
    pool: &PgPool,
    event_slug: &str,
) -> Result<Vec<GalleryImageRecord>> {
    sqlx::query_as::<_, GalleryImageRecord>(
        "SELECT id, event_slug, image_url, alt_text, sort_order, is_preview
         FROM gallery_images
         WHERE event_slug = $1
         ORDER BY sort_order, id",
    )
    .bind(event_slug)
    .fetch_all(pool)
    .await
}

/// Updates sort_order and/or is_preview on one gallery image, returns the updated record.
pub(crate) async fn update_gallery_image(
    pool: &PgPool,
    event_slug: &str,
    image_id: i64,
    req: &UpdateGalleryImageRequest,
) -> Result<Option<GalleryImageRecord>> {
    sqlx::query_as::<_, GalleryImageRecord>(
        "UPDATE gallery_images
         SET sort_order = COALESCE($1, sort_order),
             is_preview = COALESCE($2, is_preview)
         WHERE id = $3 AND event_slug = $4
         RETURNING id, event_slug, image_url, alt_text, sort_order, is_preview",
    )
    .bind(req.sort_order)
    .bind(req.is_preview)
    .bind(image_id)
    .bind(event_slug)
    .fetch_optional(pool)
    .await
}

/// Deletes one gallery image scoped to its parent event and returns its id if it existed.
pub(crate) async fn delete_gallery_image(
    pool: &PgPool,
    event_slug: &str,
    image_id: i64,
) -> Result<Option<DeleteGalleryImageResponse>> {
    let deleted: Option<i64> = sqlx::query_scalar(
        "DELETE FROM gallery_images WHERE id = $1 AND event_slug = $2 RETURNING id",
    )
    .bind(image_id)
    .bind(event_slug)
    .fetch_optional(pool)
    .await?;

    Ok(deleted.map(|id| DeleteGalleryImageResponse { id }))
}

/// Generates a unique-looking session token from the current time and process counter.
pub(crate) fn generate_session_token() -> String {
    let timestamp = current_timestamp();
    let counter = SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("bistro_{timestamp:x}_{counter:x}")
}

/// Returns the current Unix timestamp used for session bookkeeping.
pub(crate) fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Accepts either RFC3339 or raw Unix timestamps for access-code expiration env vars.
pub(crate) fn parse_expiration_timestamp(value: &str) -> std::result::Result<i64, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Expiration timestamp cannot be blank".to_string());
    }

    // Rust's `if let` means "try this pattern, otherwise skip this block".
    if let Ok(timestamp) = trimmed.parse::<i64>() {
        return Ok(timestamp);
    }

    DateTime::parse_from_rfc3339(trimmed)
        .map(|parsed| parsed.timestamp())
        .map_err(|_| format!("Invalid expiration timestamp: {trimmed}"))
}

/// Builds the default guest access-code seed used to bootstrap an empty database.
pub(crate) fn load_default_guest_access_code_from_env() -> std::result::Result<AccessCodeSeed, String> {
    let guest_code = env::var("GUEST_ACCESS_CODE").unwrap_or_else(|_| "bistro1201".to_string());
    let guest_expires_at = env::var("GUEST_ACCESS_CODE_EXPIRES_AT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(|value| parse_expiration_timestamp(&value))
        // `transpose` flips Option<Result<T, E>> into Result<Option<T>, E>.
        .transpose()?;

    Ok(AccessCodeSeed {
        role: GUEST_ROLE.to_string(),
        code: guest_code,
        expires_at: guest_expires_at,
    })
}

fn build_gallery_summaries(event_rows: Vec<GalleryEventRow>, image_rows: Vec<GalleryImageRow>) -> Vec<GalleryEventSummary> {
    event_rows
        .into_iter()
        .map(|event| {
            let preview_images = image_rows
                .iter()
                .filter(|image| image.event_slug == event.slug && image.is_preview)
                .map(|image| GalleryImage {
                    src: image.image_url.clone(),
                    alt: image.alt_text.clone(),
                })
                .collect::<Vec<_>>();

            GalleryEventSummary {
                slug: event.slug,
                title: event.title,
                date_label: event.date_label,
                summary: event.summary,
                event_type: event.event_type,
                cover_image: event.cover_image_url,
                preview_images,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn fresh_pool(pool: PgPool) -> PgPool {
        ensure_schema(&pool)
            .await
            .expect("failed to initialize test database schema");

        sqlx::query(
            "TRUNCATE TABLE reservations, available_dates, access_codes, api_sessions, gallery_images, gallery_events RESTART IDENTITY CASCADE",
        )
            .execute(&pool)
            .await
            .expect("failed to reset test database");

        pool
    }

    #[sqlx::test]
    async fn test_init_db_creates_expected_tables(pool: PgPool) {
        let pool = fresh_pool(pool).await;

        let tables: Vec<String> = sqlx::query_scalar(
            "SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name IN (
                 'reservations',
                 'available_dates',
                 'access_codes',
                 'api_sessions',
                 'gallery_events',
                 'gallery_images'
               )
             ORDER BY table_name",
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(
            tables,
            vec![
                "access_codes",
                "api_sessions",
                "available_dates",
                "gallery_events",
                "gallery_images",
                "reservations",
            ]
        );
    }

    #[sqlx::test]
    async fn test_availability_crud(pool: PgPool) {
        let pool = fresh_pool(pool).await;

        insert_available_date(
            &pool,
            AvailabilityDate {
                date: "2026-12-24".to_string(),
                dinner_time: Some("19:00".to_string()),
            },
        )
        .await
        .unwrap();
        insert_available_date(
            &pool,
            AvailabilityDate {
                date: "2026-12-24".to_string(),
                dinner_time: Some("20:00".to_string()),
            },
        )
        .await
        .unwrap();

        let available_dates = fetch_available_dates(&pool).await.unwrap();
        assert_eq!(available_dates.len(), 2);
        assert_eq!(available_dates[0].date, "2026-12-24");
        assert_eq!(available_dates[0].dinner_time.as_deref(), Some("19:00"));
        assert_eq!(available_dates[1].dinner_time.as_deref(), Some("20:00"));

        delete_availability_date(&pool, "2026-12-24", "19:00")
            .await
            .unwrap();
        let available_dates = fetch_available_dates(&pool).await.unwrap();
        assert_eq!(available_dates.len(), 1);
        assert_eq!(available_dates[0].date, "2026-12-24");
        assert_eq!(available_dates[0].dinner_time.as_deref(), Some("20:00"));

        delete_availability_date(&pool, "2026-12-24", "20:00")
            .await
            .unwrap();
        assert!(fetch_available_dates(&pool).await.unwrap().is_empty());
    }

    #[sqlx::test]
    async fn test_duplicate_availability_insert_is_ignored(pool: PgPool) {
        let pool = fresh_pool(pool).await;

        let availability = AvailabilityDate {
            date: "2026-12-24".to_string(),
            dinner_time: Some("19:00".to_string()),
        };

        insert_available_date(&pool, availability.clone()).await.unwrap();
        insert_available_date(&pool, availability).await.unwrap();

        let available_dates = fetch_available_dates(&pool).await.unwrap();
        assert_eq!(available_dates.len(), 1);
        assert_eq!(available_dates[0].date, "2026-12-24");
        assert_eq!(available_dates[0].dinner_time.as_deref(), Some("19:00"));
    }

    #[sqlx::test]
    async fn test_insert_reservation(pool: PgPool) {
        let pool = fresh_pool(pool).await;
        insert_available_date(
            &pool,
            AvailabilityDate {
                date: "2026-12-25".to_string(),
                dinner_time: Some("19:00".to_string()),
            },
        )
        .await
        .unwrap();

        let saved = insert_reservation(
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

        assert!(saved.id.is_some());
        let reservations = fetch_reservations(&pool).await.unwrap();
        assert_eq!(reservations.len(), 1);
        assert_eq!(reservations[0].name, "Jane Doe");
    }

    #[sqlx::test]
    async fn test_delete_reservation_by_slot(pool: PgPool) {
        let pool = fresh_pool(pool).await;

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

        let removed = delete_reservation_by_slot(&pool, "2026-12-25", "19:00")
            .await
            .unwrap()
            .expect("reservation should be removed");
        assert_eq!(removed.name, "Jane Doe");
        assert_eq!(removed.email.as_deref(), Some("jane@example.com"));

        let reservations = fetch_reservations(&pool).await.unwrap();
        assert!(reservations.is_empty());
        let slot_is_available = reservation_slot_is_available(&pool, "2026-12-25", "19:00")
            .await
            .unwrap();
        assert!(slot_is_available);
    }

    #[sqlx::test]
    async fn test_reserved_slot_is_no_longer_available(pool: PgPool) {
        let pool = fresh_pool(pool).await;
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

        let slot_is_available = reservation_slot_is_available(&pool, "2026-12-25", "19:00")
            .await
            .unwrap();
        assert!(!slot_is_available);
    }

    #[sqlx::test]
    async fn test_prune_orphaned_reservations_removes_rows_without_matching_availability(pool: PgPool) {
        let pool = fresh_pool(pool).await;

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

        insert_reservation(
            &pool,
            Reservation {
                id: None,
                date: "2026-12-26".to_string(),
                time: "19:00".to_string(),
                name: "John Doe".to_string(),
                email: Some("john@example.com".to_string()),
            },
        )
        .await
        .unwrap();

        let removed_count = prune_orphaned_reservations(&pool).await.unwrap();
        assert_eq!(removed_count, 1);

        let remaining = fetch_reservations(&pool).await.unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].date, "2026-12-25");
        assert_eq!(remaining[0].time, "19:00");
    }

    #[sqlx::test]
    async fn test_access_codes_and_sessions(pool: PgPool) {
        let pool = fresh_pool(pool).await;
        ensure_default_guest_access_code(
            &pool,
            &AccessCodeSeed {
                role: GUEST_ROLE.to_string(),
                code: "guest-code".to_string(),
                expires_at: None,
            },
        )
        .await
        .unwrap();

        let guest_role = resolve_access_code(&pool, "guest-code", "staff-constant")
            .await
            .unwrap();
        assert!(matches!(guest_role, AccessCodeLookup::Valid(ref role) if role == GUEST_ROLE));

        let token = create_session(&pool, STAFF_ROLE).await.unwrap();
        let token_role = find_role_for_token(&pool, &token).await.unwrap();
        assert_eq!(token_role.as_deref(), Some(STAFF_ROLE));
    }

    #[sqlx::test]
    async fn test_expired_access_code_is_rejected(pool: PgPool) {
        let pool = fresh_pool(pool).await;
        upsert_access_code(
            &pool,
            &AccessCodeSeed {
                role: GUEST_ROLE.to_string(),
                code: "expired-guest".to_string(),
                expires_at: Some(current_timestamp() as i64 - 60),
            },
        )
        .await
        .unwrap();

        let guest_role = resolve_access_code(&pool, "expired-guest", "staff-constant")
            .await
            .unwrap();
        assert!(matches!(guest_role, AccessCodeLookup::Expired));
    }

    #[sqlx::test]
    async fn test_default_guest_access_code_is_always_present(pool: PgPool) {
        let pool = fresh_pool(pool).await;

        upsert_access_code(
            &pool,
            &AccessCodeSeed {
                role: GUEST_ROLE.to_string(),
                code: "persisted-guest".to_string(),
                expires_at: None,
            },
        )
        .await
        .unwrap();

        ensure_default_guest_access_code(
            &pool,
            &AccessCodeSeed {
                role: GUEST_ROLE.to_string(),
                code: "bootstrap-guest".to_string(),
                expires_at: None,
            },
        )
        .await
        .unwrap();

        let persisted = resolve_access_code(&pool, "persisted-guest", "staff-constant")
            .await
            .unwrap();
        assert!(matches!(persisted, AccessCodeLookup::Valid(ref role) if role == GUEST_ROLE));

        let bootstrap = resolve_access_code(&pool, "bootstrap-guest", "staff-constant")
            .await
            .unwrap();
        assert!(matches!(bootstrap, AccessCodeLookup::Valid(ref role) if role == GUEST_ROLE));
    }

    #[sqlx::test]
    async fn test_access_code_crud_helpers_manage_guest_codes(pool: PgPool) {
        let pool = fresh_pool(pool).await;

        upsert_access_code(
            &pool,
            &AccessCodeSeed {
                role: GUEST_ROLE.to_string(),
                code: "vip-preview".to_string(),
                expires_at: Some(1_800_000_000),
            },
        )
        .await
        .unwrap();

        let saved = fetch_access_code(&pool, "vip-preview").await.unwrap().unwrap();
        assert_eq!(saved.code, "vip-preview");
        assert_eq!(saved.role, GUEST_ROLE);
        assert_eq!(saved.expires_at, Some(1_800_000_000));

        let all_codes = fetch_guest_access_codes(&pool).await.unwrap();
        assert_eq!(all_codes.len(), 1);
        assert_eq!(all_codes[0].code, "vip-preview");

        delete_guest_access_code(&pool, "vip-preview").await.unwrap();
        assert!(fetch_access_code(&pool, "vip-preview").await.unwrap().is_none());
    }

    #[sqlx::test]
    async fn test_gallery_helpers_load_summary_and_detail(pool: PgPool) {
        let pool = fresh_pool(pool).await;

        sqlx::query(
            "INSERT INTO gallery_events (slug, title, date_label, summary, cover_image_url, sort_order, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind("spring-supper")
        .bind("Spring Supper")
        .bind("April 2026")
        .bind("A seasonal tasting menu.")
        .bind("https://cdn.example.com/cover.jpg")
        .bind(1_i64)
        .bind(1_i64)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO gallery_images (event_slug, image_url, alt_text, sort_order, is_preview)
             VALUES
             ($1, $2, $3, $4, $5),
             ($1, $6, $7, $8, $9),
             ($1, $10, $11, $12, $13)",
        )
        .bind("spring-supper")
        .bind("https://cdn.example.com/preview-1.jpg")
        .bind("First preview")
        .bind(1_i64)
        .bind(true)
        .bind("https://cdn.example.com/preview-2.jpg")
        .bind("Second preview")
        .bind(2_i64)
        .bind(true)
        .bind("https://cdn.example.com/full-3.jpg")
        .bind("Dessert course")
        .bind(3_i64)
        .bind(false)
        .execute(&pool)
        .await
        .unwrap();

        let summaries = fetch_gallery_event_summaries(&pool).await.unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].slug, "spring-supper");
        assert_eq!(summaries[0].preview_images.len(), 2);
        assert_eq!(summaries[0].cover_image, "https://cdn.example.com/cover.jpg");

        let detail = fetch_gallery_event_detail(&pool, "spring-supper").await.unwrap().unwrap();
        assert_eq!(detail.slug, "spring-supper");
        assert_eq!(detail.preview_images.len(), 2);
        assert_eq!(detail.gallery_images.len(), 1);
        assert_eq!(detail.gallery_images[0].alt, "Dessert course");
    }
}
