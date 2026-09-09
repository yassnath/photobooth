import { Router } from "express";
import {
  ADMIN_COOKIE_NAME,
  adminCookie,
  clearAdminCookie,
  createId,
  createToken,
  hashPassword,
  hashToken,
  parseCookies,
  verifyPassword,
} from "../lib/security.mjs";

const usernamePattern = /^[a-z0-9_.-]{3,32}$/;
const loginAttempts = new Map();

// Periodic pruning of expired login rate limit entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if (record.resetAt <= now) {
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

export function adminAccountJson(row, currentAdminId = null) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    active: Boolean(row.active),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    isCurrent: row.id === currentAdminId,
  };
}

export async function adminFromRequest(database, request) {
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

export function createAdminMiddleware(database) {
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

export function createAuthRouter({ database, config, writeAdminAuditLog }) {
  const router = Router();
  const requireAdmin = createAdminMiddleware(database);

  router.post("/login", asyncRoute(async (request, response) => {
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

  router.get("/session", asyncRoute(async (request, response) => {
    const admin = await adminFromRequest(database, request);
    if (!admin) {
      response.status(401).json({ error: "Belum login." });
      return;
    }
    response.json({ admin });
  }));

  router.post("/logout", asyncRoute(async (request, response) => {
    const token = parseCookies(request.headers.cookie)[ADMIN_COOKIE_NAME];
    if (token) await database.run("DELETE FROM admin_sessions WHERE token_hash = ?", hashToken(token));
    response.setHeader("Set-Cookie", clearAdminCookie(request.secure));
    response.status(204).end();
  }));

  return { router, requireAdmin };
}

export function createAdminManagementRouter({ database, writeAdminAuditLog, requireAdmin }) {
  const router = Router();

  router.get("/admins", requireAdmin, asyncRoute(async (request, response) => {
    const rows = await database.all("SELECT id, username, display_name, active, created_at, updated_at FROM admins ORDER BY created_at DESC");
    response.json({ admins: rows.map((row) => adminAccountJson(row, request.admin.id)) });
  }));

  router.post("/admins", requireAdmin, asyncRoute(async (request, response) => {
    const username = String(request.body?.username || "").trim().toLowerCase();
    const displayName = String(request.body?.displayName || username).trim();
    const password = String(request.body?.password || "");
    if (!usernamePattern.test(username)) {
      response.status(400).json({ error: "Username harus 3-32 karakter: huruf kecil, angka, titik, _ atau -." });
      return;
    }
    if (password.length < 8) {
      response.status(400).json({ error: "Password admin minimal 8 karakter." });
      return;
    }
    if (displayName.length < 2) {
      response.status(400).json({ error: "Nama tampilan minimal 2 karakter." });
      return;
    }

    const now = Date.now();
    const hashed = hashPassword(password);
    const id = createId("admin");
    try {
      await database.run(`
        INSERT INTO admins (id, username, display_name, password_hash, password_salt, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `, id, username, displayName.slice(0, 120), hashed.hash, hashed.salt, now, now);
      await writeAdminAuditLog(database, request.admin.id, "admin.create", "admin", id, { username }).catch(() => undefined);
      const admin = await database.get("SELECT id, username, display_name, active, created_at, updated_at FROM admins WHERE id = ?", id);
      response.status(201).json({ admin: adminAccountJson(admin, request.admin.id) });
    } catch (error) {
      if (String(error.message).includes("UNIQUE") || error.code === "23505") {
        response.status(409).json({ error: "Username admin sudah digunakan." });
        return;
      }
      throw error;
    }
  }));

  router.patch("/admins/:id", requireAdmin, asyncRoute(async (request, response) => {
    const target = await database.get("SELECT * FROM admins WHERE id = ?", request.params.id);
    if (!target) {
      response.status(404).json({ error: "Admin tidak ditemukan." });
      return;
    }

    const nextActive = request.body?.active === undefined ? target.active : request.body.active ? 1 : 0;
    if (target.id === request.admin.id && !nextActive) {
      response.status(400).json({ error: "Admin aktif tidak dapat menonaktifkan akunnya sendiri." });
      return;
    }

    const displayName = request.body?.displayName === undefined
      ? target.display_name
      : String(request.body.displayName || "").trim().slice(0, 120);
    const password = request.body?.password === undefined ? "" : String(request.body.password || "");

    if (displayName.length < 2) {
      response.status(400).json({ error: "Nama tampilan minimal 2 karakter." });
      return;
    }
    if (password && password.length < 8) {
      response.status(400).json({ error: "Password admin minimal 8 karakter." });
      return;
    }

    const now = Date.now();
    if (password) {
      const hashed = hashPassword(password);
      await database.run(`
        UPDATE admins
        SET display_name = ?, password_hash = ?, password_salt = ?, active = ?, updated_at = ?
        WHERE id = ?
      `, displayName, hashed.hash, hashed.salt, nextActive, now, target.id);
      await database.run("DELETE FROM admin_sessions WHERE admin_id = ?", target.id);
    } else {
      await database.run("UPDATE admins SET display_name = ?, active = ?, updated_at = ? WHERE id = ?", displayName, nextActive, now, target.id);
      if (!nextActive) await database.run("DELETE FROM admin_sessions WHERE admin_id = ?", target.id);
    }

    await writeAdminAuditLog(database, request.admin.id, "admin.update", "admin", target.id, { username: target.username, active: Boolean(nextActive) }).catch(() => undefined);
    const admin = await database.get("SELECT id, username, display_name, active, created_at, updated_at FROM admins WHERE id = ?", target.id);
    response.json({ admin: adminAccountJson(admin, request.admin.id) });
  }));

  router.delete("/admins/:id", requireAdmin, asyncRoute(async (request, response) => {
    const target = await database.get("SELECT * FROM admins WHERE id = ?", request.params.id);
    if (!target) {
      response.status(404).json({ error: "Admin tidak ditemukan." });
      return;
    }
    if (target.id === request.admin.id) {
      response.status(400).json({ error: "Admin aktif tidak dapat menonaktifkan akunnya sendiri." });
      return;
    }
    await database.run("UPDATE admins SET active = 0, updated_at = ? WHERE id = ?", Date.now(), target.id);
    await database.run("DELETE FROM admin_sessions WHERE admin_id = ?", target.id);
    await writeAdminAuditLog(database, request.admin.id, "admin.deactivate", "admin", target.id, { username: target.username }).catch(() => undefined);
    response.status(204).end();
  }));

  return router;
}
