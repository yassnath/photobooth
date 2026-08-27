import { createApplication } from "../server/app.mjs";
import { config } from "../server/config.mjs";

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createApplication(config)
      .then(({ app }) => app)
      .catch((error) => {
        console.error("Gagal inisialisasi Vercel API:", error);
        appPromise = null;
        throw error;
      });
  }
  return appPromise;
}

export default async function handler(request, response) {
  try {
    const app = await getApp();
    return app(request, response);
  } catch (error) {
    console.error("Vercel Serverless Handler Error:", error);
    return response.status(500).json({
      error: "Terjadi kesalahan serverless di Vercel.",
      detail: error.message,
    });
  }
}
