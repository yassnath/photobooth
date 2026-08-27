import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(process.cwd(), "logs");
if (!existsSync(LOG_DIR)) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // Ignore if exists
  }
}

const LOG_FILE = join(LOG_DIR, `app-${new Date().toISOString().slice(0, 10)}.log`);

export const logger = {
  info(message, meta = {}) {
    const entry = { timestamp: new Date().toISOString(), level: "INFO", message, ...meta };
    console.log(`[INFO] ${message}`, Object.keys(meta).length ? meta : "");
    this._writeToFile(entry);
  },
  warn(message, meta = {}) {
    const entry = { timestamp: new Date().toISOString(), level: "WARN", message, ...meta };
    console.warn(`[WARN] ${message}`, Object.keys(meta).length ? meta : "");
    this._writeToFile(entry);
  },
  error(message, error = null, meta = {}) {
    const errDetails = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error;
    const entry = { timestamp: new Date().toISOString(), level: "ERROR", message, error: errDetails, ...meta };
    console.error(`[ERROR] ${message}`, errDetails || "", Object.keys(meta).length ? meta : "");
    this._writeToFile(entry);
  },
  metric(metricName, value, unit = "", meta = {}) {
    const entry = { timestamp: new Date().toISOString(), level: "METRIC", metric: metricName, value, unit, ...meta };
    console.log(`[METRIC] ${metricName}=${value}${unit}`, Object.keys(meta).length ? meta : "");
    this._writeToFile(entry);
  },
  _writeToFile(entry) {
    try {
      appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
    } catch {
      // Fallback silent
    }
  },
};
