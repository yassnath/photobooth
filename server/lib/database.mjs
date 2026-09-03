import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";

import { createId, hashPassword, hashToken } from "./security.mjs";

let SqliteDriver = null;
async function getSqliteDriver() {
  if (!SqliteDriver) {
    const mod = await import("better-sqlite3");
    SqliteDriver = mod.default || mod;
  }
  return SqliteDriver;
}

const sqliteSchema = `
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL CHECK(discount_type IN ('fixed', 'percent')),
    discount_value INTEGER NOT NULL,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    starts_at INTEGER,
    expires_at INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    base_amount INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL,
    voucher_id TEXT REFERENCES vouchers(id) ON DELETE SET NULL,
    provider_transaction_id TEXT,
    qr_string TEXT,
    qr_url TEXT,
    raw_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    paid_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    template_id TEXT NOT NULL,
    frame_layout TEXT,
    result_format TEXT,
    order_id TEXT UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
    consent_json TEXT,
    editor_json TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    result_token TEXT UNIQUE,
    kind TEXT NOT NULL CHECK(kind IN ('raw', 'result')),
    format TEXT,
    object_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    extension TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS booths (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT,
    last_seen_at INTEGER,
    status_json TEXT NOT NULL DEFAULT '{}',
    version TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK(source IN ('admin', 'booth', 'system')),
    level TEXT NOT NULL DEFAULT 'info',
    event_type TEXT NOT NULL,
    admin_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
    booth_id TEXT REFERENCES booths(id) ON DELETE SET NULL,
    entity_type TEXT,
    entity_id TEXT,
    message TEXT,
    metadata_json TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_voucher ON orders(voucher_id, status, expires_at);
  CREATE INDEX IF NOT EXISTS idx_photos_expiry ON photos(expires_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_order ON sessions(order_id) WHERE order_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
`;

