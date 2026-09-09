import { Router } from "express";
import { hashToken, safeEqualText } from "../lib/security.mjs";
import { writeBoothEvent } from "../lib/database.mjs";

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export function createBoothsRouter({ database }) {
  const router = Router();

  router.post("/:id/heartbeat", asyncRoute(async (request, response) => {
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
    if (status?.printer?.available === false || status?.camera?.available === false) {
      await writeBoothEvent(
        database,
        booth.id,
        "warning",
        status?.printer?.available === false ? "printer_unavailable" : "camera_unavailable",
        status?.printer?.error || status?.camera?.error || "Device status reported unavailable.",
        status,
      ).catch(() => undefined);
    }
    response.json({ ok: true, serverTime: new Date(now).toISOString() });
  }));

  return router;
}
