use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::openapi::{ComponentsBuilder, OpenApi as OpenApiDoc};
use utoipa::{Modify, OpenApi};

use crate::error::ErrorResponse;
use crate::models::{
    AccessCodeRecord, AvailabilityDate, CreateAccessCodeRequest, CreateReservationResponse, DeleteAvailabilityResponse,
    GalleryEventDetail, GalleryEventSummary, GalleryImage, LoginRequest, LoginResponse, DeleteReservationResponse,
    Reservation,
};

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut OpenApiDoc) {
        let components = openapi.components.get_or_insert_with(|| ComponentsBuilder::new().build());
        components.add_security_scheme(
            "bearer_auth",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("Bearer token")
                    .build(),
            ),
        );
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::handlers::root,
        crate::handlers::login,
        crate::handlers::get_reservations,
        crate::handlers::create_reservation,
        crate::handlers::delete_reservation,
        crate::handlers::get_available_dates,
        crate::handlers::create_available_date,
        crate::handlers::delete_available_date,
        crate::handlers::get_access_codes,
        crate::handlers::create_access_code,
        crate::handlers::delete_access_code,
        crate::handlers::get_gallery_events,
        crate::handlers::get_gallery_event
    ),
    components(
        schemas(
            ErrorResponse,
            LoginRequest,
            LoginResponse,
            Reservation,
            CreateReservationResponse,
            DeleteReservationResponse,
            DeleteAvailabilityResponse,
            AvailabilityDate,
            CreateAccessCodeRequest,
            AccessCodeRecord,
            GalleryImage,
            GalleryEventSummary,
            GalleryEventDetail
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "health", description = "Simple health-check routes"),
        (name = "auth", description = "Access-code login and bearer-token auth"),
        (name = "reservations", description = "Guest reservation and availability endpoints"),
        (name = "access-codes", description = "Staff-managed guest access code endpoints"),
        (name = "gallery", description = "Public gallery metadata and image endpoints")
    )
)]
pub(crate) struct ApiDoc;