function sqliteTableExists(raw, tableName) {
  return Boolean(raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function migrateLegacySqliteSchema(raw) {
  const now = Date.now();
  const valueForSetting = (value) => JSON.stringify(value);

  if (sqliteTableExists(raw, "payments")) {
    raw.exec(`
      INSERT OR IGNORE INTO orders (
        id, code, provider, method, status, base_amount, discount_amount, total_amount,
        voucher_id, provider_transaction_id, qr_string, qr_url, raw_json, created_at,
        updated_at, expires_at, paid_at
      )
      SELECT
        id, order_id, provider, method, status, base_amount, discount_amount, amount,
        voucher_id, provider_transaction_id, qr_string, qr_url, raw_json, created_at,
        updated_at, expires_at, paid_at
      FROM payments;
    `);
  }

  if (sqliteTableExists(raw, "photo_sessions")) {
    raw.exec(`
      INSERT OR IGNORE INTO sessions (
        id, mode, template_id, frame_layout, result_format, order_id,
        consent_json, editor_json, created_at, expires_at
      )
      SELECT
        id, mode, template_id, frame_layout, result_format, payment_id,
        consent_json, editor_json, created_at, expires_at
      FROM photo_sessions;
    `);
  }

  if (sqliteTableExists(raw, "media_assets")) {
    raw.exec(`
      INSERT OR IGNORE INTO photos (
        id, session_id, result_token, kind, format, object_key, mime_type,
        extension, size_bytes, created_at, expires_at
      )
      SELECT
        id, session_id, result_token, kind, format, object_key, mime_type,
        extension, size_bytes, created_at, expires_at
      FROM media_assets;
    `);
  }

  if (sqliteTableExists(raw, "theme_profiles")) {
    const row = raw.prepare("SELECT theme_json, updated_at FROM theme_profiles WHERE active = 1 ORDER BY updated_at DESC LIMIT 1").get();
    if (row) {
      raw.prepare(`
        INSERT INTO settings (key, value_json, updated_at) VALUES ('theme', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `).run(typeof row.theme_json === "string" ? row.theme_json : valueForSetting(row.theme_json), row.updated_at || now);
    }
  }

  if (sqliteTableExists(raw, "filter_presets")) {
    const filters = raw.prepare("SELECT id, label, css, source, created_at FROM filter_presets WHERE active = 1 ORDER BY sort_order, label").all()
      .map((row) => ({
        id: row.id,
        label: row.label,
        css: row.css,
        ...(row.source ? { source: row.source } : {}),
        ...(row.created_at ? { createdAt: new Date(row.created_at).toISOString() } : {}),
      }));
    if (filters.length > 0) {
      raw.prepare(`
        INSERT INTO settings (key, value_json, updated_at) VALUES ('filters', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `).run(valueForSetting(filters), now);
    }
  }

  if (sqliteTableExists(raw, "frame_designs")) {
    const frames = raw.prepare(`
      SELECT id, label, category, color, accent, emoji, overlay_image, layout, chroma_key_green, slots_json
      FROM frame_designs
      WHERE active = 1
      ORDER BY sort_order, label
    `).all().map((row) => ({
      id: row.id,
      label: row.label,
      category: row.category,
      color: row.color,
      accent: row.accent,
      emoji: row.emoji,
      ...(row.overlay_image ? { overlayImage: row.overlay_image } : {}),
      ...(row.layout ? { layout: row.layout } : {}),
      chromaKeyGreen: Boolean(row.chroma_key_green),
      ...(row.slots_json ? { slots: parseStoredJson(row.slots_json, undefined) } : {}),
    }));
    if (frames.length > 0) {
      raw.prepare(`
        INSERT INTO settings (key, value_json, updated_at) VALUES ('frames', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `).run(valueForSetting(frames), now);
    }
  }

  if (sqliteTableExists(raw, "admin_audit_logs")) {
    raw.exec(`
      INSERT OR IGNORE INTO logs (id, source, level, event_type, admin_id, entity_type, entity_id, metadata_json, created_at)
      SELECT id, 'admin', 'info', action, admin_id, entity_type, entity_id, metadata_json, created_at
      FROM admin_audit_logs;
    `);
  }

  if (sqliteTableExists(raw, "booth_events")) {
    raw.exec(`
      INSERT OR IGNORE INTO logs (id, source, level, event_type, booth_id, message, metadata_json, created_at)
      SELECT id, 'booth', level, event_type, booth_id, message, metadata_json, created_at
      FROM booth_events;
    `);
  }

  raw.exec(`
    DROP TABLE IF EXISTS voucher_redemptions;
    DROP TABLE IF EXISTS media_assets;
    DROP TABLE IF EXISTS photo_sessions;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS theme_profiles;
    DROP TABLE IF EXISTS filter_presets;
    DROP TABLE IF EXISTS frame_designs;
    DROP TABLE IF EXISTS admin_audit_logs;
    DROP TABLE IF EXISTS booth_events;
  `);
}

class AsyncMutex {
  constructor() {
    this.tail = Promise.resolve();
  }

  async run(callback) {
    let release;
    const previous = this.tail;
    this.tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

class SqliteExecutor {
  constructor(raw) {
    this.raw = raw;
    this.driver = "sqlite";
  }

  async get(statement, ...parameters) {
    return this.raw.prepare(statement).get(...parameters) || null;
  }

  async all(statement, ...parameters) {
    return this.raw.prepare(statement).all(...parameters);
  }

  async run(statement, ...parameters) {
    const result = this.raw.prepare(statement).run(...parameters);
    return { changes: Number(result.changes || 0) };
  }
}

class SqliteDatabase extends SqliteExecutor {
  constructor(raw) {
    super(raw);
    this.driver = "sqlite";
    this.mutex = new AsyncMutex();
    raw.pragma("journal_mode = WAL");
    raw.pragma("foreign_keys = ON");
    raw.pragma("busy_timeout = 5000");
    raw.exec(sqliteSchema);
    migrateLegacySqliteSchema(raw);
  }

  async get(statement, ...parameters) {
    return this.mutex.run(() => super.get(statement, ...parameters));
  }

  async all(statement, ...parameters) {
    return this.mutex.run(() => super.all(statement, ...parameters));
  }

  async run(statement, ...parameters) {
    return this.mutex.run(() => super.run(statement, ...parameters));
  }

  async transaction(callback, options = {}) {
    return this.mutex.run(async () => {
      this.raw.exec(options.immediate ? "BEGIN IMMEDIATE" : "BEGIN");
      try {
        const result = await callback(new SqliteExecutor(this.raw));
        this.raw.exec("COMMIT");
        return result;
      } catch (error) {
        this.raw.exec("ROLLBACK");
        throw error;
      }
    });
  }

  async close() {
    await this.mutex.run(() => this.raw.close());
  }
}

function postgresStatement(statement) {
  let parameterIndex = 0;
  return statement.replaceAll("?", () => `$${++parameterIndex}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientPostgresError(error) {
  return ["ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(error?.code) || String(error?.message || "").includes("max clients reached");
}

class PostgresExecutor {
  constructor(client) {
    this.client = client;
    this.driver = "postgres";
  }

  async all(statement, ...parameters) {
    try {
      const result = await this.client.unsafe(postgresStatement(statement), parameters);
      return Array.from(result);
    } catch (error) {
      if (!String(statement).trimStart().toLowerCase().startsWith("select") || !isTransientPostgresError(error)) {
        throw error;
      }
      await wait(350);
      const result = await this.client.unsafe(postgresStatement(statement), parameters);
      return Array.from(result);
    }
  }

  async get(statement, ...parameters) {
    const rows = await this.all(statement, ...parameters);
    return rows[0] || null;
  }

  async run(statement, ...parameters) {
    const result = await this.client.unsafe(postgresStatement(statement), parameters);
    return { changes: Number(result.count || 0) };
  }
}

class PostgresDatabase extends PostgresExecutor {
  constructor(config) {
    const client = postgres(config.databaseUrl, {
      ssl: config.databaseSsl ? "require" : false,
      max: config.databaseMaxConnections || 3,
      connect_timeout: 15,
      idle_timeout: 30,
      max_lifetime: 60 * 30,
      connection: { application_name: "pixiebooth-api" },
      types: {
        bigintMilliseconds: {
          to: 20,
          from: [20],
          parse: (value) => Number(value),
          serialize: (value) => String(value),
        },
      },
    });
    super(client);
    this.driver = "postgres";
  }

  async transaction(callback) {
    return this.client.begin((transactionClient) => callback(new PostgresExecutor(transactionClient)));
  }

  async close() {
    await this.client.end({ timeout: 5 });
  }
}

async function initializeDatabase(database, config) {
  const existingAdmin = await database.get("SELECT id FROM admins WHERE username = ?", config.adminBootstrap.username);
  const now = Date.now();
  const password = hashPassword(config.adminBootstrap.password);

  if (!existingAdmin) {
    await database.run(`
      INSERT INTO admins (id, username, display_name, password_hash, password_salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    createId("admin"),
    config.adminBootstrap.username,
    config.adminBootstrap.displayName,
    password.hash,
    password.salt,
    now,
    now);
    if (config.nodeEnv !== "test") {
      console.warn(`Admin awal dibuat untuk ${config.adminBootstrap.username}. Ganti ADMIN_BOOTSTRAP_PASSWORD sebelum produksi.`);
    }
  } else {
    await database.run(`
      UPDATE admins
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE username = ?
    `,
    password.hash,
    password.salt,
    now,
    config.adminBootstrap.username);
  }

  await database.run(`
    INSERT INTO booths (id, name, token_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, token_hash = excluded.token_hash, updated_at = excluded.updated_at
  `,
  config.booth.id,
  config.booth.name,
  config.booth.agentToken ? hashToken(config.booth.agentToken) : null,
  now,
  now);
}

export async function openDatabase(config) {
  if (config.databaseDriver === "postgres") {
    if (!config.databaseUrl) throw new Error("DATABASE_URL wajib diisi saat DATABASE_DRIVER=postgres.");
    const database = new PostgresDatabase(config);
    try {
      await database.get("SELECT 1 AS ok");
      const schema = await database.get("SELECT to_regclass('public.admins') AS admins_table, to_regclass('public.orders') AS orders_table");
      if (!schema?.admins_table || !schema?.orders_table) {
        throw new Error("Schema photobooth belum tersedia. Jalankan migration Supabase terlebih dahulu.");
      }
      await initializeDatabase(database, config);
      return database;
    } catch (error) {
      await database.close().catch(() => undefined);
      throw error;
    }
  }

  mkdirSync(dirname(config.databasePath), { recursive: true });
  const Driver = await getSqliteDriver();
  const raw = new Driver(config.databasePath);
  const database = new SqliteDatabase(raw);
  await initializeDatabase(database, config);
  return database;
}

export async function getSetting(database, key, fallback) {
  const row = await database.get("SELECT value_json FROM settings WHERE key = ?", key);
  if (!row) return fallback;
  return parseStoredJson(row.value_json, fallback);
}

function parseStoredJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "string") return parseStoredJson(parsed, fallback);
    return parsed;
  } catch {
    return fallback;
  }
}

function jsonValue(database, value) {
  return database.driver === "postgres" ? value : JSON.stringify(value);
}

export async function setSetting(database, key, value) {
  await database.run(`
    INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `, key, jsonValue(database, value), Date.now());
}

export async function getThemeConfig(database, fallback) {
  return getSetting(database, "theme", fallback);
}

export async function setThemeConfig(database, theme) {
  await setSetting(database, "theme", theme);
}

export async function getFilterPresetsConfig(database, fallback) {
  return getSetting(database, "filters", fallback);
}

export async function replaceFilterPresetsConfig(database, filters) {
  const safeFilters = Array.isArray(filters) ? filters : [];
  await setSetting(database, "filters", safeFilters);
}

export async function getFrameDesignsConfig(database, fallback) {
  return getSetting(database, "frames", fallback);
}

export async function replaceFrameDesignsConfig(database, frames) {
  const safeFrames = Array.isArray(frames) ? frames : [];
  await setSetting(database, "frames", safeFrames);
}

export async function writeAdminAuditLog(database, adminId, action, entityType, entityId = null, metadata = null) {
  await database.run(`
    INSERT INTO logs (id, source, level, event_type, admin_id, entity_type, entity_id, metadata_json, created_at)
    VALUES (?, 'admin', 'info', ?, ?, ?, ?, ?, ?)
  `,
  createId("audit"),
  String(action).slice(0, 120),
  adminId || null,
  String(entityType).slice(0, 80),
  entityId ? String(entityId).slice(0, 160) : null,
  metadata ? jsonValue(database, metadata) : null,
  Date.now());
}

export async function writeBoothEvent(database, boothId, level, eventType, message, metadata = null) {
  await database.run(`
    INSERT INTO logs (id, source, level, event_type, booth_id, message, metadata_json, created_at)
    VALUES (?, 'booth', ?, ?, ?, ?, ?, ?)
  `,
  createId("event"),
  String(level || "info").slice(0, 24),
  String(eventType || "status").slice(0, 80),
  boothId || null,
  String(message || "").slice(0, 500),
  metadata ? jsonValue(database, metadata) : null,
  Date.now());
}
