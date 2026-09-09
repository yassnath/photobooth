import { Router } from "express";
import {
  getFilterPresetsConfig,
  getFrameDesignsConfig,
  getThemeConfig,
  replaceFilterPresetsConfig,
  replaceFrameDesignsConfig,
  setThemeConfig,
} from "../lib/database.mjs";

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export function createPublicConfigRouter({ database, config }) {
  const router = Router();

  router.get("/", asyncRoute(async (_request, response) => {
    const [theme, filters, frames] = await Promise.all([
      getThemeConfig(database, null),
      getFilterPresetsConfig(database, null),
      getFrameDesignsConfig(database, null),
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

  return router;
}

export function createAdminConfigRouter({ database, requireAdmin, writeAdminAuditLog }) {
  const router = Router();

  router.put("/config", requireAdmin, asyncRoute(async (request, response) => {
    const updates = [];
    const changed = [];
    if (request.body?.theme && typeof request.body.theme === "object") {
      updates.push(setThemeConfig(database, request.body.theme));
      changed.push("theme");
    }
    if (Array.isArray(request.body?.filters)) {
      updates.push(replaceFilterPresetsConfig(database, request.body.filters));
      changed.push("filters");
    }
    if (Array.isArray(request.body?.frames)) {
      updates.push(replaceFrameDesignsConfig(database, request.body.frames));
      changed.push("frames");
    }
    await Promise.all(updates);
    if (changed.length > 0) {
      await writeAdminAuditLog(database, request.admin.id, "config.update", "config", changed.join(","), { changed }).catch(() => undefined);
    }
    response.json({ ok: true });
  }));

  return router;
}
