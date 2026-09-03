import "dotenv/config";

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.PHOTOBOOTH_URL || "http://127.0.0.1:5173";
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const artifactsDir = fileURLToPath(new URL("../.ui-artifacts/", import.meta.url));
const viewports = [
  { name: "phone-portrait", width: 320, height: 568 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 600 },
  { name: "desktop-wide", width: 1920, height: 1080 },
];

await mkdir(artifactsDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const e2eAdminUsername = process.env.E2E_ADMIN_USERNAME || "admin";
const e2eAdminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_BOOTSTRAP_PASSWORD || "photobooth123";
const e2eVoucherCode = "E2E" + Date.now().toString(36).toUpperCase();

const setupContext = await browser.newContext();
const loginResponse = await setupContext.request.post(`${baseUrl}/api/auth/login`, {
  data: { username: e2eAdminUsername, password: e2eAdminPassword },
});
if (!loginResponse.ok()) {
  throw new Error(`E2E admin login returned HTTP ${loginResponse.status()}`);
}
const voucherResponse = await setupContext.request.post(`${baseUrl}/api/admin/vouchers`, {
  data: {
    code: e2eVoucherCode,
    discountType: "percent",
    discountValue: 20,
    maxUses: 2,
    expiresAt: "2030-01-01T00:00:00.000Z",
  },
});
if (!voucherResponse.ok()) {
  throw new Error(`E2E voucher setup returned HTTP ${voucherResponse.status()}`);
}
await setupContext.close();

async function assertNoHorizontalOverflow(page, screenName) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  if (dimensions.document > dimensions.viewport + 1) {
    throw new Error(`${screenName} overflow: ${dimensions.document}px document in ${dimensions.viewport}px viewport`);
  }
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await assertNoHorizontalOverflow(page, `${viewport.name}/welcome`);
  await page.getByRole("button", { name: /Start Your Photoshoot/i }).click();
  await page.getByRole("heading", { name: "Pilih Hasil Foto" }).waitFor();
  if (await page.locator('[aria-label^="Sisa waktu sesi"]').count()) {
    throw new Error(`${viewport.name} timer started before the camera was opened`);
  }

  const selectedFormat = viewport.name === "tablet-landscape" ? "GIF" : "Photo";
  await page.getByRole("button", { name: `Pilih format ${selectedFormat}` }).click();
  await page.getByRole("button", { name: `Lanjut dengan ${selectedFormat}` }).click();
  await page.getByAltText("QR pembayaran sesi").waitFor();
  if (await page.locator('[aria-label^="Sisa waktu sesi"]').count()) {
    throw new Error(`${viewport.name} timer started on the payment screen`);
  }
  await assertNoHorizontalOverflow(page, `${viewport.name}/payment`);
  if (viewport.name === "phone-portrait" || viewport.name === "tablet-landscape") {
    await page.screenshot({ path: join(artifactsDir, `${viewport.name}-payment.png`) });
  }

  if (viewport.name === "desktop-wide") {
    await page.getByRole("button", { name: /Gunakan Voucher|Voucher/i }).click();
    await page.getByLabel("Kode voucher").fill(e2eVoucherCode);
    await page.getByRole("button", { name: /Cek Voucher|Cek/i }).click();
    await page.getByRole("heading", { name: /Voucher Berhasil Dipasang/i }).waitFor();
    await page.getByRole("button", { name: /Gunakan Diskon & Tutup/i }).click();
    await page.getByRole("button", { name: /Lanjut Pembayaran Diskon|Gunakan Voucher Gratis/i }).click();
    await page.getByAltText("QR pembayaran sesi").waitFor();
  }
  await page.getByRole("button", { name: /Simulasikan Pembayaran/i }).click();
  await page.locator('input[type="checkbox"]').first().waitFor();
  if (await page.locator('[aria-label^="Sisa waktu sesi"]').count()) {
    throw new Error(`${viewport.name} timer started on the consent screen`);
  }
  const consentScrollTop = await page.evaluate(() => window.scrollY);
  if (consentScrollTop > 1) {
    throw new Error(`${viewport.name} consent did not reset scroll position: ${consentScrollTop}px`);
  }
  if (viewport.name === "phone-portrait" || viewport.name === "tablet-landscape") {
    await page.screenshot({ path: join(artifactsDir, `${viewport.name}-consent.png`) });
  }
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole("button", { name: /Setuju dan Lanjut/i }).click();
  if (await page.locator('[aria-label^="Sisa waktu sesi"]').count()) {
    throw new Error(`${viewport.name} timer started before the camera screen`);
  }
  await page.getByRole("button", { name: "1 x 4" }).click();
  const selectedLayout = await page.locator('.frame-layout-grid button[aria-pressed="true"]').innerText();
  if (!selectedLayout.includes("1 x 4")) {
    throw new Error(`${viewport.name} selected the wrong frame layout: ${selectedLayout}`);
  }
  await assertNoHorizontalOverflow(page, `${viewport.name}/frame`);
  await page.screenshot({ path: join(artifactsDir, `${viewport.name}-frame.png`) });

  if (viewport.name === "tablet-landscape") {
    await page.getByRole("button", { name: /Gunakan Frame 1x4/i }).click();
    const sessionTimer = page.locator('[aria-label^="Sisa waktu sesi"]').first();
    await sessionTimer.waitFor();
    const timerLabel = await sessionTimer.getAttribute("aria-label");
    const timerParts = timerLabel?.match(/(\d+) menit (\d+) detik/);
    const remainingSeconds = timerParts ? Number(timerParts[1]) * 60 + Number(timerParts[2]) : 0;
    if (remainingSeconds < 345 || remainingSeconds > 360) {
      throw new Error(`Camera timer did not start from six minutes: ${timerLabel}`);
    }
    await page.getByRole("button", { name: "Take photo" }).click();
    const continueToEditorButton = page.getByRole("button", { name: /Done|Lanjut ke Editor/i });
    await continueToEditorButton.waitFor({ timeout: 22000 });
    await continueToEditorButton.click();
    await page.getByRole("heading", { name: /Pilih Filter/i }).waitFor();
    await assertNoHorizontalOverflow(page, `${viewport.name}/editor`);
    await page.getByRole("button", { name: /Selesai & Lanjut/i }).click();
    await page.getByRole("heading", { name: "Hasil GIF-mu" }).waitFor();
    for (const formatName of ["Foto", "Live Photo", "GIF"]) {
      if (await page.getByRole("button", { name: formatName, exact: true }).count()) {
        throw new Error(`Result format tab ${formatName} is still visible`);
      }
    }
    if (await page.getByText(/Pilih format/i).count()) {
      throw new Error("Result screen still asks the user to choose a format");
    }
    await page.getByAltText("QR unduhan hasil foto").waitFor();
    await page.getByText(/Buka kamera HP/i).waitFor({ timeout: 15000 });
    const downloadPageUrl = await page.getByRole("link", { name: "Buka halaman download" }).getAttribute("href");
    const downloadPageResponse = await page.request.get(downloadPageUrl);
    if (!downloadPageResponse.ok()) {
      throw new Error(`Download page returned HTTP ${downloadPageResponse.status()}`);
    }
    const downloadPageBody = await downloadPageResponse.text();
    if (!downloadPageBody.includes("Download GIF")) {
      throw new Error("QR download page did not preserve the selected GIF format");
    }
    await assertNoHorizontalOverflow(page, `${viewport.name}/result`);
    await page.screenshot({ path: join(artifactsDir, `${viewport.name}-result.png`) });

    await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.getByRole("button", { name: /Unduh.*GIF/i }).click(),
    ]);
  }

  if (pageErrors.length > 0) {
    throw new Error(`${viewport.name} page errors: ${pageErrors.join(" | ")}`);
  }
  await context.close();
}

