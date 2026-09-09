import { Router } from "express";
import { getPublicBaseUrl } from "../config.mjs";
import { createId, createToken } from "../lib/security.mjs";
import { getThemeConfig } from "../lib/database.mjs";
import { runRetention } from "../services/retention.mjs";
import { getPaymentRow } from "./payments.mjs";

const resultIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

export function createSessionsRouter({ database, storage, config, requireAdmin, writeAdminAuditLog }) {
  const router = Router();

  router.post("/", asyncRoute(async (request, response) => {
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
      ? await database.get("SELECT id FROM sessions WHERE order_id = ? AND id <> ?", payment.id, sessionId)
      : null;
    if (paymentSession) {
      response.status(409).json({ error: "Pembayaran ini sudah digunakan oleh sesi lain." });
      return;
    }

    const now = Date.now();
    const expiresAt = now + config.rawPhotoRetentionHours * 60 * 60 * 1000;
    try {
      await database.run(`
        INSERT INTO sessions (id, mode, template_id, frame_layout, result_format, order_id, consent_json, editor_json, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET mode = excluded.mode, template_id = excluded.template_id, frame_layout = excluded.frame_layout,
          result_format = excluded.result_format, order_id = excluded.order_id, consent_json = excluded.consent_json,
          editor_json = excluded.editor_json, expires_at = excluded.expires_at
      `, sessionId, String(body.mode || "photo"), String(body.templateId || "han-river"), body.frameLayout || null, body.resultFormat || null, payment?.id || null, JSON.stringify(body.consent || null), JSON.stringify(body.editor || null), now, expiresAt);
    } catch (error) {
      if (String(error.code || "").startsWith("SQLITE_CONSTRAINT") || error.code === "23505") {
        response.status(409).json({ error: "Pembayaran ini sudah digunakan oleh sesi lain." });
        return;
      }
      throw error;
    }

    const existingCount = (await database.get("SELECT CAST(COUNT(*) AS INTEGER) AS count FROM photos WHERE session_id = ? AND kind = 'raw'", sessionId)).count;
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, 4) : [];
    if (existingCount === 0) {
      for (let index = 0; index < photos.length; index += 1) {
        const parsed = parseDataUrl(photos[index]);
        if (!parsed) continue;
        const assetId = createId("asset");
        const objectKey = `sessions/${new Date(now).toISOString().slice(0, 10)}/${sessionId}/raw-${index + 1}.${parsed.extension}`;
        await storage.putObject(objectKey, parsed.body, parsed.mimeType);
        await database.run(`
          INSERT INTO photos (id, session_id, kind, object_key, mime_type, extension, size_bytes, created_at, expires_at)
          VALUES (?, ?, 'raw', ?, ?, ?, ?, ?, ?)
        `, assetId, sessionId, objectKey, parsed.mimeType, parsed.extension, parsed.body.length, now + index, expiresAt);
      }
    }
    response.status(201).json({ id: sessionId, expiresAt: toIso(expiresAt) });
  }));

  return router;
}

export function createResultsRouter({ database, storage, config }) {
  const router = Router();

  router.post("/:sessionId", asyncRoute(async (request, response) => {
    const sessionId = request.params.sessionId;
    const parsed = parseDataUrl(request.body?.dataUrl);
    if (!resultIdPattern.test(sessionId) || !parsed) {
      response.status(400).json({ error: "Payload hasil tidak valid." });
      return;
    }
    const session = await database.get("SELECT * FROM sessions WHERE id = ?", sessionId);
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
      INSERT INTO photos (id, session_id, result_token, kind, format, object_key, mime_type, extension, size_bytes, created_at, expires_at)
      VALUES (?, ?, ?, 'result', ?, ?, ?, ?, ?, ?, ?)
    `, assetId, sessionId, token, request.body?.format === "gif" || request.body?.format === "live" ? request.body.format : "photo", objectKey, parsed.mimeType, parsed.extension, parsed.body.length, now, expiresAt);
    response.status(201).json({ id: token, downloadUrl: `${getPublicBaseUrl(request)}/download/${encodeURIComponent(token)}`, expiresAt: toIso(expiresAt) });
  }));

  router.get("/:token/file", asyncRoute(async (request, response) => {
    const asset = await database.get("SELECT * FROM photos WHERE result_token = ? AND kind = 'result' AND expires_at > ?", request.params.token, Date.now());
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

  return router;
}

export function createDownloadRouter({ database }) {
  const router = Router();

  router.get("/:token", asyncRoute(async (request, response) => {
    const asset = await database.get(`
      SELECT ma.* FROM photos ma WHERE ma.result_token = ? AND ma.kind = 'result' AND ma.expires_at > ?
    `, request.params.token, Date.now());
    if (!asset) {
      response.status(404).send("<!doctype html><title>Hasil tidak ditemukan</title><p>Hasil sesi tidak ditemukan atau sudah kedaluwarsa.</p>");
      return;
    }
    const theme = await getThemeConfig(database, {});
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

  return router;
}

export function createAdminMediaRouter({ database, storage, requireAdmin, writeAdminAuditLog }) {
  const router = Router();

  router.get("/assets/:id", requireAdmin, asyncRoute(async (request, response) => {
    const asset = await database.get("SELECT * FROM photos WHERE id = ? AND expires_at > ?", request.params.id, Date.now());
    if (!asset) {
      response.status(404).send("Asset tidak ditemukan.");
      return;
    }
    const file = await storage.getObject(asset.object_key);
    response.setHeader("Content-Type", asset.mime_type);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(file);
  }));

  router.delete("/sessions", requireAdmin, asyncRoute(async (request, response) => {
    const assets = await database.all("SELECT object_key FROM photos");
    for (const asset of assets) await storage.deleteObject(asset.object_key).catch(() => undefined);
    await database.run("DELETE FROM sessions");
    await writeAdminAuditLog(database, request.admin.id, "sessions.clear", "sessions").catch(() => undefined);
    response.status(204).end();
  }));

  router.post("/retention/run", requireAdmin, asyncRoute(async (_request, response) => {
    response.json(await runRetention(database, storage));
  }));

  return router;
}
