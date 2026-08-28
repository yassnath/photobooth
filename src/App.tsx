import { lazy, Suspense } from "react";
import { ErrorBoundary } from "./app/components/shared/ErrorBoundary";

const AdminApp = lazy(() => import("./apps/admin/AdminApp").then((module) => ({ default: module.AdminApp })));
const KioskApp = lazy(() => import("./apps/kiosk/KioskApp").then((module) => ({ default: module.KioskApp })));

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

