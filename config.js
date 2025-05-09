require('dotenv').config({ path: __dirname + '/.env' });

var environment = {};
var enviromentToExport = {};

environment.prod = {
  nodeserver: {
    environment: "prod",
    server_port: process.env.PROD_SERVER_PORT,
    db_host: process.env.PROD_DB_HOST,
    db_user: process.env.PROD_DB_USER,
    db_password: process.env.PROD_DB_PASSWORD,
    db_djfan: process.env.PROD_DB_DJFAN,
    db_login: process.env.PROD_DB_LOGIN,
    sparkpost_api_key: process.env.SPARKPOST_API_KEY,
    sparkpost_mail_from: process.env.SPARKPOST_MAIL_FROM,
    app_url: process.env.PROD_APP_URL,
    api_backend: process.env.PROD_API_BACKEND,
    webhook_backend: process.env.DEV_BACKEND_WEBHOOK,
    r2_s3_account_id: process.env.R2_S3_ACCOUNT_ID,
    r2_s3_access_key_id: process.env.R2_S3_ACCESS_KEY_ID,
    r2_s3_key_secret: process.env.R2_S3_KEY_SECRET,
    r2_s3_domain: process.env.R2_S3_DOMAIN,
    r2_s3_uploads: process.env.R2_S3_UPLOADS,
    r2_s3_avatar: process.env.R2_S3_AVATAR,
    allowed_file_extension_image: process.env.ALLOWED_FILE_EXTENSIONS_IMAGE,
    allowed_file_extension_audio: process.env.ALLOWED_FILE_EXTENSIONS_AUDIO,
    allowed_file_extension_video: process.env.ALLOWED_FILE_EXTENSIONS_VIDEO,
    surl_time: process.env.PROD_SURL_TIME,
    surl_time_margin: process.env.PROD_SURL_TIME_MARGIN,
    stripe_secret: process.env.PROD_STRIPE_SECRET,
    stream_api_key: process.env.PROD_STREAM_API_KEY,
    stream_api_secret: process.env.PROD_STREAM_API_SECRET,
    djfan_api_key: process.env.PROD_DJFAN_API_KEY,
    google_recaptcha_secret: process.env.GOOGLE_RECAPTCHA_SECRET,
  },
};

environment.test = {
  nodeserver: {
    environment: "test",
    server_port: process.env.TEST_SERVER_PORT,
    db_host: process.env.TEST_DB_HOST,
    db_user: process.env.TEST_DB_USER,
    db_password: process.env.TEST_DB_PASSWORD,
    db_djfan: process.env.TEST_DB_DJFAN,
    db_login: process.env.TEST_DB_LOGIN,
    sparkpost_api_key: process.env.SPARKPOST_API_KEY,
    sparkpost_mail_from: process.env.SPARKPOST_MAIL_FROM,
    app_url: process.env.TEST_APP_URL,
    api_backend: process.env.TEST_API_BACKEND,
    webhook_backend: process.env.TEST_BACKEND_WEBHOOK,
    r2_s3_account_id: process.env.R2_S3_ACCOUNT_ID,
    r2_s3_access_key_id: process.env.R2_S3_ACCESS_KEY_ID,
    r2_s3_key_secret: process.env.R2_S3_KEY_SECRET,
    r2_s3_domain: process.env.R2_S3_DOMAIN,
    r2_s3_uploads: process.env.R2_S3_UPLOADS,
    r2_s3_avatar: process.env.R2_S3_AVATAR,
    allowed_file_extension_image: process.env.ALLOWED_FILE_EXTENSIONS_IMAGE,
    allowed_file_extension_audio: process.env.ALLOWED_FILE_EXTENSIONS_AUDIO,
    allowed_file_extension_video: process.env.ALLOWED_FILE_EXTENSIONS_VIDEO,
    surl_time: process.env.TEST_SURL_TIME,
    surl_time_margin: process.env.TEST_SURL_TIME_MARGIN,
    stripe_secret: process.env.TEST_STRIPE_SECRET,
    stream_api_key: process.env.TEST_STREAM_API_KEY,
    stream_api_secret: process.env.TEST_STREAM_API_SECRET,
    djfan_api_key: process.env.TEST_DJFAN_API_KEY,
    google_recaptcha_secret: process.env.GOOGLE_RECAPTCHA_SECRET,
  },
};

environment.stage = {
  nodeserver: {
    environment: "stage",
    server_port: process.env.STAGE_SERVER_PORT,
    db_host: process.env.STAGE_DB_HOST,
    db_user: process.env.STAGE_DB_USER,
    db_password: process.env.STAGE_DB_PASSWORD,
    db_djfan: process.env.STAGE_DB_DJFAN,
    db_login: process.env.STAGE_DB_LOGIN,
    sparkpost_api_key: process.env.SPARKPOST_API_KEY,
    sparkpost_mail_from: process.env.SPARKPOST_MAIL_FROM,
    app_url: process.env.STAGE_APP_URL,
    api_backend: process.env.STAGE_API_BACKEND,
    webhook_backend: process.env.STAGE_BACKEND_WEBHOOK,
    r2_s3_account_id: process.env.R2_S3_ACCOUNT_ID,
    r2_s3_access_key_id: process.env.R2_S3_ACCESS_KEY_ID,
    r2_s3_key_secret: process.env.R2_S3_KEY_SECRET,
    r2_s3_domain: process.env.R2_S3_DOMAIN,
    r2_s3_uploads: process.env.R2_S3_UPLOADS,
    r2_s3_avatar: process.env.R2_S3_AVATAR,
    allowed_file_extension_image: process.env.ALLOWED_FILE_EXTENSIONS_IMAGE,
    allowed_file_extension_audio: process.env.ALLOWED_FILE_EXTENSIONS_AUDIO,
    allowed_file_extension_video: process.env.ALLOWED_FILE_EXTENSIONS_VIDEO,
    surl_time: process.env.STAGE_SURL_TIME,
    surl_time_margin: process.env.STAGE_SURL_TIME_MARGIN,
    stripe_secret: process.env.STAGE_STRIPE_SECRET,
    stream_api_key: process.env.STAGE_STREAM_API_KEY,
    stream_api_secret: process.env.STAGE_STREAM_API_SECRET,
    djfan_api_key: process.env.STAGE_DJFAN_API_KEY,
    google_recaptcha_secret: process.env.GOOGLE_RECAPTCHA_SECRET,
  },
};

environment.dev = {
  nodeserver: {
    environment: "dev",
    server_port: process.env.DEV_SERVER_PORT,
    db_host: process.env.DEV_DB_HOST,
    db_user: process.env.DEV_DB_USER,
    db_password: process.env.DEV_DB_PASSWORD,
    db_djfan: process.env.DEV_DB_DJFAN,
    db_login: process.env.DEV_DB_LOGIN,
    api_key : process.env.DEV_API_KEY,
    secret_key : process.env.DEV_SECRET_KEY,
    secret_value : process.env.DEV_SECRET_VALUE,
  },
};

enviromentToExport = environment.dev;

module.exports = enviromentToExport;
