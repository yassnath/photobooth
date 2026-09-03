import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { DEFAULT_UI_THEME, FILTERS, TEMPLATES } from "../../app/data/photobooth";
import { useLocalStorageState } from "../../app/hooks/useLocalStorageState";
import { LoginScreen } from "../../app/screens/LoginScreen";
import type { AdminAccount, AdminAuditLog, AdminSession, BoothEvent, BoothMonitor, BoothThemeSettings, FilterPreset, OrderRecord, PhotoSession, TemplateOption, Voucher } from "../../app/types/photobooth";
import { photoboothApi } from "../../shared/api/client";
import { listLocalSessionBackups } from "../../shared/storage/localPhotoBackup";

const DashboardScreen = lazy(() => import("../../app/screens/DashboardScreen").then((module) => ({ default: module.DashboardScreen })));

function mergeSessionBackups(serverSessions: PhotoSession[], localSessions: PhotoSession[]) {
  const localMap = new Map(localSessions.map((session) => [session.id, session]));
  const merged = serverSessions.map((session) => {
    const backup = localMap.get(session.id);
    localMap.delete(session.id);
    return session.photos.length > 0 || !backup ? session : { ...session, photos: backup.photos };
  });
  return merged.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function AdminApp() {
  const [uiTheme, setUiTheme] = useLocalStorageState<BoothThemeSettings>("pixiebooth.ui-theme", DEFAULT_UI_THEME);
  const [filters, setFilters] = useLocalStorageState<FilterPreset[]>("pixiebooth.filters", FILTERS);
  const [frames, setFrames] = useLocalStorageState<TemplateOption[]>("pixiebooth.frames", TEMPLATES);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [booths, setBooths] = useState<BoothMonitor[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [boothEvents, setBoothEvents] = useState<BoothEvent[]>([]);
  const [sessionPrice, setSessionPrice] = useState(25_000);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = useCallback(async () => {
    const [bootstrap, localSessions] = await Promise.all([
      photoboothApi.getAdminBootstrap(),
      listLocalSessionBackups().catch(() => []),
    ]);
    setAdminSession(bootstrap.admin);
    setUiTheme(bootstrap.config.theme || DEFAULT_UI_THEME);
    setFilters(bootstrap.config.filters || FILTERS);
    setFrames(bootstrap.config.frames || TEMPLATES);
    const merged = mergeSessionBackups(bootstrap.sessions || [], localSessions || []);
    setSessions(merged);
    setOrders(bootstrap.orders || []);
    setVouchers(bootstrap.vouchers || []);
    setBooths(bootstrap.booths || []);
    setAdmins(bootstrap.admins || []);
    setAuditLogs(bootstrap.auditLogs || []);
    setBoothEvents(bootstrap.boothEvents || []);
    setSessionPrice(bootstrap.config.sessionPrice || 25_000);
  }, [setFilters, setFrames, setUiTheme]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { admin } = await photoboothApi.getAdminSession();
        setAdminSession(admin);
        await loadDashboard();
        setLoadError("");
      } catch (err) {
        setAdminSession(null);
        if (err instanceof Error && err.message && !err.message.includes("401") && !err.message.includes("login")) {
          setLoadError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };
    void restoreSession();
  }, [loadDashboard]);

  useEffect(() => {
    if (!adminSession) return undefined;
    const timer = window.setInterval(() => void loadDashboard().catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, [adminSession, loadDashboard]);

  const updateTheme: Dispatch<SetStateAction<BoothThemeSettings>> = (action) => {
    setUiTheme((current) => {
      const next = typeof action === "function" ? action(current) : action;
      void photoboothApi.updateConfig({ theme: next }).catch((err) => console.warn("[Admin] theme update failed:", err));
      return next;
    });
  };

  const updateFilters: Dispatch<SetStateAction<FilterPreset[]>> = (action) => {
    setFilters((current) => {
      const next = typeof action === "function" ? action(current) : action;
      void photoboothApi.updateConfig({ filters: next }).catch((err) => console.warn("[Admin] filters update failed:", err));
      return next;
    });
  };

  const updateFrames: Dispatch<SetStateAction<TemplateOption[]>> = (action) => {
    setFrames((current) => {
      const next = typeof action === "function" ? action(current) : action;
      void photoboothApi.updateConfig({ frames: next }).catch((err) => console.warn("[Admin] frames update failed:", err));
      return next;
    });
  };

  const login = async (username: string, password: string) => {
    const { admin } = await photoboothApi.login(username, password);
    setAdminSession(admin);
    setShowLoginSuccess(true);
    await loadDashboard();
  };

  const logout = async () => {
    await photoboothApi.logout().catch(() => undefined);
    setAdminSession(null);
    setShowLoginSuccess(false);
    setSessions([]);
    setOrders([]);
    setVouchers([]);
    setBooths([]);
    setAdmins([]);
    setAuditLogs([]);
    setBoothEvents([]);
  };

  const createVoucher = async (draft: Parameters<typeof photoboothApi.createVoucher>[0]) => {
    const res = await photoboothApi.createVoucher(draft);
    if (res?.voucher) {
      setVouchers((current) => [res.voucher, ...current.filter((item): item is Voucher => Boolean(item && item.code))]);
    }
  };

  const toggleVoucher = async (id: string, active: boolean) => {
    const res = await photoboothApi.setVoucherActive(id, active);
    if (res?.voucher) {
      setVouchers((current) => current.filter((item): item is Voucher => Boolean(item && item.code)).map((item) => (item.id === id ? res.voucher : item)));
    }
  };

  const updateVoucher = async (id: string, patch: Parameters<typeof photoboothApi.updateVoucher>[1]) => {
    const res = await photoboothApi.updateVoucher(id, patch);
    if (res?.voucher) {
      setVouchers((current) => current.filter((item): item is Voucher => Boolean(item && item.code)).map((item) => (item.id === id ? res.voucher : item)));
    }
  };

  const deleteVoucher = async (id: string) => {
    await photoboothApi.deleteVoucher(id).catch(() => undefined);
    setVouchers((current) => current.filter((voucher) => Boolean(voucher && voucher.id !== id)));
  };

  const clearSessions = async () => {
    await photoboothApi.clearSessions();
    setSessions(await listLocalSessionBackups().catch(() => []));
  };

  const createAdmin = async (draft: Parameters<typeof photoboothApi.createAdmin>[0]) => {
    const res = await photoboothApi.createAdmin(draft);
    if (res?.admin) setAdmins((current) => [res.admin, ...current.filter((item) => item.id !== res.admin.id)]);
    await loadDashboard().catch(() => undefined);
  };

  const updateAdmin = async (id: string, patch: Parameters<typeof photoboothApi.updateAdmin>[1]) => {
    const res = await photoboothApi.updateAdmin(id, patch);
    if (res?.admin) setAdmins((current) => current.map((item) => (item.id === id ? res.admin : item)));
    await loadDashboard().catch(() => undefined);
  };

  const deactivateAdmin = async (id: string) => {
    await photoboothApi.deactivateAdmin(id);
    setAdmins((current) => current.map((item) => (item.id === id ? { ...item, active: false } : item)));
    await loadDashboard().catch(() => undefined);
  };

  const rootStyle = {
    minHeight: "100dvh",
    overflow: "hidden",
    "--booth-bg-start": uiTheme.background.start,
    "--booth-bg-middle": uiTheme.background.middle,
    "--booth-bg-end": uiTheme.background.end,
    "--booth-primary": uiTheme.primaryColor,
    "--booth-secondary": uiTheme.secondaryColor,
    "--primary": uiTheme.primaryColor,
    "--ring": uiTheme.primaryColor,
  } as CSSProperties;

  if (loading) {
    return (
      <div className="booth-bg grid min-h-[100dvh] place-items-center" style={rootStyle}>
        <div className="flex items-center gap-3 text-sm font-black text-primary"><LoaderCircle className="animate-spin" size={20} /> Memuat dashboard...</div>
      </div>
    );
  }

  if (loadError && !adminSession) {
    return (
      <div className="booth-bg grid min-h-[100dvh] place-items-center px-6" style={rootStyle}>
        <div className="max-w-sm rounded-3xl border border-white/60 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-2xl">⚠️</div>
          <h2 className="mb-2 text-base font-black text-foreground">Koneksi Server Gagal</h2>
          <p className="mb-5 text-sm text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => window.location.reload()} className="w-full rounded-2xl bg-primary py-3 text-sm font-black text-primary-foreground shadow-md">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      {adminSession ? (
        <Suspense fallback={<div className="booth-bg grid min-h-[100dvh] place-items-center"><div className="flex items-center gap-3 text-sm font-black text-primary"><LoaderCircle className="animate-spin" size={20} /> Memuat modul dashboard...</div></div>}>
          <DashboardScreen
            adminName={adminSession.displayName}
            uiTheme={uiTheme}
            filters={filters}
            frames={frames}
            sessions={sessions}
            orders={orders}
            vouchers={vouchers}
            booths={booths}
            admins={admins}
            auditLogs={auditLogs}
            boothEvents={boothEvents}
            sessionPrice={sessionPrice}
            showLoginSuccess={showLoginSuccess}
            onCloseLoginSuccess={() => setShowLoginSuccess(false)}
            onBack={() => window.location.assign("/")}
            onLogout={() => void logout()}
            onClearSessions={() => void clearSessions()}
            onUpdateTheme={updateTheme}
            onUpdateFilters={updateFilters}
            onUpdateFrames={updateFrames}
            onCreateVoucher={createVoucher}
            onUpdateVoucher={updateVoucher}
            onToggleVoucher={toggleVoucher}
            onDeleteVoucher={deleteVoucher}
            onCreateAdmin={createAdmin}
            onUpdateAdmin={updateAdmin}
            onDeactivateAdmin={deactivateAdmin}
            onRefresh={loadDashboard}
          />
        </Suspense>
      ) : (
        <LoginScreen uiTheme={uiTheme} onBack={() => window.location.assign("/")} onLogin={login} />
      )}
    </div>
  );
}
