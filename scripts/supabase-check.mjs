import "dotenv/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import { createApplication } from "../server/app.mjs";
import { config as baseConfig } from "../server/config.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (baseConfig.databaseDriver !== "postgres" || !baseConfig.databaseUrl) {
  throw new Error("test:supabase membutuhkan DATABASE_DRIVER=postgres dan DATABASE_URL.");
}

const testRoot = await mkdtemp(join(tmpdir(), "pixiebooth-supabase-"));
const startedAt = Date.now();
const suffix = startedAt.toString(36).toUpperCase();
const sessionId = `supabase-test-${suffix}`;
let voucherId = null;
let paymentId = null;
let adminId = null;
let createdAdminId = null;

const testConfig = {
  ...baseConfig,
  dataDir: testRoot,
  localObjectDir: join(testRoot, "objects"),
  publicAppUrl: "",
  storageDriver: "local",
  paymentProvider: "mock",
  nodeEnv: "test",
};

const application = await createApplication(testConfig);
const server = application.app.listen(0, "127.0.0.1");
await new Promise((resolveReady) => server.once("listening", resolveReady));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
let cookie = "";

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, payload };
}

try {
  const health = await request("/api/health");
  assert(health.response.ok && health.payload.database === "postgres", "API tidak menggunakan PostgreSQL Supabase.");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: {
      username: testConfig.adminBootstrap.username,
      password: testConfig.adminBootstrap.password,
    },
  });
  assert(login.response.ok, "Login admin melalui Supabase gagal.");
  adminId = login.payload.admin.id;

  const createdAdmin = await request("/api/admin/admins", {
    method: "POST",
    body: { username: `sbop${suffix.toLowerCase()}`.slice(0, 32), displayName: "Supabase Operator", password: "operator-password" },
  });
  assert(createdAdmin.response.status === 201, "Admin Supabase gagal dibuat.");
  createdAdminId = createdAdmin.payload.admin.id;
  const deactivateAdmin = await request(`/api/admin/admins/${encodeURIComponent(createdAdminId)}`, { method: "DELETE" });
  assert(deactivateAdmin.response.status === 204, "Admin Supabase gagal dinonaktifkan.");

  const voucher = await request("/api/admin/vouchers", {
    method: "POST",
    body: {
      code: `SB${suffix}`,
      discountType: "percent",
      discountValue: 25,
      maxUses: 1,
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
  });
  assert(voucher.response.status === 201, "Voucher Supabase gagal dibuat.");
  voucherId = voucher.payload.voucher.id;

  const paymentAttempts = await Promise.all([
    request("/api/payments", { method: "POST", body: { voucherCode: voucher.payload.voucher.code } }),
    request("/api/payments", { method: "POST", body: { voucherCode: voucher.payload.voucher.code } }),
  ]);
  const successfulPayments = paymentAttempts.filter((attempt) => attempt.response.status === 201);
  const rejectedPayments = paymentAttempts.filter((attempt) => attempt.response.status === 422);
  assert(successfulPayments.length === 1 && rejectedPayments.length === 1, "Lock kuota voucher Supabase tidak konsisten.");
  const [paymentCreated] = successfulPayments;
  paymentId = paymentCreated.payload.payment.id;

  const paymentPaid = await request(`/api/payments/${encodeURIComponent(paymentId)}/simulate`, { method: "POST" });
  assert(paymentPaid.payload.payment.status === "paid", "Payment Supabase tidak menjadi paid.");

  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const savedSession = await request("/api/sessions", {
    method: "POST",
    body: {
      id: sessionId,
      mode: "photo",
      templateId: "han-river",
      frameLayout: "1x1",
      resultFormat: "photo",
      payment: paymentPaid.payload.payment,
      consent: { captureAccepted: true, privacyAccepted: true, gallerySharingAllowed: false },
      editor: { filterId: "none", stickers: [], caption: "", adjustments: { brightness: 100, contrast: 100, saturation: 100 } },
      photos: [tinyPng],
    },
  });
  assert(savedSession.response.status === 201, "Sesi foto Supabase gagal disimpan.");

  const result = await request(`/api/results/${encodeURIComponent(sessionId)}`, {
    method: "POST",
    body: { dataUrl: tinyPng, format: "photo" },
  });
  assert(result.response.status === 201, "Metadata hasil Supabase gagal disimpan.");

  const bootstrap = await request("/api/admin/bootstrap");
  assert(bootstrap.response.ok, "Dashboard bootstrap Supabase gagal.");
  assert(bootstrap.payload.sessions.some((session) => session.id === sessionId), "Sesi Supabase tidak muncul di dashboard.");
  assert(bootstrap.payload.orders.some((order) => order.id === paymentId && order.sessionId === sessionId), "Order Supabase tidak muncul di dashboard.");
  assert(bootstrap.payload.vouchers.some((item) => item.id === voucherId && item.usedCount === 1), "Kuota voucher Supabase tidak diperbarui.");

  console.log("Supabase integration passed: PostgreSQL auth, admin management, voucher, payment, media metadata, and dashboard.");
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  await application.database.transaction(async (database) => {
    await database.run("DELETE FROM sessions WHERE id = ?", sessionId);
    if (paymentId) {
      await database.run("DELETE FROM orders WHERE id = ?", paymentId);
    }
    if (voucherId) await database.run("DELETE FROM vouchers WHERE id = ?", voucherId);
    if (createdAdminId) await database.run("DELETE FROM admins WHERE id = ?", createdAdminId);
    if (adminId) await database.run("DELETE FROM admin_sessions WHERE admin_id = ? AND created_at >= ?", adminId, startedAt);
  });
  await application.close();
  const resolvedTemp = resolve(tmpdir());
  const resolvedTestRoot = resolve(testRoot);
  if (resolvedTestRoot.startsWith(resolvedTemp + sep)) {
    await rm(resolvedTestRoot, { recursive: true, force: true });
  }
}
