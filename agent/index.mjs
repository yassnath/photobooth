import "dotenv/config";
import express from "express";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);
const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const spoolDir = process.env.PRINTER_SPOOL_DIR || join(rootDir, ".photobooth-data", "print-spool");
const printScript = join(rootDir, "agent", "print-image.ps1");
const port = Number(process.env.PRINTER_AGENT_PORT || 4175);
const printerName = process.env.PRINTER_NAME || "";
const printerMode = (process.env.PRINTER_MODE || (printerName ? "windows" : "spool")).toLowerCase();
const apiBaseUrl = (process.env.PHOTOBOOTH_API_URL || "http://127.0.0.1:4174").replace(/\/+$/, "");
const boothId = process.env.BOOTH_ID || "booth-main";
const boothToken = process.env.BOOTH_AGENT_TOKEN || "";
const packageVersion = process.env.npm_package_version || "0.0.1";
const jobs = new Map();
const queue = [];
let processing = false;
let deviceState = { kioskScreen: "unknown" };
let cachedPrinter = { available: false, name: printerName || "Not configured", mode: printerMode };

await mkdir(spoolDir, { recursive: true });

function parseImage(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/jpeg|image\/png);base64,([a-zA-Z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  return {
    body: Buffer.from(match[2], "base64"),
    extension: match[1].toLowerCase() === "image/png" ? "png" : "jpg",
  };
}

async function inspectPrinter() {
  if (printerMode !== "windows" || !printerName) {
    cachedPrinter = { available: printerMode === "spool", name: printerName || "Spool only", mode: printerMode };
    return cachedPrinter;
  }
  const script = "$printer = Get-Printer -Name $env:PB_PRINTER_NAME -ErrorAction Stop; [pscustomobject]@{Name=$printer.Name;Status=[string]$printer.PrinterStatus;WorkOffline=$printer.WorkOffline} | ConvertTo-Json -Compress";
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: { ...process.env, PB_PRINTER_NAME: printerName },
      windowsHide: true,
      timeout: 10_000,
    });
    const status = JSON.parse(stdout.trim());
    cachedPrinter = { available: !status.WorkOffline, name: status.Name, status: status.Status, mode: printerMode };
  } catch (error) {
    cachedPrinter = { available: false, name: printerName, mode: printerMode, error: error.message };
  }
  return cachedPrinter;
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const job = queue.shift();
  job.status = "printing";
  job.updatedAt = new Date().toISOString();
  try {
    if (printerMode === "windows") {
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        printScript,
        "-ImagePath",
        job.filePath,
        "-PrinterName",
        printerName,
        "-Copies",
        String(job.copies),
      ], { windowsHide: true, timeout: 120_000 });
      job.status = "printed";
    } else {
      job.status = "spooled";
    }
  } catch (error) {
    job.status = "failed";
    job.error = error.message;
  } finally {
    job.updatedAt = new Date().toISOString();
    processing = false;
    if (queue.length > 0) void processQueue();
  }
}

function currentStatus() {
  return {
    platform: process.platform,
    printer: cachedPrinter,
    camera: deviceState.camera || null,
    queueLength: queue.length + (processing ? 1 : 0),
    kioskScreen: deviceState.kioskScreen || "unknown",
    activeSession: Boolean(deviceState.activeSession),
    uptimeSeconds: Math.round(process.uptime()),
    recentJobs: [...jobs.values()].slice(-10).map(({ filePath: _filePath, ...job }) => job),
  };
}

async function sendHeartbeat() {
  await inspectPrinter();
  try {
    await fetch(`${apiBaseUrl}/api/booths/${encodeURIComponent(boothId)}/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(boothToken ? { "X-Booth-Token": boothToken } : {}),
      },
      body: JSON.stringify({ version: packageVersion, status: currentStatus() }),
    });
  } catch {
    // The local print queue remains available while the cloud/backend is offline.
  }
}

const app = express();
app.disable("x-powered-by");
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: "32mb" }));

app.get("/health", (_request, response) => response.json({ ok: true, ...currentStatus() }));
app.get("/status", (_request, response) => response.json(currentStatus()));

app.post("/device-state", (request, response) => {
  deviceState = {
    kioskScreen: String(request.body?.kioskScreen || "unknown").slice(0, 80),
    activeSession: Boolean(request.body?.activeSession),
    camera: typeof request.body?.camera === "object" && request.body.camera ? request.body.camera : undefined,
  };
  response.json({ ok: true });
});

app.post("/print", async (request, response) => {
  const image = parseImage(request.body?.dataUrl);
  if (!image) {
    response.status(400).json({ error: "Print agent hanya menerima JPEG atau PNG data URL." });
    return;
  }
  const id = randomUUID();
  const filePath = join(spoolDir, `${id}.${image.extension}`);
  await writeFile(filePath, image.body);
  const now = new Date().toISOString();
  const job = {
    id,
    filePath,
    copies: Math.max(1, Math.min(10, Number(request.body?.copies) || 1)),
    format: String(request.body?.format || "photo").slice(0, 32),
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  queue.push(job);
  void processQueue();
  response.status(202).json({ job: { ...job, filePath: undefined }, mode: printerMode });
});

app.get("/jobs/:id", (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job) {
    response.status(404).json({ error: "Print job tidak ditemukan." });
    return;
  }
  const { filePath: _filePath, ...publicJob } = job;
  response.json({ job: publicJob });
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Printer agent listening on http://127.0.0.1:${port} (${printerMode})`);
  void sendHeartbeat();
});

const heartbeatTimer = setInterval(() => void sendHeartbeat(), 15_000);
const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.createdAt).getTime() < cutoff) {
      jobs.delete(id);
      void rm(job.filePath, { force: true });
    }
  }
}, 60 * 60 * 1000);

function shutdown() {
  clearInterval(heartbeatTimer);
  clearInterval(cleanupTimer);
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