const lockedFormatCases = [
  {
    selection: "Photo",
    heading: "Hasil Fotomu",
    downloadPageLabel: "Download JPG",
    mimeType: "image/jpeg",
    extension: ".jpg",
  },
  {
    selection: "Live Photo",
    heading: "Hasil Live Photo-mu",
    downloadPageLabel: "Download WEBM",
    mimeType: "video/webm",
    extension: ".webm",
  },
];

for (const formatCase of lockedFormatCases) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start Your Photoshoot/i }).click();
  await page.getByRole("button", { name: `Pilih format ${formatCase.selection}` }).click();
  await page.getByRole("button", { name: `Lanjut dengan ${formatCase.selection}` }).click();
  await page.getByAltText("QR pembayaran sesi").waitFor();
  await page.getByRole("button", { name: /Simulasikan Pembayaran/i }).click();
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole("button", { name: /Setuju dan Lanjut/i }).click();
  await page.getByRole("button", { name: /Gunakan Frame 1x1/i }).click();
  await page.locator('[aria-label^="Sisa waktu sesi"]').first().waitFor();
  await page.getByRole("button", { name: "Take photo" }).click();
  const continueToEditorButton = page.getByRole("button", { name: /Done|Lanjut ke Editor/i });
  await continueToEditorButton.waitFor({ timeout: 12000 });
  await continueToEditorButton.click();
  await page.getByRole("heading", { name: /Pilih Filter/i }).waitFor();
  await assertNoHorizontalOverflow(page, `${formatCase.selection}/editor`);
  await page.getByRole("button", { name: /Selesai & Lanjut/i }).click();
  await page.getByRole("heading", { name: formatCase.heading }).waitFor();

  for (const formatName of ["Foto", "Live Photo", "GIF"]) {
    if (await page.getByRole("button", { name: formatName, exact: true }).count()) {
      throw new Error(`${formatCase.selection} result exposed the ${formatName} format tab`);
    }
  }

  await page.getByText(/Buka kamera HP/i).waitFor({ timeout: 15000 });
  const downloadPageUrl = await page.getByRole("link", { name: "Buka halaman download" }).getAttribute("href");
  if (!downloadPageUrl) {
    throw new Error(`${formatCase.selection} result did not create a QR download URL`);
  }

  const downloadPageResponse = await page.request.get(downloadPageUrl);
  const downloadPageBody = await downloadPageResponse.text();
  if (!downloadPageResponse.ok() || !downloadPageBody.includes(formatCase.downloadPageLabel)) {
    throw new Error(`${formatCase.selection} QR page did not preserve its output format`);
  }

  const resultId = new URL(downloadPageUrl).pathname.split("/").filter(Boolean).at(-1);
  const fileResponse = await page.request.get(`${baseUrl}/api/results/${resultId}/file?inline=1`);
  const contentType = fileResponse.headers()["content-type"]?.split(";", 1)[0];
  if (!fileResponse.ok() || contentType !== formatCase.mimeType) {
    throw new Error(`${formatCase.selection} API returned ${contentType || "no content type"}`);
  }

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("button", { name: new RegExp(`Unduh.*${formatCase.extension.slice(1).toUpperCase()}`, "i") }).click(),
  ]);
  if (!download.suggestedFilename().endsWith(formatCase.extension)) {
    throw new Error(`${formatCase.selection} downloaded as ${download.suggestedFilename()}`);
  }

  await assertNoHorizontalOverflow(page, `${formatCase.selection}/result`);
  if (pageErrors.length > 0) {
    throw new Error(`${formatCase.selection} page errors: ${pageErrors.join(" | ")}`);
  }
  await context.close();
}

