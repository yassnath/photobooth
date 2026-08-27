import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const appUrl = process.env.KIOSK_URL || "http://127.0.0.1:4174";
const apiHealthUrl = `${appUrl.replace(/\/+$/, "")}/api/health`;
const agentHealthUrl = process.env.PRINTER_AGENT_URL || "http://127.0.0.1:4175/health";
const profileDir = join(rootDir, ".photobooth-data", "chrome-kiosk-profile");
const children = new Map();
let shuttingDown = false;

if (!existsSync(join(rootDir, "dist", "index.html"))) {
  console.error("Build produksi belum tersedia. Jalankan npm run build terlebih dahulu.");
  process.exit(1);
}
mkdirSync(profileDir, { recursive: true });

async function isHealthy(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function spawnManaged(name, args, options = {}) {
  const child = spawn(args[0], args.slice(1), {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    windowsHide: options.windowsHide ?? true,
  });
  children.set(name, child);
  child.on("exit", () => {
    children.delete(name);
    if (!shuttingDown) {
      console.warn(`${name} berhenti; watchdog menjalankan ulang dalam 2 detik.`);
      setTimeout(() => spawnManaged(name, args, options), 2000);
    }
  });
  return child;
}

async function waitUntilHealthy(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isHealthy(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Service tidak sehat setelah ${timeoutMs}ms: ${url}`);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

if (!(await isHealthy(apiHealthUrl))) {
  spawnManaged("Photobooth API", [process.execPath, "server/index.mjs"]);
}
if (!(await isHealthy(agentHealthUrl))) {
  spawnManaged("Printer agent", [process.execPath, "agent/index.mjs"]);
}

await Promise.all([waitUntilHealthy(apiHealthUrl), waitUntilHealthy(agentHealthUrl)]);

if (process.env.KIOSK_NO_BROWSER !== "true") {
  const chrome = findChrome();
  if (!chrome) {
    console.error("Chrome atau Edge tidak ditemukan. Isi CHROME_PATH di .env.");
  } else {
    spawnManaged("Kiosk browser", [
      chrome,
      `--app=${appUrl}`,
      "--kiosk",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
      "--disable-infobars",
      `--user-data-dir=${profileDir}`,
    ], { windowsHide: false });
  }
}

const healthTimer = setInterval(async () => {
  const [apiHealthy, agentHealthy] = await Promise.all([isHealthy(apiHealthUrl), isHealthy(agentHealthUrl)]);
  if (!apiHealthy && !children.has("Photobooth API")) spawnManaged("Photobooth API", [process.execPath, "server/index.mjs"]);
  if (!agentHealthy && !children.has("Printer agent")) spawnManaged("Printer agent", [process.execPath, "agent/index.mjs"]);
}, 10_000);

function shutdown() {
  shuttingDown = true;
  clearInterval(healthTimer);
  for (const child of children.values()) child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 750).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
