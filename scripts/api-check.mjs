import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import { createApplication } from "../server/app.mjs";
import { config as baseConfig } from "../server/config.mjs";
import { verifyMidtransWebhook } from "../server/services/payments.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const testRoot = await mkdtemp(join(tmpdir(), "pixiebooth-api-"));
const testConfig = {
  ...baseConfig,
  dataDir: testRoot,
  databasePath: join(testRoot, "test.sqlite"),
  databaseDriver: "sqlite",
  databaseUrl: "",
  localObjectDir: join(testRoot, "objects"),
  publicAppUrl: "",
  paymentProvider: "mock",
  storageDriver: "local",
  sessionPrice: 25_000,
  resultRetentionHours: 1,
  rawPhotoRetentionHours: 1,
  nodeEnv: "test",
  adminBootstrap: {
    username: "admin",
    password: "integration-password",
    displayName: "Integration Admin",
  },
  booth: {
    id: "test-booth",
    name: "Test Booth",
    agentToken: "agent-test-token",
  },
};

const application = await createApplication(testConfig);
const server = application.app.listen(0, "127.0.0.1");
await new Promise((resolveReady) => server.once("listening", resolveReady));
const address = server.address();
const baseUrl = "http://127.0.0.1:" + address.port;
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
  const unauthenticated = await request("/api/admin/bootstrap");
  assert(unauthenticated.response.status === 401, "Admin bootstrap must reject unauthenticated access.");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "integration-password" },
  });
  assert(login.response.ok && login.payload.admin.username === "admin", "Admin login failed.");
  assert(cookie.startsWith("pixiebooth_admin="), "Admin login did not set an HTTP-only session cookie.");

  const createdAdmin = await request("/api/admin/admins", {
    method: "POST",
    body: { username: "operator", displayName: "Booth Operator", password: "operator-password" },
  });
  assert(createdAdmin.response.status === 201 && createdAdmin.payload.admin.username === "operator", "Admin creation failed.");
  const adminList = await request("/api/admin/admins");
  assert(adminList.payload.admins.some((admin) => admin.username === "operator"), "Admin list did not include the new admin.");
  const selfDeactivate = await request(`/api/admin/admins/${encodeURIComponent(login.payload.admin.id)}`, {
    method: "PATCH",
    body: { active: false },
  });
  assert(selfDeactivate.response.status === 400, "Current admin should not be able to deactivate itself.");
  const deactivateAdmin = await request(`/api/admin/admins/${encodeURIComponent(createdAdmin.payload.admin.id)}`, { method: "DELETE" });
  assert(deactivateAdmin.response.status === 204, "Admin deactivation failed.");

  const voucher = await request("/api/admin/vouchers", {
    method: "POST",
    body: {
      code: "API50",
      discountType: "percent",
      discountValue: 50,
      maxUses: 1,
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
  });
  assert(voucher.response.status === 201, "Voucher creation failed.");

  const quote = await request("/api/payments/quote", { method: "POST", body: { voucherCode: "API50" } });
  assert(quote.payload.finalAmount === 12_500 && quote.payload.discountAmount === 12_500, "Voucher quote is incorrect.");

  const paymentCreated = await request("/api/payments", { method: "POST", body: { voucherCode: "API50" } });
  const payment = paymentCreated.payload.payment;
  assert(paymentCreated.response.status === 201 && payment.status === "pending", "Dynamic payment was not created.");
  assert(payment.qrString.includes(payment.orderId), "Mock dynamic QR is not tied to the order.");

  const paymentPaid = await request("/api/payments/" + encodeURIComponent(payment.id) + "/simulate", { method: "POST" });
  assert(paymentPaid.payload.payment.status === "paid", "Mock payment did not reach paid status.");

  const exhausted = await request("/api/payments", { method: "POST", body: { voucherCode: "API50" } });
  assert(exhausted.response.status === 422, "Voucher quota was not enforced.");

  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const sessionId = "api-test-session";
  const savedSession = await request("/api/sessions", {
    method: "POST",
    body: {
      id: sessionId,
      createdAt: new Date().toISOString(),
      mode: "photo",
      templateId: "han-river",
      frameLayout: "1x1",
      resultFormat: "photo",
      payment: paymentPaid.payload.payment,
      consent: {
        captureAccepted: true,
        privacyAccepted: true,
        gallerySharingAllowed: false,
        acceptedAt: new Date().toISOString(),
      },
      editor: {
        filterId: "none",
        stickers: [],
        caption: "",
        adjustments: { brightness: 100, contrast: 100, saturation: 100 },
      },
      photos: [tinyPng],
    },
  });
  assert(savedSession.response.status === 201, "Photo session was not stored.");

  const reusedPayment = await request("/api/sessions", {
    method: "POST",
    body: {
      id: "second-session",
      mode: "photo",
      templateId: "han-river",
      frameLayout: "1x1",
      resultFormat: "photo",
      payment: paymentPaid.payload.payment,
      consent: { captureAccepted: true, privacyAccepted: true },
      photos: [tinyPng],
    },
  });
  assert(reusedPayment.response.status === 409, "A paid transaction was reused for another session.");

  const resultCreated = await request("/api/results/" + sessionId, {
    method: "POST",
    body: { dataUrl: tinyPng, format: "photo" },
  });
  assert(resultCreated.response.status === 201 && resultCreated.payload.downloadUrl.startsWith(baseUrl), "Public download URL was not generated.");

  const resultToken = resultCreated.payload.id;
  const downloadPage = await request("/download/" + encodeURIComponent(resultToken));
  assert(downloadPage.response.ok && downloadPage.payload.includes("Download PNG"), "Download page format is incorrect.");
  const downloadFile = await request("/api/results/" + encodeURIComponent(resultToken) + "/file?inline=1");
  assert(downloadFile.response.ok && downloadFile.response.headers.get("content-type") === "image/png", "Stored object MIME type is incorrect.");

  const heartbeat = await request("/api/booths/test-booth/heartbeat", {
    method: "POST",
    headers: { "X-Booth-Token": "agent-test-token" },
    body: { version: "test", status: { printer: { available: true }, kioskScreen: "welcome" } },
  });
  assert(heartbeat.response.ok, "Booth heartbeat was rejected.");

  const bootstrap = await request("/api/admin/bootstrap");
  assert(bootstrap.payload.sessions.length === 1, "Stored session did not appear in admin gallery.");
  assert(bootstrap.payload.orders.some((order) => order.id === payment.id && order.sessionId === sessionId), "Stored order did not appear in admin orders.");
  assert(bootstrap.payload.vouchers[0].usedCount === 1, "Voucher redemption counter is incorrect.");
  assert(bootstrap.payload.booths[0].online === true, "Booth monitoring did not become online.");

  const webhookPayload = {
    order_id: "ORDER-1",
    status_code: "200",
    gross_amount: "25000.00",
  };
  const webhookConfig = { ...testConfig, midtrans: { ...testConfig.midtrans, serverKey: "server-key" } };
  webhookPayload.signature_key = createHash("sha512")
    .update(webhookPayload.order_id + webhookPayload.status_code + webhookPayload.gross_amount + "server-key")
    .digest("hex");
  assert(verifyMidtransWebhook(webhookConfig, webhookPayload), "Midtrans webhook signature verification failed.");

  await application.database.run("UPDATE photos SET expires_at = 0");
  const retention = await request("/api/admin/retention/run", { method: "POST" });
  assert(retention.response.ok && retention.payload.deletedAssets >= 2, "Retention worker did not delete expired media.");
  const expiredFile = await request("/api/results/" + encodeURIComponent(resultToken) + "/file");
  assert(expiredFile.response.status === 404, "Expired public media is still accessible.");

  const missingApi = await request("/api/does-not-exist");
  assert(missingApi.response.status === 404 && missingApi.payload.error, "Unknown API routes did not return JSON 404.");

  console.log("API integration passed: auth, admin management, voucher, one-payment-per-session, media, monitoring, webhook, and retention.");
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  await application.close();
  const resolvedTemp = resolve(tmpdir());
  const resolvedTestRoot = resolve(testRoot);
  if (resolvedTestRoot.startsWith(resolvedTemp + sep)) {
    await rm(resolvedTestRoot, { recursive: true, force: true });
  }
}
