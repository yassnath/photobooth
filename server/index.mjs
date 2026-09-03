import "dotenv/config";

// Handle transient network errors & promise rejections globally to prevent server process crash on ECONNRESET
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (message.includes("ECONNRESET") || message.includes("ETIMEDOUT") || message.includes("EPIPE")) {
    console.warn("[Network Warning] Transient connection drop caught:", message);
    return;
  }
  console.warn("[Server Warning] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  if (error?.code === "ECONNRESET" || error?.code === "ETIMEDOUT" || error?.code === "EPIPE") {
    console.warn(`[Network Warning] Transient network error caught (${error.code}):`, error.message);
    return;
  }
  console.error("[Server Error] Uncaught Exception:", error);
});

const [{ createApplication }, { config }] = await Promise.all([
  import("./app.mjs"),
  import("./config.mjs"),
]);

const application = await createApplication(config);
const server = application.app.listen(config.port, "0.0.0.0", () => {
  console.log(`Photobooth API listening on http://0.0.0.0:${config.port}`);
  console.log(`Database: ${config.databaseDriver === "postgres" ? "postgres" : config.databasePath}`);
  console.log(`Storage: ${application.storage.label || config.storageDriver}; Payment: ${config.paymentProvider}`);
});

function shutdown() {
  server.close(async () => {
    await application.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
