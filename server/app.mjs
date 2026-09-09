import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  getFilterPresetsConfig,
  getFrameDesignsConfig,
  getThemeConfig,
  openDatabase,
  writeAdminAuditLog,
} from "./lib/database.mjs";
import { startRetentionWorker } from "./services/retention.mjs";
import { createObjectStorage } from "./services/storage.mjs";

import {
  adminAccountJson,
  createAdminManagementRouter,
  createAdminMiddleware,
  createAuthRouter,
} from "./routes/auth.mjs";
import { createBoothsRouter } from "./routes/booths.mjs";
import { createAdminConfigRouter, createPublicConfigRouter } from "./routes/config.mjs";
import {
  createPaymentsRouter,
  createVouchersManagementRouter,
  createWebhooksRouter,
  voucherJson,
} from "./routes/payments.mjs";
import {
  createAdminMediaRouter,
  createDownloadRouter,
  createResultsRouter,
  createSessionsRouter,
} from "./routes/sessions.mjs";

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function orderJson(row) {
  return {
    id: row.id,
    orderId: row.code || row.order_id,
    provider: row.provider,
    method: row.method,
    status: row.status,
    baseAmount: row.base_amount,
    discountAmount: row.discount_amount,
    amount: row.total_amount ?? row.amount,
    voucherCode: row.voucher_code || undefined,
    sessionId: row.session_id || null,
    resultFormat: row.result_format || null,
    frameLayout: row.frame_layout || null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    expiresAt: toIso(row.expires_at),
    paidAt: toIso(row.paid_at),
  };
}

