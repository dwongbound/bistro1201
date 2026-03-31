use aws_sdk_s3::{
    config::{BehaviorVersion, Credentials, Region},
    Client,
};

/// S3-compatible storage client and bucket name, available to handlers that upload files.
#[derive(Clone)]
pub(crate) struct StorageState {
    pub(crate) client: Client,
    pub(crate) bucket: String,
}

/// Builds the S3 client from environment variables. Returns `None` if any required var is missing.
pub(crate) fn load_storage_state() -> Option<StorageState> {
    let endpoint = std::env::var("R2_ENDPOINT_URL").ok()?;
    let bucket = std::env::var("R2_BUCKET").ok()?;
    let access_key_id = std::env::var("R2_ACCESS_KEY_ID").ok()?;
    let secret_access_key = std::env::var("R2_SECRET_ACCESS_KEY").ok()?;

    let credentials = Credentials::new(&access_key_id, &secret_access_key, None, None, "env");

    let config = aws_sdk_s3::Config::builder()
        .behavior_version(BehaviorVersion::latest())
        .endpoint_url(endpoint)
        .credentials_provider(credentials)
        // "auto" works for Cloudflare R2; MinIO ignores the region value.
        .region(Region::new("auto"))
        // Path-style addressing is required for MinIO and works fine with R2.
        .force_path_style(true)
        .build();

    Some(StorageState {
        client: Client::from_conf(config),
        bucket,
    })
}
