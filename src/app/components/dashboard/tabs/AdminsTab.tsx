import { RefreshCcw, ShieldCheck, UserPlus } from "lucide-react";
import type { AdminAccount, AdminAuditLog, BoothEvent } from "../../../types/photobooth";
import { formatDate } from "../DashboardUtils";

interface AdminsTabProps {
  admins: AdminAccount[];
  adminDraft: { username: string; displayName: string; password: string };
  setAdminDraft: React.Dispatch<React.SetStateAction<{ username: string; displayName: string; password: string }>>;
  adminSaving: boolean;
  auditLogs: AdminAuditLog[];
  boothEvents: BoothEvent[];
  onSaveAdmin: () => Promise<void>;
  onUpdateAdmin: (id: string, patch: { displayName?: string; password?: string; active?: boolean }) => Promise<void>;
  onRefresh: () => Promise<void>;
  onOpenDeactivateModal: (adminId: string, username: string) => void;
  onShowResult: (type: "success" | "error", title: string, message: string) => void;
}

export function AdminsTab({
  admins,
  adminDraft,
  setAdminDraft,
  adminSaving,
  auditLogs,
  boothEvents,
  onSaveAdmin,
  onUpdateAdmin,
  onRefresh,
  onOpenDeactivateModal,
  onShowResult,
}: AdminsTabProps) {
  const safeAdmins = (admins || []).filter((admin): admin is AdminAccount => Boolean(admin && admin.username));
  const activeAdminCount = safeAdmins.filter((admin) => admin.active).length;

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-foreground">Admin Access</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">Kelola akun operator dashboard.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">
              <ShieldCheck size={14} /> {activeAdminCount} aktif
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm font-black text-foreground">
              Username
              <input
                value={adminDraft.username}
                onChange={(event) => setAdminDraft((current) => ({ ...current, username: event.target.value.toLowerCase() }))}
                placeholder="operator"
                className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
              />
            </label>
            <label className="space-y-1 text-sm font-black text-foreground">
              Nama
              <input
                value={adminDraft.displayName}
                onChange={(event) => setAdminDraft((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Operator Booth"
                className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
              />
            </label>
            <label className="space-y-1 text-sm font-black text-foreground">
              Password
              <input
                type="password"
                value={adminDraft.password}
                onChange={(event) => setAdminDraft((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimal 8 karakter"
                className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void onSaveAdmin()}
            disabled={adminSaving || adminDraft.username.trim().length < 3 || adminDraft.password.length < 8}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-md transition-transform enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <UserPlus size={17} /> {adminSaving ? "Menyimpan..." : "Tambah Admin"}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
          <div className="flex items-center justify-between border-b border-white/60 px-4 py-3 dark:border-white/10">
            <h3 className="text-sm font-black text-foreground">Daftar Admin</h3>
            <button type="button" onClick={() => void onRefresh()} className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-primary shadow-sm dark:bg-white/10" aria-label="Refresh admin">
              <RefreshCcw size={15} />
            </button>
          </div>
          <div className="divide-y divide-white/60 dark:divide-white/10">
            {safeAdmins.map((admin) => (
              <div key={admin.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-foreground">{admin.displayName}</p>
                    {admin.isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">Anda</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${admin.active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {admin.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs font-bold text-muted-foreground">@{admin.username}</p>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    Update {admin.updatedAt ? formatDate(admin.updatedAt) : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {admin.active ? (
                    <button
                      type="button"
                      disabled={admin.isCurrent}
                      onClick={() => onOpenDeactivateModal(admin.id, admin.username)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Nonaktifkan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void onUpdateAdmin(admin.id, { active: true })
                          .then(() => onShowResult("success", "Admin Diaktifkan", `Akun ${admin.username} sudah aktif lagi.`))
                          .catch((error) => onShowResult("error", "Gagal Mengaktifkan Admin", error instanceof Error ? error.message : "Error"));
                      }}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      Aktifkan
                    </button>
                  )}
                </div>
              </div>
            ))}
            {safeAdmins.length === 0 && <p className="p-5 text-sm font-bold text-muted-foreground">Belum ada admin lain.</p>}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
          <h3 className="text-sm font-black text-foreground">Audit Terbaru</h3>
          <div className="mt-3 space-y-2">
            {auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="rounded-xl bg-white/75 p-3 text-xs font-bold dark:bg-white/10">
                <p className="truncate text-foreground">{log.action}</p>
                <p className="mt-1 truncate text-muted-foreground">{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{log.createdAt ? formatDate(log.createdAt) : "-"}</p>
              </div>
            ))}
            {auditLogs.length === 0 && <p className="text-sm font-bold text-muted-foreground">Belum ada audit log.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
          <h3 className="text-sm font-black text-foreground">Event Booth</h3>
          <div className="mt-3 space-y-2">
            {boothEvents.slice(0, 6).map((event) => (
              <div key={event.id} className="rounded-xl bg-white/75 p-3 text-xs font-bold dark:bg-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-foreground">{event.eventType}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${event.level === "warning" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{event.level}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{event.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{event.createdAt ? formatDate(event.createdAt) : "-"}</p>
              </div>
            ))}
            {boothEvents.length === 0 && <p className="text-sm font-bold text-muted-foreground">Belum ada event perangkat.</p>}
          </div>
        </div>
      </aside>
    </section>
  );
}
