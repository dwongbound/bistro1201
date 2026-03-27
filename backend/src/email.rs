use crate::error::ApiError;
use crate::models::Reservation;
use crate::state::AppState;
use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use std::env;
use std::fs;

type Mailer = AsyncSmtpTransport<Tokio1Executor>;
const DEFAULT_CONFIRMATION_TEMPLATE_PATH: &str = "/app/templates/reservation_confirmation.txt";
const DEFAULT_CANCELLATION_TEMPLATE_PATH: &str = "/app/templates/reservation_cancellation.txt";

/// Holds SMTP settings used to send reservation confirmation emails.
#[derive(Clone)]
pub(crate) struct EmailConfig {
    pub(crate) mailer: Mailer,
    pub(crate) from: Mailbox,
    pub(crate) reply_to: Option<Mailbox>,
    pub(crate) confirmation_template: String,
    pub(crate) cancellation_template: String,
}

/// Sends a reservation confirmation email when SMTP settings are configured.
pub(crate) async fn send_confirmation_email(
    state: &AppState,
    reservation: &Reservation,
) -> std::result::Result<bool, ApiError> {
    let recipient = reservation.email.as_deref().unwrap_or("").trim();
    if recipient.is_empty() {
        return Ok(false);
    }

    let Some(email_config) = state.email.as_ref() else {
        return Ok(false);
    };

    let to: Mailbox = recipient
        .parse()
        .map_err(|_| ApiError::bad_request("The reservation email address is invalid"))?;
    let mut email_builder = Message::builder()
        .from(email_config.from.clone())
        .to(to)
        .subject("Your 1201 Bistro reservation is confirmed");

    if let Some(reply_to) = email_config.reply_to.clone() {
        email_builder = email_builder.reply_to(reply_to);
    }

    let email = email_builder
        .body(build_confirmation_email_body(&email_config.confirmation_template, reservation))
        .map_err(|_| ApiError::internal("Unable to create the confirmation email"))?;

    email_config
        .mailer
        .send(email)
        .await
        .map_err(|_| ApiError::internal("Reservation saved, but the confirmation email could not be sent"))?;

    Ok(true)
}

/// Sends a reservation cancellation email when SMTP settings are configured.
pub(crate) async fn send_cancellation_email(
    state: &AppState,
    reservation: &Reservation,
) -> std::result::Result<bool, ApiError> {
    let recipient = reservation.email.as_deref().unwrap_or("").trim();
    if recipient.is_empty() {
        return Ok(false);
    }

    let Some(email_config) = state.email.as_ref() else {
        return Ok(false);
    };

    let to: Mailbox = recipient
        .parse()
        .map_err(|_| ApiError::bad_request("The reservation email address is invalid"))?;
    let mut email_builder = Message::builder()
        .from(email_config.from.clone())
        .to(to)
        .subject("Your 1201 Bistro reservation has been cancelled");

    if let Some(reply_to) = email_config.reply_to.clone() {
        email_builder = email_builder.reply_to(reply_to);
    }

    let email = email_builder
        .body(build_cancellation_email_body(&email_config.cancellation_template, reservation))
        .map_err(|_| ApiError::internal("Unable to create the cancellation email"))?;

    email_config
        .mailer
        .send(email)
        .await
        .map_err(|_| ApiError::internal("Reservation released, but the cancellation email could not be sent"))?;

    Ok(true)
}

/// Builds the plain-text confirmation email body from the configured template file.
fn build_confirmation_email_body(template: &str, reservation: &Reservation) -> String {
    template
        .replace("{{date}}", &reservation.date)
        .replace("{{time}}", &reservation.time)
        .replace("{{name}}", &reservation.name)
}

/// Builds the plain-text cancellation email body from the configured template file.
fn build_cancellation_email_body(template: &str, reservation: &Reservation) -> String {
    template
        .replace("{{date}}", &reservation.date)
        .replace("{{time}}", &reservation.time)
        .replace("{{name}}", &reservation.name)
}

/// Loads the plain-text email template that backs reservation confirmations.
fn load_confirmation_template() -> std::result::Result<String, ApiError> {
    let template_path = env::var("SMTP_CONFIRMATION_TEMPLATE_PATH")
        .unwrap_or_else(|_| DEFAULT_CONFIRMATION_TEMPLATE_PATH.to_string());

    fs::read_to_string(&template_path).map_err(|_| {
        ApiError::internal("SMTP_CONFIRMATION_TEMPLATE_PATH could not be read for reservation emails")
    })
}

/// Loads the plain-text email template that backs reservation cancellations.
fn load_cancellation_template() -> std::result::Result<String, ApiError> {
    let template_path = env::var("SMTP_CANCELLATION_TEMPLATE_PATH")
        .unwrap_or_else(|_| DEFAULT_CANCELLATION_TEMPLATE_PATH.to_string());

    fs::read_to_string(&template_path).map_err(|_| {
        ApiError::internal("SMTP_CANCELLATION_TEMPLATE_PATH could not be read for reservation emails")
    })
}

/// Creates SMTP configuration from environment variables when email sending is enabled.
pub(crate) fn load_email_config() -> std::result::Result<Option<EmailConfig>, ApiError> {
    let postmark_server_token = env::var("POSTMARK_SERVER_TOKEN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let host = match env::var("SMTP_HOST") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => match postmark_server_token.as_ref() {
            Some(_) => "smtp.postmarkapp.com".to_string(),
            None => return Ok(None),
        },
    };

    let username = match env::var("SMTP_USERNAME") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => postmark_server_token
            .clone()
            .ok_or_else(|| ApiError::internal("SMTP_USERNAME is required when SMTP_HOST is set"))?,
    };
    let password = match env::var("SMTP_PASSWORD") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => postmark_server_token
            .clone()
            .ok_or_else(|| ApiError::internal("SMTP_PASSWORD is required when SMTP_HOST is set"))?,
    };
    let from_address = env::var("SMTP_FROM_ADDRESS")
        .map_err(|_| ApiError::internal("SMTP_FROM_ADDRESS is required when SMTP_HOST is set"))?;
    let from_name = env::var("SMTP_FROM_NAME").unwrap_or_else(|_| "1201 Bistro".to_string());
    let reply_to_address = env::var("SMTP_REPLY_TO_ADDRESS").ok();
    let reply_to_name = env::var("SMTP_REPLY_TO_NAME").ok();
    let port: u16 = env::var("SMTP_PORT")
        .unwrap_or_else(|_| "587".to_string())
        .parse()
        .map_err(|_| ApiError::internal("SMTP_PORT must be a valid port number"))?;
    let confirmation_template = load_confirmation_template()?;
    let cancellation_template = load_cancellation_template()?;

    let from = Mailbox::new(
        Some(from_name),
        from_address
            .parse()
            .map_err(|_| ApiError::internal("SMTP_FROM_ADDRESS must be a valid email address"))?,
    );
    let credentials = Credentials::new(username, password);
    let reply_to = match reply_to_address {
        Some(address) if !address.trim().is_empty() => Some(Mailbox::new(
            reply_to_name.filter(|value| !value.trim().is_empty()),
            address
                .parse()
                .map_err(|_| ApiError::internal("SMTP_REPLY_TO_ADDRESS must be a valid email address"))?,
        )),
        _ => None,
    };
    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&host)
        .map_err(|_| ApiError::internal("SMTP_HOST could not be used to create a mail relay"))?
        .port(port)
        .credentials(credentials)
        .build();

    Ok(Some(EmailConfig {
        mailer,
        from,
        reply_to,
        confirmation_template,
        cancellation_template,
    }))
}
