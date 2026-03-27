use crate::error::ApiError;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

pub(crate) const GUEST_ROLE: &str = "guest";
pub(crate) const STAFF_ROLE: &str = "staff";

/// Represents one saved reservation record returned to the frontend.
#[derive(Serialize, Deserialize, Clone, FromRow, ToSchema)]
pub(crate) struct Reservation {
    pub(crate) id: Option<i64>,
    pub(crate) date: String,
    pub(crate) time: String,
    pub(crate) name: String,
    pub(crate) email: Option<String>,
}

/// Represents an open reservation date on the calendar.
#[derive(Serialize, Deserialize, Clone, FromRow, ToSchema)]
pub(crate) struct AvailabilityDate {
    pub(crate) date: String,
    pub(crate) dinner_time: Option<String>,
}

/// One guest access-code record returned to staff management screens.
#[derive(Serialize, Deserialize, Clone, FromRow, ToSchema)]
pub(crate) struct AccessCodeRecord {
    pub(crate) code: String,
    pub(crate) role: String,
    pub(crate) expires_at: Option<i64>,
    pub(crate) created_at: i64,
}

/// One image attached to a gallery event, ready for the frontend to render directly.
#[derive(Serialize, Deserialize, Clone, ToSchema)]
pub(crate) struct GalleryImage {
    pub(crate) src: String,
    pub(crate) alt: String,
}

/// Summary data shown on the Gallery index page.
#[derive(Serialize, Deserialize, Clone, ToSchema)]
pub(crate) struct GalleryEventSummary {
    pub(crate) slug: String,
    pub(crate) title: String,
    pub(crate) date_label: String,
    pub(crate) summary: String,
    pub(crate) cover_image: String,
    pub(crate) preview_images: Vec<GalleryImage>,
}

/// Full event payload shown on the Gallery detail page.
#[derive(Serialize, Deserialize, Clone, ToSchema)]
pub(crate) struct GalleryEventDetail {
    pub(crate) slug: String,
    pub(crate) title: String,
    pub(crate) date_label: String,
    pub(crate) summary: String,
    pub(crate) cover_image: String,
    pub(crate) preview_images: Vec<GalleryImage>,
    pub(crate) gallery_images: Vec<GalleryImage>,
}

/// Query string used when deleting a single dinner slot from a date.
#[derive(Deserialize, ToSchema)]
pub(crate) struct DeleteAvailabilityParams {
    pub(crate) dinner_time: Option<String>,
}

/// Query string used when freeing a reserved dinner slot.
#[derive(Deserialize, ToSchema)]
pub(crate) struct DeleteReservationParams {
    pub(crate) time: Option<String>,
}

/// Request body used by staff when creating or updating a guest access code.
#[derive(Deserialize, ToSchema)]
pub(crate) struct CreateAccessCodeRequest {
    pub(crate) code: String,
    pub(crate) expires_at: Option<String>,
}

/// Captures the access code submitted during login.
#[derive(Deserialize, ToSchema)]
pub(crate) struct LoginRequest {
    pub(crate) code: String,
}

/// Returns the bearer token and role created for a valid login.
#[derive(Serialize, ToSchema)]
pub(crate) struct LoginResponse {
    pub(crate) token: String,
    pub(crate) role: String,
}

/// Returns the saved reservation along with email delivery status.
#[derive(Serialize, ToSchema)]
pub(crate) struct CreateReservationResponse {
    pub(crate) reservation: Reservation,
    pub(crate) confirmation_email_sent: bool,
}

/// Returns the freed reservation along with cancellation email delivery status.
#[derive(Serialize, ToSchema)]
pub(crate) struct DeleteReservationResponse {
    pub(crate) reservation: Reservation,
    pub(crate) cancellation_email_sent: bool,
}

/// Returns the removed dinner slot and any reservation that was cancelled as part of removing it.
#[derive(Serialize, ToSchema)]
pub(crate) struct DeleteAvailabilityResponse {
    pub(crate) availability: AvailabilityDate,
    pub(crate) removed_reservation: Option<Reservation>,
    pub(crate) cancellation_email_sent: bool,
}

/// Stores one backend access-code record with an optional expiration timestamp.
#[derive(Clone)]
pub(crate) struct AccessCodeSeed {
    pub(crate) role: String,
    pub(crate) code: String,
    pub(crate) expires_at: Option<i64>,
}

/// Distinguishes valid, expired, and unknown access-code lookups.
pub(crate) enum AccessCodeLookup {
    Valid(String),
    Expired,
    Missing,
}

/// Models the two permission tiers supported by the app.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum AccessRole {
    Guest,
    Staff,
}

impl AccessRole {
    /// Staff can do everything; guests can only hit guest-level routes.
    pub(crate) fn allows(self, required: AccessRole) -> bool {
        matches!(
            (self, required),
            (AccessRole::Staff, _) | (AccessRole::Guest, AccessRole::Guest)
        )
    }
}

impl TryFrom<&str> for AccessRole {
    type Error = ApiError;

    /// Converts strings loaded from the database into a Rust enum.
    fn try_from(value: &str) -> std::result::Result<Self, Self::Error> {
        match value {
            GUEST_ROLE => Ok(Self::Guest),
            STAFF_ROLE => Ok(Self::Staff),
            _ => Err(ApiError::internal("Unknown access role")),
        }
    }
}