export async function createApplication(config) {
  const database = await openDatabase(config);
  const storage = createObjectStorage(config);
  const stopRetention = startRetentionWorker(database, storage);
  const requireAdmin = createAdminMiddleware(database);
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("Permissions-Policy", "camera=(self), microphone=()");
    next();
  });
  app.use(express.json({ limit: "64mb" }));

  // Health probe
  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      database: database.driver,
      storage: storage.label || config.storageDriver,
      localStorageMirror: Boolean(config.localStorageMirror),
      paymentProvider: config.paymentProvider,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount modular route controllers
  const { router: authRouter } = createAuthRouter({ database, config, writeAdminAuditLog });
  app.use("/api/auth", authRouter);
  app.use("/api/payments", createPaymentsRouter({ database, config }));
  app.use("/api/webhooks", createWebhooksRouter({ database, config }));
  app.use("/api/sessions", createSessionsRouter({ database, storage, config, requireAdmin, writeAdminAuditLog }));
  app.use("/api/results", createResultsRouter({ database, storage, config }));
  app.use("/download", createDownloadRouter({ database }));
  app.use("/api/config", createPublicConfigRouter({ database, config }));
  app.use("/api/booths", createBoothsRouter({ database }));

  // Admin sub-routers
  app.use("/api/admin", createAdminManagementRouter({ database, writeAdminAuditLog, requireAdmin }));
  app.use("/api/admin", createVouchersManagementRouter({ database, writeAdminAuditLog, requireAdmin }));
  app.use("/api/admin", createAdminMediaRouter({ database, storage, requireAdmin, writeAdminAuditLog }));
  app.use("/api/admin", createAdminConfigRouter({ database, requireAdmin, writeAdminAuditLog }));

  // Admin Bootstrap endpoint (High-performance batch queries, eliminating N+1 DB bottleneck)
  app.get("/api/admin/bootstrap", requireAdmin, asyncRoute(async (request, response) => {
    const limit = Math.min(500, Math.max(1, Number(request.query?.limit) || 500));
    const offset = Math.max(0, Number(request.query?.offset) || 0);

    const [sessionRows, orderRows, voucherRows, boothRows, adminRows, theme, filters, frames, auditRows, eventRows] = await Promise.all([
      database.all(`
        SELECT s.*,
               o.id AS order_pk, o.code AS order_code, o.method AS order_method,
               o.total_amount AS order_total_amount,
               o.base_amount AS order_base_amount, o.discount_amount AS order_discount_amount,
               o.paid_at AS order_paid_at, v.code AS voucher_code
        FROM sessions s
        LEFT JOIN orders o ON o.id = s.order_id
        LEFT JOIN vouchers v ON v.id = o.voucher_id
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `, limit, offset),
      database.all(`
        SELECT o.*, v.code AS voucher_code, s.id AS session_id, s.result_format, s.frame_layout
        FROM orders o
        LEFT JOIN vouchers v ON v.id = o.voucher_id
        LEFT JOIN sessions s ON s.order_id = o.id
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `, limit, offset),
      database.all("SELECT * FROM vouchers ORDER BY created_at DESC"),
      database.all("SELECT * FROM booths ORDER BY name"),
      database.all("SELECT id, username, display_name, active, created_at, updated_at FROM admins ORDER BY created_at DESC"),
      getThemeConfig(database, null),
      getFilterPresetsConfig(database, null),
      getFrameDesignsConfig(database, null),
      database.all("SELECT * FROM logs WHERE source = 'admin' ORDER BY created_at DESC LIMIT 100").catch(() => []),
      database.all("SELECT * FROM logs WHERE source = 'booth' ORDER BY created_at DESC LIMIT 100").catch(() => []),
    ]);

    // Single indexed batch fetch for raw photos of all sessions (no N+1 loop)
    const sessionIds = sessionRows.map((r) => r.id);
    const photosBySession = new Map();
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => "?").join(",");
      const photoRows = await database.all(
        `SELECT id, session_id FROM photos WHERE session_id IN (${placeholders}) AND kind = 'raw' ORDER BY created_at, id`,
        ...sessionIds
      );
      for (const photo of photoRows) {
        if (!photosBySession.has(photo.session_id)) {
          photosBySession.set(photo.session_id, []);
        }
        photosBySession.get(photo.session_id).push(`/api/admin/assets/${encodeURIComponent(photo.id)}`);
      }
    }

    const sessions = sessionRows.map((row) => {
      const payment = row.order_pk ? {
        id: row.order_pk,
        method: row.order_method,
        amount: row.order_total_amount,
        baseAmount: row.order_base_amount,
        discountAmount: row.order_discount_amount,
        paidAt: toIso(row.order_paid_at),
        voucherCode: row.voucher_code || undefined,
      } : undefined;

      return {
        id: row.id,
        createdAt: toIso(row.created_at),
        mode: row.mode,
        templateId: row.template_id,
        frameLayout: row.frame_layout || undefined,
        resultFormat: row.result_format || undefined,
        payment,
        consent: parseJson(row.consent_json, undefined),
        editor: parseJson(row.editor_json, { filterId: "none", stickers: [], caption: "", adjustments: { brightness: 100, contrast: 100, saturation: 100 } }),
        photos: photosBySession.get(row.id) || [],
      };
    });

    const orders = orderRows.map(orderJson);
    const vouchers = voucherRows.map(voucherJson);
    const booths = boothRows.map((booth) => ({
      id: booth.id,
      name: booth.name,
      online: Boolean(booth.last_seen_at && Date.now() - booth.last_seen_at < 45_000),
      lastSeenAt: toIso(booth.last_seen_at),
      version: booth.version,
      status: parseJson(booth.status_json, {}),
    }));

    response.json({
      admin: request.admin,
      config: {
        theme,
        filters,
        frames,
        sessionPrice: config.sessionPrice,
      },
      sessions,
      orders,
      vouchers,
      booths,
      admins: adminRows.map((row) => adminAccountJson(row, request.admin.id)),
      auditLogs: auditRows.map((row) => ({
        id: row.id,
        adminId: row.admin_id,
        action: row.event_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: parseJson(row.metadata_json, null),
        createdAt: toIso(row.created_at),
      })),
      boothEvents: eventRows.map((row) => ({
        id: row.id,
        boothId: row.booth_id,
        level: row.level,
        eventType: row.event_type,
        message: row.message,
        metadata: parseJson(row.metadata_json, null),
        createdAt: toIso(row.created_at),
      })),
    });
  }));

  // Catch-all API 404
  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "Endpoint API tidak ditemukan." });
  });

  // Global API error handler
  app.use((error, _request, response, _next) => {
    console.error("[API Error]", error);
    response.status(500).json({ error: "Terjadi kesalahan pada server.", detail: config.nodeEnv === "development" ? error.message : undefined });
  });

  // Serve frontend build if dist exists
  if (existsSync(config.distDir)) {
    app.use(express.static(config.distDir));
    app.use((request, response, next) => {
      if (request.method !== "GET") {
        next();
        return;
      }
      response.sendFile(join(config.distDir, "index.html"));
    });
  }

  return {
    app,
    database,
    storage,
    async close() {
      stopRetention();
      await database.close();
    },
  };
}
