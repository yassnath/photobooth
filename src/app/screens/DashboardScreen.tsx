import type { Dispatch, SetStateAction } from "react";
import { ArrowLeft, Image, LogOut, MonitorCog, Palette, Power, ReceiptText, ShieldCheck, Sliders, TicketPercent, UserCog, Wand2 } from "lucide-react";
import { motion } from "motion/react";

import type { AdminAuditLog, BoothEvent, BoothMonitor, BoothThemeSettings, FilterPreset, OrderRecord, PhotoSession, TemplateOption, Voucher } from "../types/photobooth";
import { useDashboardState, type DashboardTab } from "../components/dashboard/useDashboardState";
import { DashboardModals } from "../components/dashboard/DashboardModals";
import { OverviewTab } from "../components/dashboard/tabs/OverviewTab";
import { OrdersTab } from "../components/dashboard/tabs/OrdersTab";
import { ThemeTab } from "../components/dashboard/tabs/ThemeTab";
import { GalleryTab } from "../components/dashboard/tabs/GalleryTab";
import { VouchersTab } from "../components/dashboard/tabs/VouchersTab";
import { MonitoringTab } from "../components/dashboard/tabs/MonitoringTab";
import { AdminsTab } from "../components/dashboard/tabs/AdminsTab";
import { FiltersTab } from "../components/dashboard/tabs/FiltersTab";
import { FramesTab } from "../components/dashboard/tabs/FramesTab";

interface DashboardScreenProps {
  adminName: string;
  uiTheme: BoothThemeSettings;
  filters: FilterPreset[];
  frames: TemplateOption[];
  sessions: PhotoSession[];
  orders?: OrderRecord[];
  vouchers?: Voucher[];
  booths?: BoothMonitor[];
  admins?: any[];
  auditLogs?: AdminAuditLog[];
  boothEvents?: BoothEvent[];
  sessionPrice: number;
  showLoginSuccess?: boolean;
  onCloseLoginSuccess?: () => void;
  onBack: () => void;
  onLogout: () => void;
  onClearSessions: () => void;
  onUpdateTheme: Dispatch<SetStateAction<BoothThemeSettings>>;
  onUpdateFilters: Dispatch<SetStateAction<FilterPreset[]>>;
  onUpdateFrames: Dispatch<SetStateAction<TemplateOption[]>>;
  onCreateVoucher: (v: Partial<Voucher>) => Promise<void>;
  onUpdateVoucher: (id: string, patch: Partial<Voucher>) => Promise<void>;
  onDeleteVoucher: (id: string) => Promise<void>;
  onCreateAdmin: (a: { username: string; displayName: string; password: string }) => Promise<void>;
  onUpdateAdmin: (id: string, patch: any) => Promise<void>;
  onDeactivateAdmin: (id: string) => Promise<void>;
  onToggleVoucher: (id: string, active: boolean) => Promise<void>;
  onRefresh: () => void;
}

const dashboardTabs: Array<{ id: DashboardTab; label: string; icon: React.ReactNode }> = [
  { id: "overview",   label: "Overview",    icon: <Power size={16} /> },
  { id: "orders",     label: "Pesanan",     icon: <ReceiptText size={16} /> },
  { id: "theme",      label: "Tema",        icon: <Palette size={16} /> },
  { id: "gallery",    label: "Galeri",      icon: <Image size={16} /> },
  { id: "vouchers",   label: "Voucher",     icon: <TicketPercent size={16} /> },
  { id: "filters",    label: "Filter",      icon: <Sliders size={16} /> },
  { id: "frames",     label: "Frame",       icon: <Wand2 size={16} /> },
  { id: "monitoring", label: "Monitoring",  icon: <MonitorCog size={16} /> },
  { id: "admins",     label: "Admin",       icon: <UserCog size={16} /> },
];

