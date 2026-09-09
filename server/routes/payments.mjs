import { Router } from "express";
import { getPublicBaseUrl } from "../config.mjs";
import { createId, createToken } from "../lib/security.mjs";
import {
  createProviderPayment,
  fetchMidtransQr,
  fetchMidtransStatus,
  normalizeMidtransStatus,
  verifyMidtransWebhook,
} from "../services/payments.mjs";

const voucherCodePattern = /^[A-Z0-9_-]{3,32}$/;

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function fromDateInput(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function paymentJson(row, request) {
  if (!row) return null;
  const baseUrl = getPublicBaseUrl(request);
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
    qrString: row.qr_string || undefined,
    qrImageUrl: row.qr_url ? `${baseUrl}/api/payments/${encodeURIComponent(row.id)}/qr` : undefined,
    expiresAt: toIso(row.expires_at),
    paidAt: toIso(row.paid_at),
  };
}

export function voucherJson(row) {
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

export async function getPaymentRow(database, idOrOrderId) {
  return database.get(`
    SELECT o.*, v.code AS voucher_code, s.id AS session_id, s.result_format, s.frame_layout
    FROM orders o
    LEFT JOIN vouchers v ON v.id = o.voucher_id
    LEFT JOIN sessions s ON s.order_id = o.id
    WHERE o.id = ? OR o.code = ?
  `, idOrOrderId, idOrOrderId);
}

export async function updatePaymentStatus(database, payment, status, rawPayload) {
  const now = Date.now();
  await database.transaction(async (transaction) => {
    const paymentLock = transaction.driver === "postgres" ? " FOR UPDATE" : "";
    const current = await transaction.get(`SELECT status, voucher_id FROM orders WHERE id = ?${paymentLock}`, payment.id);
    if (!current) return;
    if (current.status === "paid" && status !== "paid") return;
    if (current.status === status) {
      await transaction.run("UPDATE orders SET raw_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(rawPayload || {}), now, payment.id);
      return;
    }

    await transaction.run(`
      UPDATE orders
      SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE paid_at END,
          raw_json = ?, updated_at = ?
      WHERE id = ?
    `, status, status, now, JSON.stringify(rawPayload || {}), now, payment.id);

    if (current.voucher_id && status === "paid") {
      await transaction.run("UPDATE vouchers SET used_count = used_count + 1, updated_at = ? WHERE id = ?", now, current.voucher_id);
    }
  });
}

export async function getVoucherQuote(database, code, baseAmount, options = {}) {
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
    FROM orders
    WHERE voucher_id = ? AND status = 'pending' AND expires_at > ?
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

export function createPaymentsRouter({ database, config }) {
  const router = Router();

  router.post("/quote", asyncRoute(async (request, response) => {
    const quote = await getVoucherQuote(database, request.body?.voucherCode, config.sessionPrice);
    const { voucherRow: _voucherRow, ...publicQuote } = quote;
    response.status(quote.valid ? 200 : 422).json(publicQuote);
  }));

  router.post("/", asyncRoute(async (request, response) => {
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
          INSERT INTO orders (id, code, provider, method, status, base_amount, discount_amount, total_amount, voucher_id, created_at, updated_at, expires_at, paid_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, payment.id, payment.orderId, payment.provider, payment.method, payment.status, payment.baseAmount, payment.discountAmount, payment.amount, payment.voucherId, now, now, payment.expiresAt, payment.status === "paid" ? now : null);
        if (payment.voucherId && payment.status === "paid") {
          await transaction.run("UPDATE vouchers SET used_count = used_count + 1, updated_at = ? WHERE id = ?", now, payment.voucherId);
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
        UPDATE orders SET provider = ?, provider_transaction_id = ?, qr_string = ?, qr_url = ?, raw_json = ?, updated_at = ? WHERE id = ?
      `, providerResult.provider, providerResult.transactionId, providerResult.qrString, providerResult.qrUrl, JSON.stringify(providerResult.raw), Date.now(), payment.id);
      response.status(201).json({ payment: paymentJson(await getPaymentRow(database, payment.id), request) });
    } catch (error) {
      await updatePaymentStatus(database, payment, "failed", { error: error.message });
      response.status(502).json({ error: error.message });
    }
  }));

  router.get("/:id", asyncRoute(async (request, response) => {
    let payment = await getPaymentRow(database, request.params.id);
    if (!payment) {
      response.status(404).json({ error: "Pembayaran tidak ditemukan." });
      return;
    }
    if (payment.status === "pending" && payment.provider === "midtrans" && Date.now() - payment.updated_at > 5000) {
      const providerStatus = await fetchMidtransStatus(config, payment.code).catch(() => null);
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

  router.get("/:id/qr", asyncRoute(async (request, response) => {
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

  router.post("/:id/simulate", asyncRoute(async (request, response) => {
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

  return router;
}

export function createWebhooksRouter({ database, config }) {
  const router = Router();

  router.post("/midtrans", asyncRoute(async (request, response) => {
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

  return router;
}

export function createVouchersManagementRouter({ database, writeAdminAuditLog, requireAdmin }) {
  const router = Router();

  router.post("/vouchers", requireAdmin, asyncRoute(async (request, response) => {
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
      await writeAdminAuditLog(database, request.admin.id, "voucher.create", "voucher", id, { code, discountType, discountValue, maxUses }).catch(() => undefined);
      response.status(201).json({ voucher: voucherJson(await database.get("SELECT * FROM vouchers WHERE id = ?", id)) });
    } catch (error) {
      if (String(error.message).includes("UNIQUE") || error.code === "23505") {
        response.status(409).json({ error: "Kode voucher sudah digunakan." });
        return;
      }
      throw error;
    }
  }));

  router.patch("/vouchers/:id", requireAdmin, asyncRoute(async (request, response) => {
    const voucher = await database.get("SELECT * FROM vouchers WHERE id = ?", request.params.id);
    if (!voucher) {
      response.status(404).json({ error: "Voucher tidak ditemukan." });
      return;
    }
    const body = request.body || {};
    const active = body.active === undefined ? voucher.active : body.active ? 1 : 0;

    const discountType = body.discountType !== undefined
      ? (body.discountType === "percent" ? "percent" : "fixed")
      : voucher.discount_type;
    const discountValue = body.discountValue !== undefined
      ? Math.round(Number(body.discountValue))
      : voucher.discount_value;
    const maxUses = body.maxUses !== undefined
      ? (body.maxUses === null || body.maxUses === "" ? null : Math.round(Number(body.maxUses)))
      : voucher.max_uses;
    const startsAt = body.startsAt !== undefined ? fromDateInput(body.startsAt) : voucher.starts_at;
    const expiresAt = body.expiresAt !== undefined ? fromDateInput(body.expiresAt) : voucher.expires_at;

    if (body.discountValue !== undefined && (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percent" && discountValue > 100))) {
      response.status(400).json({ error: "Nilai diskon tidak valid." });
      return;
    }

    await database.run(
      "UPDATE vouchers SET discount_type = ?, discount_value = ?, max_uses = ?, starts_at = ?, expires_at = ?, active = ?, updated_at = ? WHERE id = ?",
      discountType, discountValue, maxUses, startsAt, expiresAt, active, Date.now(), voucher.id
    );
    await writeAdminAuditLog(database, request.admin.id, "voucher.update", "voucher", voucher.id, { code: voucher.code, active: Boolean(active) }).catch(() => undefined);
    response.json({ voucher: voucherJson(await database.get("SELECT * FROM vouchers WHERE id = ?", voucher.id)) });
  }));

  router.delete("/vouchers/:id", requireAdmin, asyncRoute(async (request, response) => {
    const now = Date.now();
    const result = await database.run(`
      DELETE FROM vouchers
      WHERE id = ? AND used_count = 0
        AND NOT EXISTS (
          SELECT 1 FROM orders
          WHERE orders.voucher_id = vouchers.id AND orders.status = 'pending' AND orders.expires_at > ?
        )
    `, request.params.id, now);
    if (result.changes === 0) {
      response.status(409).json({ error: "Voucher terpakai tidak dapat dihapus; nonaktifkan saja." });
      return;
    }
    await writeAdminAuditLog(database, request.admin.id, "voucher.delete", "voucher", request.params.id).catch(() => undefined);
    response.status(204).end();
  }));

  return router;
}
