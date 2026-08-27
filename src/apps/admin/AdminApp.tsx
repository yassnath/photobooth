import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { DEFAULT_UI_THEME, FILTERS, SAMPLE_BOOTHS, SAMPLE_SESSIONS, SAMPLE_VOUCHERS, TEMPLATES } from "../../app/data/photobooth";
import { useLocalStorageState } from "../../app/hooks/useLocalStorageState";
import { DashboardScreen } from "../../app/screens/DashboardScreen";
import { LoginScreen } from "../../app/screens/LoginScreen";
import type { AdminSession, BoothMonitor, BoothThemeSettings, FilterPreset, PhotoSession, TemplateOption, Voucher } from "../../app/types/photobooth";
import { photoboothApi } from "../../shared/api/client";
import { listLocalSessionBackups } from "../../shared/storage/localPhotoBackup";

function mergeSessionBackups(serverSessions: PhotoSession[], localSessions: PhotoSession[]) {
  const localMap = new Map(localSessions.map((session) => [session.id, session]));
  const merged = serverSessions.map((session) => {
    const backup = localMap.get(session.id);
    localMap.delete(session.id);
    return session.photos.length > 0 || !backup ? session : { ...session, photos: backup.photos };
  });
  return [...merged, ...localMap.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function AdminApp() {
  const [uiTheme, setUiTheme] = useLocalStorageState<BoothThemeSettings>("pixiebooth.ui-theme", DEFAULT_UI_THEME);
  const [filters, setFilters] = useLocalStorageState<FilterPreset[]>("pixiebooth.filters", FILTERS);
  const [frames, setFrames] = useLocalStorageState<TemplateOption[]>("pixiebooth.frames", TEMPLATES);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [booths, setBooths] = useState<BoothMonitor[]>([]);
  const [sessionPrice, setSessionPrice] = useState(25_000);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

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
    setSessions(merged.length > 0 ? merged : SAMPLE_SESSIONS);
    setVouchers(bootstrap.vouchers && bootstrap.vouchers.length > 0 ? bootstrap.vouchers : SAMPLE_VOUCHERS);
    setBooths(bootstrap.booths && bootstrap.booths.length > 0 ? bootstrap.booths : SAMPLE_BOOTHS);
    setSessionPrice(bootstrap.config.sessionPrice || 25_000);
  }, [setFilters, setFrames, setUiTheme]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { admin } = await photoboothApi.getAdminSession();
        setAdminSession(admin);
        await loadDashboard();
      } catch {
        setAdminSession(null);
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
      void photoboothApi.updateConfig({ theme: next }).catch(console.error);
      return next;
    });
  };

  const updateFilters: Dispatch<SetStateAction<FilterPreset[]>> = (action) => {
    setFilters((current) => {
      const next = typeof action === "function" ? action(current) : action;
      void photoboothApi.updateConfig({ filters: next }).catch(console.error);
      return next;
    });
  };

  const updateFrames: Dispatch<SetStateAction<TemplateOption[]>> = (action) => {
    setFrames((current) => {
      const next = typeof action === "function" ? action(current) : action;
      void photoboothApi.updateConfig({ frames: next }).catch(console.error);
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
    setVouchers([]);
    setBooths([]);
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

  return (
    <div style={rootStyle}>
      {adminSession ? (
        <DashboardScreen
          adminName={adminSession.displayName}
          uiTheme={uiTheme}
          filters={filters}
          frames={frames}
          sessions={sessions}
          vouchers={vouchers}
          booths={booths}
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
          onRefresh={loadDashboard}
        />
      ) : (
        <LoginScreen uiTheme={uiTheme} onBack={() => window.location.assign("/")} onLogin={login} />
      )}
    </div>
  );
}
