import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";

import { createId, hashPassword, hashToken } from "./security.mjs";

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

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    base_amount INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    amount INTEGER NOT NULL,
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

  CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id TEXT PRIMARY KEY,
    voucher_id TEXT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('reserved', 'redeemed', 'released')),
    created_at INTEGER NOT NULL,
    redeemed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS photo_sessions (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    template_id TEXT NOT NULL,
    frame_layout TEXT,
    result_format TEXT,
    payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
    consent_json TEXT,
    editor_json TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES photo_sessions(id) ON DELETE CASCADE,
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

  CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  CREATE INDEX IF NOT EXISTS idx_media_assets_expiry ON media_assets(expires_at);
  CREATE INDEX IF NOT EXISTS idx_photo_sessions_created ON photo_sessions(created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_sessions_payment ON photo_sessions(payment_id) WHERE payment_id IS NOT NULL;
`;

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
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true });
    const raw = new Database(path);
    super(raw);
    this.driver = "sqlite";
    this.mutex = new AsyncMutex();
    raw.pragma("journal_mode = WAL");
    raw.pragma("foreign_keys = ON");
    raw.pragma("busy_timeout = 5000");
    raw.exec(sqliteSchema);
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

class PostgresExecutor {
  constructor(client) {
    this.client = client;
    this.driver = "postgres";
  }

  async all(statement, ...parameters) {
    const result = await this.client.unsafe(postgresStatement(statement), parameters);
    return Array.from(result);
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
      max: 10,
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
      const schema = await database.get("SELECT to_regclass('public.admins') AS admins_table");
      if (!schema?.admins_table) {
        throw new Error("Schema photobooth belum tersedia. Jalankan migration Supabase terlebih dahulu.");
      }
      await initializeDatabase(database, config);
      return database;
    } catch (error) {
      await database.close().catch(() => undefined);
      throw error;
    }
  }

  const database = new SqliteDatabase(config.databasePath);
  await initializeDatabase(database, config);
  return database;
}

export async function getSetting(database, key, fallback) {
  const row = await database.get("SELECT value_json FROM settings WHERE key = ?", key);
  if (!row) return fallback;
  if (typeof row.value_json !== "string") return row.value_json;
  try {
    return JSON.parse(row.value_json);
  } catch {
    return fallback;
  }
}

export async function setSetting(database, key, value) {
  await database.run(`
    INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `, key, JSON.stringify(value), Date.now());
}
