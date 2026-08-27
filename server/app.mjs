import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { getPublicBaseUrl } from "./config.mjs";
import { getSetting, openDatabase, setSetting } from "./lib/database.mjs";
import {
  ADMIN_COOKIE_NAME,
  adminCookie,
  clearAdminCookie,
  createId,
  createToken,
  hashToken,
  parseCookies,
  safeEqualText,
  verifyPassword,
} from "./lib/security.mjs";
import {
  createProviderPayment,
  fetchMidtransQr,
  fetchMidtransStatus,
  normalizeMidtransStatus,
  verifyMidtransWebhook,
} from "./services/payments.mjs";
import { runRetention, startRetentionWorker } from "./services/retention.mjs";
import { createObjectStorage } from "./services/storage.mjs";

const resultIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const voucherCodePattern = /^[A-Z0-9_-]{3,32}$/;
const loginAttempts = new Map();

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function fromDateInput(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/jpeg|image\/png|image\/webp|image\/gif|video\/webm(?:;codecs=[^;]+)?);base64,([a-zA-Z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const mimeType = match[1].split(";", 1)[0].toLowerCase();
  const extension = mimeType === "image/png"
    ? "png"
    : mimeType === "image/webp"
      ? "webp"
      : mimeType === "image/gif"
        ? "gif"
        : mimeType === "video/webm"
          ? "webm"
          : "jpg";
  return { mimeType, extension, body: Buffer.from(match[2], "base64") };
}

function paymentJson(row, request) {
  if (!row) return null;
  const baseUrl = getPublicBaseUrl(request);
  return {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider,
    method: row.method,
    status: row.status,
    baseAmount: row.base_amount,
    discountAmount: row.discount_amount,
    amount: row.amount,
    voucherCode: row.voucher_code || undefined,
    qrString: row.qr_string || undefined,
    qrImageUrl: row.qr_url ? `${baseUrl}/api/payments/${encodeURIComponent(row.id)}/qr` : undefined,
    expiresAt: toIso(row.expires_at),
    paidAt: toIso(row.paid_at),
  };
}

function voucherJson(row) {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    active: Boolean(row.active),
    startsAt: toIso(row.starts_at),
    expiresAt: toIso(row.expires_at),
    createdAt: toIso(row.created_at),
  };
}

async function getVoucherQuote(database, code, baseAmount, options = {}) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) {
    return { valid: false, reason: "Masukkan kode voucher.", baseAmount, discountAmount: 0, finalAmount: baseAmount };
  }

  const lockClause = options.lock && database.driver === "postgres" ? " FOR UPDATE" : "";
  const voucher = await database.get(`SELECT * FROM vouchers WHERE code = ?${lockClause}`, normalizedCode);
  const now = Date.now();
  if (!voucher || !voucher.active) {
    return { valid: false, reason: "Voucher tidak ditemukan atau nonaktif.", baseAmount, discountAmount: 0, finalAmount: baseAmount };
  }
  if (voucher.starts_at && voucher.starts_at > now) {
    return { valid: false, reason: "Voucher belum dapat digunakan.", baseAmount, discountAmount: 0, finalAmount: baseAmount };
  }
  if (voucher.expires_at && voucher.expires_at <= now) {
    return { valid: false, reason: "Voucher sudah kedaluwarsa.", baseAmount, discountAmount: 0, finalAmount: baseAmount };
  }
  const reserved = (await database.get(`
    SELECT CAST(COUNT(*) AS INTEGER) AS count
    FROM voucher_redemptions vr
    JOIN payments p ON p.id = vr.payment_id
    WHERE vr.voucher_id = ? AND vr.status = 'reserved' AND p.expires_at > ?
  `, voucher.id, now)).count;
  if (voucher.max_uses !== null && voucher.used_count + reserved >= voucher.max_uses) {
    return { valid: false, reason: "Kuota voucher sudah habis.", baseAmount, discountAmount: 0, finalAmount: baseAmount };
  }

  const rawDiscount = voucher.discount_type === "percent"
    ? Math.round(baseAmount * voucher.discount_value / 100)
    : voucher.discount_value;
  const discountAmount = Math.min(baseAmount, Math.max(0, rawDiscount));
  return {
    valid: true,
    reason: "Voucher valid.",
    baseAmount,
    discountAmount,
    finalAmount: baseAmount - discountAmount,
    voucher: voucherJson(voucher),
    voucherRow: voucher,
  };
}