export function DashboardScreen(props: DashboardScreenProps) {
  const {
    adminName, uiTheme, filters, frames, sessions, vouchers,
    booths, admins, auditLogs, boothEvents, sessionPrice,
    showLoginSuccess, onCloseLoginSuccess, onBack, onLogout, onClearSessions,
    onUpdateTheme, onUpdateFilters, onUpdateFrames,
    onUpdateVoucher, onDeleteVoucher, onUpdateAdmin, onDeactivateAdmin, onToggleVoucher,
  } = props;

  const state = useDashboardState(props);
  const { calculations } = state;

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.35 }}
    >
      <div className="booth-bg absolute inset-0" />
      <div className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-[96rem] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-white/60 bg-white/70 p-2.5 shadow-sm transition-transform hover:scale-110 dark:bg-white/10" aria-label="Back to app">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black text-foreground sm:text-3xl" style={{ fontFamily: "Pacifico, cursive" }}>
              {uiTheme.logoEmoji} {uiTheme.brandName} Dashboard
            </h1>
            <p className="truncate text-xs font-semibold text-muted-foreground sm:text-sm">Booth operations, payments, media, and design manager</p>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {state.notice && <span className="hidden rounded-full bg-white/70 px-4 py-2 text-xs font-black text-primary shadow-sm sm:block">{state.notice}</span>}
            <div className="hidden min-w-0 items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-black text-foreground shadow-sm dark:border-white/10 dark:bg-white/10 md:flex">
              <ShieldCheck size={15} className="shrink-0 text-primary" />
              <span className="max-w-[9rem] truncate">{adminName}</span>
            </div>
            <button type="button" onClick={() => state.setConfirmModal({ type: "logout" })} className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-black text-rose-500 shadow-sm transition-transform hover:scale-105 dark:border-white/10 dark:bg-white/10">
              <LogOut size={15} /><span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile tab bar */}
        <div className="mb-4 flex shrink-0 gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
          {dashboardTabs.map((item) => (
            <button key={item.id} onClick={() => state.setTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-colors ${state.tab === item.id ? "bg-primary text-primary-foreground shadow-md" : "border border-white/60 bg-white/70 text-muted-foreground dark:bg-white/10"}`}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          {/* Desktop sidebar */}
          <aside className="hidden min-h-0 rounded-3xl border border-white/60 bg-white/55 p-3 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-white/10 lg:block">
            <div className="space-y-2">
              {dashboardTabs.map((item) => (
                <button key={item.id} onClick={() => state.setTab(item.id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition-colors ${state.tab === item.id ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-white/70 dark:hover:bg-white/10"}`}>
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto rounded-3xl border border-white/60 bg-white/45 p-4 shadow-xl backdrop-blur-sm scrollbar-hide dark:border-white/10 dark:bg-white/10 sm:p-5 lg:p-6">
            {state.tab === "overview" && (
              <OverviewTab
                timeRange={calculations.timeRange} setTimeRange={calculations.setTimeRange}
                todaySessions={calculations.todaySessions} sessions={sessions} allPhotos={state.allPhotoUrls}
                totalRevenue={calculations.totalRevenue} filters={filters} frames={frames}
                chartData={calculations.chartData} layoutDistributionData={calculations.layoutDistributionData}
                formatDistributionData={calculations.layoutDistributionData}
                hourlyTrafficData={calculations.hourlyTrafficData} uiTheme={uiTheme}
                onClearSessions={() => state.setConfirmModal({ type: "clear_sessions" })}
                onSelectPhoto={(photo) => state.setSelectedPhoto(photo)}
              />
            )}
            {state.tab === "orders" && (
              <OrdersTab orders={calculations.safeOrders} todayOrders={calculations.todayOrders} pendingOrderCount={calculations.pendingOrderCount} paidOrderRevenue={calculations.paidOrderRevenue} onRefresh={state.asyncRefresh} onExportCsv={state.exportOrdersCsv} />
            )}
            {state.tab === "theme" && (
              <ThemeTab uiTheme={uiTheme} updateTheme={state.updateTheme} applyBackgroundPreset={state.applyBackgroundPreset} onResetTheme={onUpdateTheme} />
            )}
            {state.tab === "gallery" && (
              <GalleryTab sessions={sessions} allPhotos={calculations.allPhotos} onSelectPhoto={(p) => state.setSelectedPhoto(p)} />
            )}
            {state.tab === "vouchers" && (
              <VouchersTab
                sessionPrice={sessionPrice} vouchers={vouchers ?? []}
                voucherDraft={state.voucherDraft} setVoucherDraft={state.setVoucherDraft}
                voucherSaving={state.voucherSaving} onSaveVoucher={state.saveVoucher}
                onToggleVoucher={onToggleVoucher} onExportCsv={state.exportVouchersCsv}
                onOpenEditModal={(v) => state.setEditVoucherModal({ id: v.id, code: v.code, discountType: v.discountType as "fixed" | "percent", discountValue: v.discountValue, maxUses: v.maxUses, startsAt: v.startsAt ? new Date(v.startsAt).toISOString().slice(0, 16) : "", expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString().slice(0, 16) : "", saving: false })}
                onOpenDeleteModal={(id, code) => state.setConfirmModal({ type: "delete_voucher", voucherId: id, voucherCode: code })}
                onSaveNotice={state.saveNotice}
              />
            )}
            {state.tab === "monitoring" && (
              <MonitoringTab booths={booths ?? []} onRefresh={state.asyncRefresh} />
            )}
            {state.tab === "admins" && (
              <AdminsTab
                admins={admins ?? []} adminDraft={state.adminDraft} setAdminDraft={state.setAdminDraft}
                adminSaving={state.adminSaving} auditLogs={auditLogs ?? []} boothEvents={boothEvents ?? []}
                onSaveAdmin={state.saveAdmin} onUpdateAdmin={onUpdateAdmin} onRefresh={state.asyncRefresh}
                onOpenDeactivateModal={(adminId, adminUsername) => state.setConfirmModal({ type: "deactivate_admin", adminId, adminUsername })}
                onShowResult={state.showActionResult}
              />
            )}
            {state.tab === "filters" && (
              <FiltersTab
                filters={filters} filterDraft={state.filterDraft} setFilterDraft={state.setFilterDraft}
                filterBuilder={state.filterBuilder} setFilterBuilder={state.setFilterBuilder}
                onSaveFilter={state.saveFilter} onUpdateFilters={onUpdateFilters}
                onOpenDeleteFilterModal={(id, label) => state.setConfirmModal({ type: "delete_filter", filterId: id, filterLabel: label, onConfirm: () => { onUpdateFilters((c) => c.filter((f) => f.id !== id)); state.showActionResult("success", "Filter Dihapus! 🗑️", `Filter "${label}" berhasil dihapus.`); } })}
              />
            )}
            {state.tab === "frames" && (
              <FramesTab
                frames={frames} frameDraft={state.frameDraft} setFrameDraft={state.setFrameDraft}
                frameFormRef={state.frameFormRef} loadFrameOverlay={state.loadFrameOverlay}
                scanAndLockSlots={state.scanAndLockSlots} saveFrame={state.saveFrame} onUpdateFrames={onUpdateFrames}
                onOpenDeleteFrameModal={(id, label) => state.setConfirmModal({ type: "delete_frame", frameId: id, frameLabel: label, onConfirm: () => { onUpdateFrames((c) => c.filter((f) => f.id !== id)); state.showActionResult("success", "Frame Dihapus! 🗑️", `Frame "${label}" berhasil dihapus.`); } })}
              />
            )}
          </main>
        </div>
      </div>

      <DashboardModals
        adminName={adminName}
        showLoginSuccess={showLoginSuccess}
        onCloseLoginSuccess={onCloseLoginSuccess}
        confirmModal={state.confirmModal}
        setConfirmModal={state.setConfirmModal}
        actionResultModal={state.actionResultModal}
        setActionResultModal={state.setActionResultModal}
        editVoucherModal={state.editVoucherModal}
        setEditVoucherModal={state.setEditVoucherModal}
        selectedPhoto={state.selectedPhoto}
        setSelectedPhoto={state.setSelectedPhoto}
        onLogout={onLogout}
        onClearSessions={onClearSessions}
        onDeleteVoucher={onDeleteVoucher}
        onDeactivateAdmin={onDeactivateAdmin}
        onUpdateVoucher={onUpdateVoucher}
        showActionResult={state.showActionResult}
      />
    </motion.div>
  );
}
