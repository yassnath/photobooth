import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const dataDir = resolve(process.env.PHOTOBOOTH_DATA_DIR || join(rootDir, ".photobooth-data"));

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function booleanFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

export const config = {
  rootDir,
  dataDir,
  distDir: join(rootDir, "dist"),
  databasePath: resolve(process.env.DATABASE_PATH || join(dataDir, "photobooth.sqlite")),
  databaseDriver: (process.env.DATABASE_DRIVER || (process.env.DATABASE_URL ? "postgres" : "sqlite")).toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.DATABASE_SSL !== "false",
  databaseMaxConnections: Math.max(1, numberFromEnv("DATABASE_MAX_CONNECTIONS", 3)),
  localObjectDir: resolve(process.env.LOCAL_OBJECT_DIR || join(dataDir, "objects")),
  port: numberFromEnv("API_PORT", numberFromEnv("PORT", 4174)),
  publicAppUrl: trimTrailingSlash(process.env.PUBLIC_APP_URL),
  sessionPrice: numberFromEnv("SESSION_PRICE", 25_000),
  paymentProvider: (process.env.PAYMENT_PROVIDER || (process.env.MIDTRANS_SERVER_KEY ? "midtrans" : "mock")).toLowerCase(),
  paymentExpiryMinutes: numberFromEnv("PAYMENT_EXPIRY_MINUTES", 10),
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
    merchantId: process.env.MIDTRANS_MERCHANT_ID || "",
    production: process.env.MIDTRANS_IS_PRODUCTION === "true",
    acquirer: process.env.MIDTRANS_QRIS_ACQUIRER || "gopay",
  },
  storageDriver: (process.env.STORAGE_DRIVER || "local").toLowerCase(),
  localStorageMirror: booleanFromEnv("LOCAL_STORAGE_MIRROR", false),
  s3: {
    endpoint: process.env.S3_ENDPOINT || "",
    region: process.env.S3_REGION || "ap-southeast-1",
    bucket: process.env.S3_BUCKET || "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  },
  supabase: {
    url: trimTrailingSlash(process.env.SUPABASE_URL),
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "photobooth-media",
  },
  resultRetentionHours: numberFromEnv("RESULT_RETENTION_HOURS", 24),
  rawPhotoRetentionHours: numberFromEnv("RAW_PHOTO_RETENTION_HOURS", 72),
  adminSessionHours: numberFromEnv("ADMIN_SESSION_HOURS", 12),
  adminBootstrap: {
    username: (process.env.ADMIN_BOOTSTRAP_USERNAME || "admin").trim().toLowerCase(),
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD || "photobooth123",
    displayName: process.env.ADMIN_BOOTSTRAP_NAME || "Booth Admin",
  },
  booth: {
    id: process.env.BOOTH_ID || "booth-main",
    name: process.env.BOOTH_NAME || "Main Booth",
    agentToken: process.env.BOOTH_AGENT_TOKEN || "",
  },
  nodeEnv: process.env.NODE_ENV || "development",
};

export function getPublicBaseUrl(request) {
  if (config.publicAppUrl) return config.publicAppUrl;
  return `${request.protocol}://${request.get("host")}`;
}