async function getPaymentRow(database, idOrOrderId) {
  return database.get(`
    SELECT p.*, v.code AS voucher_code
    FROM payments p
    LEFT JOIN vouchers v ON v.id = p.voucher_id
    WHERE p.id = ? OR p.order_id = ?
  `, idOrOrderId, idOrOrderId);
}

async function updatePaymentStatus(database, payment, status, rawPayload) {
  const now = Date.now();
  await database.transaction(async (transaction) => {
    const paymentLock = transaction.driver === "postgres" ? " FOR UPDATE" : "";
    const current = await transaction.get(`SELECT status, voucher_id FROM payments WHERE id = ?${paymentLock}`, payment.id);
    if (!current) return;
    if (current.status === "paid" && status !== "paid") return;
    if (current.status === status) {
      await transaction.run("UPDATE payments SET raw_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(rawPayload || {}), now, payment.id);
      return;
    }

    await transaction.run(`
      UPDATE payments
      SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE paid_at END,
          raw_json = ?, updated_at = ?
      WHERE id = ?
    `, status, status, now, JSON.stringify(rawPayload || {}), now, payment.id);

    if (!current.voucher_id) return;
    const redemption = await transaction.get("SELECT id, status FROM voucher_redemptions WHERE payment_id = ?", payment.id);
    if (!redemption) return;

    if (status === "paid" && redemption.status !== "redeemed") {
      await transaction.run("UPDATE voucher_redemptions SET status = 'redeemed', redeemed_at = ? WHERE id = ?", now, redemption.id);
      await transaction.run("UPDATE vouchers SET used_count = used_count + 1, updated_at = ? WHERE id = ?", now, current.voucher_id);
    } else if ((status === "expired" || status === "failed") && redemption.status === "reserved") {
      await transaction.run("UPDATE voucher_redemptions SET status = 'released' WHERE id = ?", redemption.id);
    }
  });
}

async function adminFromRequest(database, request) {
  const cookies = parseCookies(request.headers.cookie);
  const rawToken = cookies[ADMIN_COOKIE_NAME];
  if (!rawToken) return null;
  const now = Date.now();
  const row = await database.get(`
    SELECT a.id, a.username, a.display_name, s.id AS session_id, s.expires_at
    FROM admin_sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND a.active = 1
  `, hashToken(rawToken), now);
  if (!row) return null;
  await database.run("UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?", now, row.session_id);
  return { id: row.id, username: row.username, displayName: row.display_name, expiresAt: toIso(row.expires_at) };
}

function createAdminMiddleware(database) {
  return asyncRoute(async (request, response, next) => {
    const admin = await adminFromRequest(database, request);
    if (!admin) {
      response.status(401).json({ error: "Sesi admin tidak valid atau sudah berakhir." });
      return;
    }
    request.admin = admin;
    next();
  });
}

async function serializeSession(database, row) {
  const assets = await database.all("SELECT id FROM media_assets WHERE session_id = ? AND kind = 'raw' ORDER BY created_at, id", row.id);
  const payment = row.payment_id ? await getPaymentRow(database, row.payment_id) : null;
  return {
    id: row.id,
    createdAt: toIso(row.created_at),
    mode: row.mode,
    templateId: row.template_id,
    frameLayout: row.frame_layout || undefined,
    resultFormat: row.result_format || undefined,
    payment: payment
      ? {
          id: payment.id,
          method: payment.method,
          amount: payment.amount,
          baseAmount: payment.base_amount,
          discountAmount: payment.discount_amount,
          paidAt: toIso(payment.paid_at),
          voucherCode: payment.voucher_code || undefined,
        }
      : undefined,
    consent: parseJson(row.consent_json, undefined),
    editor: parseJson(row.editor_json, { filterId: "none", stickers: [], caption: "", adjustments: { brightness: 100, contrast: 100, saturation: 100 } }),
    photos: assets.map((asset) => `/api/admin/assets/${encodeURIComponent(asset.id)}`),
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
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("Permissions-Policy", "camera=(self), microphone=()");
    next();
  });
  app.use(express.json({ limit: "64mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, database: database.driver, storage: config.storageDriver, paymentProvider: config.paymentProvider, timestamp: new Date().toISOString() });
  });

  app.get("/api/config", asyncRoute(async (_request, response) => {
    const [theme, filters, frames] = await Promise.all([
      getSetting(database, "theme", null),
      getSetting(database, "filters", null),
      getSetting(database, "frames", null),
    ]);
    response.json({
      theme,
      filters,
      frames,
      sessionPrice: config.sessionPrice,
      paymentProvider: config.paymentProvider,
      resultRetentionHours: config.resultRetentionHours,
    });
  }));

  app.post("/api/auth/login", asyncRoute(async (request, response) => {
    const key = request.ip || "unknown";
    const attempt = loginAttempts.get(key) || { count: 0, resetAt: 0 };
    if (attempt.resetAt > Date.now() && attempt.count >= 8) {
      response.status(429).json({ error: "Terlalu banyak percobaan login. Coba kembali beberapa menit lagi." });
      return;
    }

    const username = String(request.body?.username || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const admin = await database.get("SELECT * FROM admins WHERE username = ? AND active = 1", username);
    if (!admin || !verifyPassword(password, admin.password_salt, admin.password_hash)) {
      loginAttempts.set(key, { count: attempt.count + 1, resetAt: Date.now() + 10 * 60 * 1000 });
      response.status(401).json({ error: "Username atau password admin tidak sesuai." });
      return;
    }

    loginAttempts.delete(key);
    const token = createToken();
    const now = Date.now();
    const expiresAt = now + config.adminSessionHours * 60 * 60 * 1000;
    await database.run(`
      INSERT INTO admin_sessions (id, admin_id, token_hash, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, createId("session"), admin.id, hashToken(token), now, now, expiresAt);
    response.setHeader("Set-Cookie", adminCookie(token, expiresAt, request.secure));
    response.json({ admin: { id: admin.id, username: admin.username, displayName: admin.display_name, loggedInAt: new Date(now).toISOString() } });
  }));

  app.get("/api/auth/session", asyncRoute(async (request, response) => {
    const admin = await adminFromRequest(database, request);
    if (!admin) {
      response.status(401).json({ error: "Belum login." });
      return;
    }
    response.json({ admin });
  }));

  app.post("/api/auth/logout", asyncRoute(async (request, response) => {
    const token = parseCookies(request.headers.cookie)[ADMIN_COOKIE_NAME];
    if (token) await database.run("DELETE FROM admin_sessions WHERE token_hash = ?", hashToken(token));
    response.setHeader("Set-Cookie", clearAdminCookie(request.secure));
    response.status(204).end();
  }));

  app.post("/api/payments/quote", asyncRoute(async (request, response) => {
    const quote = await getVoucherQuote(database, request.body?.voucherCode, config.sessionPrice);
    const { voucherRow: _voucherRow, ...publicQuote } = quote;
    response.status(quote.valid ? 200 : 422).json(publicQuote);
  }));

  app.post("/api/payments", asyncRoute(async (request, response) => {
    const voucherCode = String(request.body?.voucherCode || "").trim();
    const quote = voucherCode
      ? await getVoucherQuote(database, voucherCode, config.sessionPrice)
      : { valid: true, baseAmount: config.sessionPrice, discountAmount: 0, finalAmount: config.sessionPrice, voucherRow: null };
    if (!quote.valid) {
      response.status(422).json({ error: quote.reason });
      return;
    }

    const now = Date.now();
    const payment = {
      id: createId("pay"),
      orderId: `PB-${Date.now().toString(36).toUpperCase()}-${createToken(4).toUpperCase()}`,
      provider: quote.finalAmount === 0 ? "voucher" : config.paymentProvider,
      method: quote.voucherRow && quote.finalAmount === 0 ? "voucher" : "qris",
      status: quote.finalAmount === 0 ? "paid" : "pending",
      baseAmount: config.sessionPrice,
      discountAmount: quote.discountAmount,
      amount: quote.finalAmount,
      voucherId: quote.voucherRow?.id || null,
      expiresAt: now + config.paymentExpiryMinutes * 60 * 1000,
    };

    try {
      await database.transaction(async (transaction) => {
        const currentQuote = voucherCode
          ? await getVoucherQuote(transaction, voucherCode, config.sessionPrice, { lock: true })
          : { valid: true, discountAmount: 0, finalAmount: config.sessionPrice, voucherRow: null };
        if (!currentQuote.valid) {
          const voucherError = new Error(currentQuote.reason);
          voucherError.code = "VOUCHER_UNAVAILABLE";
          throw voucherError;
        }
        payment.provider = currentQuote.finalAmount === 0 ? "voucher" : config.paymentProvider;
        payment.method = currentQuote.voucherRow && currentQuote.finalAmount === 0 ? "voucher" : "qris";
        payment.status = currentQuote.finalAmount === 0 ? "paid" : "pending";
        payment.discountAmount = currentQuote.discountAmount;
        payment.amount = currentQuote.finalAmount;
        payment.voucherId = currentQuote.voucherRow?.id || null;
        await transaction.run(`
          INSERT INTO payments (id, order_id, provider, method, status, base_amount, discount_amount, amount, voucher_id, created_at, updated_at, expires_at, paid_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, payment.id, payment.orderId, payment.provider, payment.method, payment.status, payment.baseAmount, payment.discountAmount, payment.amount, payment.voucherId, now, now, payment.expiresAt, payment.status === "paid" ? now : null);
        if (payment.voucherId) {
          await transaction.run(`
            INSERT INTO voucher_redemptions (id, voucher_id, payment_id, status, created_at, redeemed_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `, createId("redeem"), payment.voucherId, payment.id, payment.status === "paid" ? "redeemed" : "reserved", now, payment.status === "paid" ? now : null);
          if (payment.status === "paid") {
            await transaction.run("UPDATE vouchers SET used_count = used_count + 1, updated_at = ? WHERE id = ?", now, payment.voucherId);
          }
        }
      }, { immediate: true });
    } catch (error) {
      if (error.code === "VOUCHER_UNAVAILABLE") {
        response.status(422).json({ error: error.message });
        return;
      }
      throw error;
    }

    if (payment.status === "paid") {
      response.status(201).json({ payment: paymentJson(await getPaymentRow(database, payment.id), request) });
      return;
    }

    try {
      const providerResult = await createProviderPayment(config, payment, `${getPublicBaseUrl(request)}/api/webhooks/midtrans`);
      await database.run(`
        UPDATE payments SET provider = ?, provider_transaction_id = ?, qr_string = ?, qr_url = ?, raw_json = ?, updated_at = ? WHERE id = ?
      `, providerResult.provider, providerResult.transactionId, providerResult.qrString, providerResult.qrUrl, JSON.stringify(providerResult.raw), Date.now(), payment.id);
      response.status(201).json({ payment: paymentJson(await getPaymentRow(database, payment.id), request) });
    } catch (error) {
      await updatePaymentStatus(database, payment, "failed", { error: error.message });
      response.status(502).json({ error: error.message });
    }
  }));

  app.get("/api/payments/:id", asyncRoute(async (request, response) => {
    let payment = await getPaymentRow(database, request.params.id);
    if (!payment) {
      response.status(404).json({ error: "Pembayaran tidak ditemukan." });
      return;
    }
    if (payment.status === "pending" && payment.provider === "midtrans" && Date.now() - payment.updated_at > 5000) {
      const providerStatus = await fetchMidtransStatus(config, payment.order_id).catch(() => null);
      if (providerStatus) {
        await updatePaymentStatus(database, payment, normalizeMidtransStatus(providerStatus), providerStatus);
        payment = await getPaymentRow(database, request.params.id);
      }
    }
    if (payment.status === "pending" && payment.expires_at <= Date.now()) {
      await updatePaymentStatus(database, payment, "expired", { reason: "local-expiry" });
      payment = await getPaymentRow(database, request.params.id);
    }
    response.json({ payment: paymentJson(payment, request) });
  }));

  app.get("/api/payments/:id/qr", asyncRoute(async (request, response) => {
    const payment = await getPaymentRow(database, request.params.id);
    if (!payment?.qr_url) {
      response.status(404).send("QR pembayaran tidak tersedia.");
      return;
    }
    const qr = await fetchMidtransQr(config, payment.qr_url);
    response.setHeader("Content-Type", qr.contentType);
    response.setHeader("Cache-Control", "private, max-age=30");
    response.send(qr.body);
  }));

  app.post("/api/payments/:id/simulate", asyncRoute(async (request, response) => {
    const payment = await getPaymentRow(database, request.params.id);
    if (!payment) {
      response.status(404).json({ error: "Pembayaran tidak ditemukan." });
      return;
    }
    if (payment.provider !== "mock" || config.paymentProvider !== "mock") {
      response.status(403).json({ error: "Simulasi hanya tersedia pada PAYMENT_PROVIDER=mock." });
      return;
    }
    await updatePaymentStatus(database, payment, "paid", { mock: true, transaction_status: "settlement" });
    response.json({ payment: paymentJson(await getPaymentRow(database, payment.id), request) });
  }));

  app.post("/api/webhooks/midtrans", asyncRoute(async (request, response) => {
    if (!verifyMidtransWebhook(config, request.body || {})) {
      response.status(401).json({ error: "Signature webhook Midtrans tidak valid." });
      return;
    }
    const payment = await getPaymentRow(database, request.body.order_id);
    if (!payment) {
      response.status(404).json({ error: "Order tidak ditemukan." });
      return;
    }
    await updatePaymentStatus(database, payment, normalizeMidtransStatus(request.body), request.body);
    response.status(200).json({ ok: true });
  }));

  app.post("/api/sessions", asyncRoute(async (request, response) => {
    const body = request.body || {};
    const sessionId = String(body.id || "");
    if (!resultIdPattern.test(sessionId)) {
      response.status(400).json({ error: "ID sesi tidak valid." });
      return;
    }
    const payment = body.payment?.id ? await getPaymentRow(database, body.payment.id) : null;
    if (config.sessionPrice > 0 && (!payment || payment.status !== "paid")) {
      response.status(402).json({ error: "Sesi membutuhkan pembayaran yang sudah terverifikasi." });
      return;
    }
    if (!body.consent?.captureAccepted || !body.consent?.privacyAccepted) {
      response.status(422).json({ error: "Persetujuan pengambilan dan penyimpanan foto wajib diberikan." });
      return;
    }
    const paymentSession = payment
      ? await database.get("SELECT id FROM photo_sessions WHERE payment_id = ? AND id <> ?", payment.id, sessionId)
      : null;
    if (paymentSession) {
      response.status(409).json({ error: "Pembayaran ini sudah digunakan oleh sesi lain." });
      return;
    }

    const now = Date.now();
    const expiresAt = now + config.rawPhotoRetentionHours * 60 * 60 * 1000;
    try {
      await database.run(`
        INSERT INTO photo_sessions (id, mode, template_id, frame_layout, result_format, payment_id, consent_json, editor_json, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET mode = excluded.mode, template_id = excluded.template_id, frame_layout = excluded.frame_layout,
          result_format = excluded.result_format, payment_id = excluded.payment_id, consent_json = excluded.consent_json,
          editor_json = excluded.editor_json, expires_at = excluded.expires_at
      `, sessionId, String(body.mode || "photo"), String(body.templateId || "han-river"), body.frameLayout || null, body.resultFormat || null, payment?.id || null, JSON.stringify(body.consent || null), JSON.stringify(body.editor || null), now, expiresAt);
    } catch (error) {
      if (String(error.code || "").startsWith("SQLITE_CONSTRAINT") || error.code === "23505") {
        response.status(409).json({ error: "Pembayaran ini sudah digunakan oleh sesi lain." });
        return;
      }
      throw error;
    }

    const existingCount = (await database.get("SELECT CAST(COUNT(*) AS INTEGER) AS count FROM media_assets WHERE session_id = ? AND kind = 'raw'", sessionId)).count;
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, 4) : [];
    if (existingCount === 0) {
      for (let index = 0; index < photos.length; index += 1) {
        const parsed = parseDataUrl(photos[index]);
        if (!parsed) continue;
        const assetId = createId("asset");
        const objectKey = `sessions/${new Date(now).toISOString().slice(0, 10)}/${sessionId}/raw-${index + 1}.${parsed.extension}`;
        await storage.putObject(objectKey, parsed.body, parsed.mimeType);
        await database.run(`
          INSERT INTO media_assets (id, session_id, kind, object_key, mime_type, extension, size_bytes, created_at, expires_at)
          VALUES (?, ?, 'raw', ?, ?, ?, ?, ?, ?)
        `, assetId, sessionId, objectKey, parsed.mimeType, parsed.extension, parsed.body.length, now + index, expiresAt);
      }
    }
    response.status(201).json({ id: sessionId, expiresAt: toIso(expiresAt) });
  }));

  app.post("/api/results/:sessionId", asyncRoute(async (request, response) => {
    const sessionId = request.params.sessionId;
    const parsed = parseDataUrl(request.body?.dataUrl);
    if (!resultIdPattern.test(sessionId) || !parsed) {
      response.status(400).json({ error: "Payload hasil tidak valid." });
      return;
    }
    const session = await database.get("SELECT * FROM photo_sessions WHERE id = ?", sessionId);
    if (!session) {
      response.status(404).json({ error: "Sesi foto belum tersimpan." });
      return;
    }

    const now = Date.now();
    const maximumExpiry = now + config.resultRetentionHours * 60 * 60 * 1000;
    const requestedExpiry = fromDateInput(request.body?.expiresAt);
    const expiresAt = requestedExpiry ? Math.min(requestedExpiry, maximumExpiry) : maximumExpiry;
    const token = createToken(24);
    const assetId = createId("result");
    const objectKey = `results/${new Date(now).toISOString().slice(0, 10)}/${token}.${parsed.extension}`;
    await storage.putObject(objectKey, parsed.body, parsed.mimeType);
    await database.run(`
      INSERT INTO media_assets (id, session_id, result_token, kind, format, object_key, mime_type, extension, size_bytes, created_at, expires_at)
      VALUES (?, ?, ?, 'result', ?, ?, ?, ?, ?, ?, ?)
    `, assetId, sessionId, token, request.body?.format === "gif" || request.body?.format === "live" ? request.body.format : "photo", objectKey, parsed.mimeType, parsed.extension, parsed.body.length, now, expiresAt);
    response.status(201).json({ id: token, downloadUrl: `${getPublicBaseUrl(request)}/download/${encodeURIComponent(token)}`, expiresAt: toIso(expiresAt) });
  }));

  app.get("/api/results/:token/file", asyncRoute(async (request, response) => {
    const asset = await database.get("SELECT * FROM media_assets WHERE result_token = ? AND kind = 'result' AND expires_at > ?", request.params.token, Date.now());
    if (!asset) {
      response.status(404).send("Hasil sesi tidak ditemukan atau sudah kedaluwarsa.");
      return;
    }
    const file = await storage.getObject(asset.object_key);
    const disposition = request.query.inline === "1" ? "inline" : "attachment";
    response.setHeader("Content-Type", asset.mime_type);
    response.setHeader("Content-Length", file.length);
    response.setHeader("Content-Disposition", `${disposition}; filename="pixiebooth-${asset.session_id}.${asset.extension}"`);
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.send(file);
  }));

  app.get("/download/:token", asyncRoute(async (request, response) => {
    const asset = await database.get(`
      SELECT ma.* FROM media_assets ma WHERE ma.result_token = ? AND ma.kind = 'result' AND ma.expires_at > ?
    `, request.params.token, Date.now());
    if (!asset) {
      response.status(404).send("<!doctype html><title>Hasil tidak ditemukan</title><p>Hasil sesi tidak ditemukan atau sudah kedaluwarsa.</p>");
      return;
    }
    const theme = await getSetting(database, "theme", {});
    const brandName = escapeHtml(theme?.brandName || "PixieBooth");
    const token = encodeURIComponent(asset.result_token);
    const formatLabel = asset.format === "gif" ? "GIF" : asset.format === "live" ? "Live Photo" : "Foto";
    const preview = asset.mime_type === "video/webm"
      ? `<video src="/api/results/${token}/file?inline=1" autoplay loop muted playsinline controls></video>`
      : `<img src="/api/results/${token}/file?inline=1" alt="Hasil photobooth" />`;
    response.type("html").send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Download · ${brandName}</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;font-family:system-ui,sans-serif;color:#3b0764;background:linear-gradient(135deg,#fef0f9,#fdf4ff,#f5e8ff)}
main{width:min(100%,520px);text-align:center}img,video{display:block;width:min(100%,420px);max-height:70vh;margin:0 auto;object-fit:contain;border:8px solid #fff;border-radius:12px;box-shadow:0 18px 48px #4c1d952e}h1{margin:20px 0 6px;font-size:24px}p{margin:0 0 18px;color:#7e5a94}a{display:inline-flex;min-height:48px;align-items:center;justify-content:center;border-radius:10px;padding:0 24px;color:#fff;background:linear-gradient(90deg,#ec4899,#8b5cf6);font-weight:800;text-decoration:none}
</style></head><body><main>${preview}<h1>Hasil ${formatLabel} · ${brandName}</h1><p>Hasil sesi siap disimpan ke perangkatmu.</p><a href="/api/results/${token}/file">Download ${asset.extension.toUpperCase()}</a></main></body></html>`);
  }));

  app.post("/api/booths/:id/heartbeat", asyncRoute(async (request, response) => {
    const booth = await database.get("SELECT * FROM booths WHERE id = ?", request.params.id);
    if (!booth) {
      response.status(404).json({ error: "Booth tidak terdaftar." });
      return;
    }
    const token = String(request.headers["x-booth-token"] || "");
    if (booth.token_hash && (!token || !safeEqualText(hashToken(token), booth.token_hash))) {
      response.status(401).json({ error: "Token booth tidak valid." });
      return;
    }
    const now = Date.now();
    const status = typeof request.body?.status === "object" && request.body.status ? request.body.status : {};
    await database.run("UPDATE booths SET last_seen_at = ?, status_json = ?, version = ?, updated_at = ? WHERE id = ?", now, JSON.stringify(status), String(request.body?.version || "").slice(0, 80) || null, now, booth.id);
    response.json({ ok: true, serverTime: new Date(now).toISOString() });
  }));

  app.get("/api/admin/bootstrap", requireAdmin, asyncRoute(async (request, response) => {
    const [sessionRows, voucherRows, boothRows, theme, filters, frames] = await Promise.all([
      database.all("SELECT * FROM photo_sessions ORDER BY created_at DESC LIMIT 500"),
      database.all("SELECT * FROM vouchers ORDER BY created_at DESC"),
      database.all("SELECT * FROM booths ORDER BY name"),
      getSetting(database, "theme", null),
      getSetting(database, "filters", null),
      getSetting(database, "frames", null),
    ]);
    const sessions = await Promise.all(sessionRows.map((row) => serializeSession(database, row)));
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
      vouchers,
      booths,
    });
  }));

  app.put("/api/admin/config", requireAdmin, asyncRoute(async (request, response) => {
    const updates = [];
    if (request.body?.theme && typeof request.body.theme === "object") updates.push(setSetting(database, "theme", request.body.theme));
    if (Array.isArray(request.body?.filters)) updates.push(setSetting(database, "filters", request.body.filters));
    if (Array.isArray(request.body?.frames)) updates.push(setSetting(database, "frames", request.body.frames));
    await Promise.all(updates);
    response.json({ ok: true });
  }));

  app.post("/api/admin/vouchers", requireAdmin, asyncRoute(async (request, response) => {
    const code = String(request.body?.code || "").trim().toUpperCase();
    const discountType = request.body?.discountType === "percent" ? "percent" : "fixed";
    const discountValue = Math.round(Number(request.body?.discountValue));
    const maxUses = request.body?.maxUses === null || request.body?.maxUses === "" ? null : Math.round(Number(request.body?.maxUses));
    if (!voucherCodePattern.test(code)) {
      response.status(400).json({ error: "Kode harus 3-32 karakter: huruf, angka, _ atau -." });
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percent" && discountValue > 100)) {
      response.status(400).json({ error: "Nilai diskon tidak valid." });
      return;
    }
    if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
      response.status(400).json({ error: "Kuota voucher minimal 1." });
      return;
    }
    const now = Date.now();
    try {
      const id = createId("voucher");
      await database.run(`
        INSERT INTO vouchers (id, code, discount_type, discount_value, max_uses, starts_at, expires_at, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, id, code, discountType, discountValue, maxUses, fromDateInput(request.body?.startsAt), fromDateInput(request.body?.expiresAt), request.body?.active === false ? 0 : 1, now, now);
      response.status(201).json({ voucher: voucherJson(await database.get("SELECT * FROM vouchers WHERE id = ?", id)) });
    } catch (error) {
      if (String(error.message).includes("UNIQUE") || error.code === "23505") {
        response.status(409).json({ error: "Kode voucher sudah digunakan." });
        return;
      }
      throw error;
    }
  }));

  app.patch("/api/admin/vouchers/:id", requireAdmin, asyncRoute(async (request, response) => {
    const voucher = await database.get("SELECT * FROM vouchers WHERE id = ?", request.params.id);
    if (!voucher) {
      response.status(404).json({ error: "Voucher tidak ditemukan." });
      return;
    }
    const active = request.body?.active === undefined ? voucher.active : request.body.active ? 1 : 0;
    await database.run("UPDATE vouchers SET active = ?, updated_at = ? WHERE id = ?", active, Date.now(), voucher.id);
    response.json({ voucher: voucherJson(await database.get("SELECT * FROM vouchers WHERE id = ?", voucher.id)) });
  }));

  app.delete("/api/admin/vouchers/:id", requireAdmin, asyncRoute(async (request, response) => {
    const result = await database.run(`
      DELETE FROM vouchers
      WHERE id = ? AND used_count = 0
        AND NOT EXISTS (
          SELECT 1 FROM voucher_redemptions
          WHERE voucher_redemptions.voucher_id = vouchers.id AND voucher_redemptions.status = 'reserved'
        )
    `, request.params.id);
    if (result.changes === 0) {
      response.status(409).json({ error: "Voucher terpakai tidak dapat dihapus; nonaktifkan saja." });
      return;
    }
    response.status(204).end();
  }));

  app.get("/api/admin/assets/:id", requireAdmin, asyncRoute(async (request, response) => {
    const asset = await database.get("SELECT * FROM media_assets WHERE id = ? AND expires_at > ?", request.params.id, Date.now());
    if (!asset) {
      response.status(404).send("Asset tidak ditemukan.");
      return;
    }
    const file = await storage.getObject(asset.object_key);
    response.setHeader("Content-Type", asset.mime_type);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(file);
  }));

  app.delete("/api/admin/sessions", requireAdmin, asyncRoute(async (_request, response) => {
    const assets = await database.all("SELECT object_key FROM media_assets");
    for (const asset of assets) await storage.deleteObject(asset.object_key).catch(() => undefined);
    await database.run("DELETE FROM photo_sessions");
    response.status(204).end();
  }));

  app.post("/api/admin/retention/run", requireAdmin, asyncRoute(async (_request, response) => {
    response.json(await runRetention(database, storage));
  }));

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "Endpoint API tidak ditemukan." });
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ error: "Terjadi kesalahan pada server.", detail: config.nodeEnv === "development" ? error.message : undefined });
  });

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
