import "dotenv/config";

const [{ createApplication }, { config }] = await Promise.all([
  import("./app.mjs"),
  import("./config.mjs"),
]);

const application = await createApplication(config);
const server = application.app.listen(config.port, "0.0.0.0", () => {
  console.log(`Photobooth API listening on http://0.0.0.0:${config.port}`);
  console.log(`Database: ${config.databaseDriver === "postgres" ? "postgres" : config.databasePath}`);
  console.log(`Storage: ${config.storageDriver}; Payment: ${config.paymentProvider}`);
});

function shutdown() {
  server.close(async () => {
    await application.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
