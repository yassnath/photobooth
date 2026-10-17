import { lazy, Suspense } from "react";
import { ErrorBoundary } from "./app/components/shared/ErrorBoundary";

function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  componentImport: () => Promise<T>
) {
  return lazy(async () => {
    try {
      const result = await componentImport();
      sessionStorage.removeItem("vite_chunk_reload");
      return result;
    } catch (error) {
      const retryKey = "vite_chunk_reload";
      const hasRetried = sessionStorage.getItem(retryKey);
      if (!hasRetried) {
        sessionStorage.setItem(retryKey, "true");
        window.location.reload();
        return new Promise<T>(() => {});
      }
      sessionStorage.removeItem(retryKey);
      throw error;
    }
  });
}

const AdminApp = lazyWithRetry(() => import("./apps/admin/AdminApp").then((module) => ({ default: module.AdminApp })));
const KioskApp = lazyWithRetry(() => import("./apps/kiosk/KioskApp").then((module) => ({ default: module.KioskApp })));

export default function App() {
  const isAdmin = window.location.pathname.startsWith("/admin");
  const ActiveApp = isAdmin ? AdminApp : KioskApp;
  const context = isAdmin ? "Admin" : "Kiosk";
  return (
    <ErrorBoundary context={context}>
      <Suspense fallback={<div className="booth-bg grid min-h-[100dvh] place-items-center text-sm font-black text-primary">Memuat aplikasi...</div>}>
        <ActiveApp />
      </Suspense>
    </ErrorBoundary>
  );
}

