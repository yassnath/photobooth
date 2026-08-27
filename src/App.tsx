import { lazy, Suspense } from "react";

const AdminApp = lazy(() => import("./apps/admin/AdminApp").then((module) => ({ default: module.AdminApp })));
const KioskApp = lazy(() => import("./apps/kiosk/KioskApp").then((module) => ({ default: module.KioskApp })));

export default function App() {
  const ActiveApp = window.location.pathname.startsWith("/admin") ? AdminApp : KioskApp;
  return (
    <Suspense fallback={<div className="booth-bg grid min-h-[100dvh] place-items-center text-sm font-black text-primary">Memuat aplikasi...</div>}>
      <ActiveApp />
    </Suspense>
  );
}