for (const viewport of [
  { name: "admin-phone", width: 320, height: 568 },
  { name: "admin-desktop", width: 1440, height: 900 },
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("admin").fill(e2eAdminUsername);
  await page.getByPlaceholder("Password").fill(e2eAdminPassword);
  await page.getByRole("button", { name: "Masuk Dashboard" }).click();
  await page.getByRole("heading", { name: /Dashboard/i }).waitFor();
  await page.getByRole("button", { name: /Vouchers/i }).click();
  await page.getByText(e2eVoucherCode, { exact: true }).waitFor();
  await assertNoHorizontalOverflow(page, `${viewport.name}/vouchers`);
  await page.getByRole("button", { name: /Booths/i }).click();
  await page.getByRole("heading", { name: "Booth Monitor" }).waitFor();
  await assertNoHorizontalOverflow(page, `${viewport.name}/monitoring`);
  if (viewport.name === "admin-desktop") {
    await page.screenshot({ path: join(artifactsDir, "admin-desktop-monitoring.png") });
  }
  if (pageErrors.length > 0) {
    throw new Error(`${viewport.name} page errors: ${pageErrors.join(" | ")}`);
  }
  await context.close();
}

await browser.close();
console.log(`Responsive flow passed for ${viewports.length} kiosk viewports, all result formats, and two admin viewports.`);
