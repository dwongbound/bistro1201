use crate::email::EmailConfig;
use sqlx::PgPool;

/// Postgres pools are already cheap to clone, so handlers can share this directly.
pub(crate) type Db = PgPool;

/// Shared application dependencies cloned into each Axum handler.
#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) db: Db,
    pub(crate) email: Option<EmailConfig>,
    pub(crate) staff_access_code: String,
}
