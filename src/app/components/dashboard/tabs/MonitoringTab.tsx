import { Power, RefreshCcw, Wifi, WifiOff } from "lucide-react";
import type { BoothMonitor } from "../../../types/photobooth";
import { formatDate } from "../DashboardUtils";

interface MonitoringTabProps {
  booths: BoothMonitor[];
  onRefresh: () => Promise<void>;
}

export function MonitoringTab({ booths, onRefresh }: MonitoringTabProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground">Booth Monitor</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Heartbeat agent, printer, queue, dan layar aktif.</p>
        </div>
        <button type="button" onClick={() => void onRefresh()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/80 px-4 text-sm font-black text-primary shadow-sm dark:bg-white/10">
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {booths.map((booth) => (
          <article key={booth.id} className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-foreground">{booth.name}</p>
                <p className="truncate font-mono text-[11px] font-bold text-muted-foreground">{booth.id}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${booth.online ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {booth.online ? <Wifi size={13} /> : <WifiOff size={13} />}{booth.online ? "Online" : "Offline"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-bold">
              <div><p className="text-muted-foreground">Layar</p><p className="mt-1 truncate text-foreground">{booth.status.kioskScreen || "-"}</p></div>
              <div><p className="text-muted-foreground">Kamera</p><p className="mt-1 truncate text-foreground">{booth.status.camera?.available ? booth.status.camera.selectedDeviceLabel || "Ready" : booth.status.camera?.status || "Unknown"}</p></div>
              <div><p className="text-muted-foreground">Printer</p><p className="mt-1 truncate text-foreground">{booth.status.printer?.available ? booth.status.printer.name || "Ready" : "Unavailable"}</p></div>
              <div><p className="text-muted-foreground">Queue</p><p className="mt-1 text-foreground">{Number(booth.status.queueLength || 0)} job</p></div>
              <div><p className="text-muted-foreground">Version</p><p className="mt-1 truncate text-foreground">{booth.version || "-"}</p></div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] font-semibold text-muted-foreground">
              <Power size={13} /> {booth.lastSeenAt ? `Heartbeat ${formatDate(booth.lastSeenAt)}` : "Belum pernah terhubung"}
            </div>
          </article>
        ))}
        {booths.length === 0 && <p className="rounded-2xl bg-white/70 p-5 text-sm font-bold text-muted-foreground">Belum ada booth terdaftar.</p>}
      </div>
    </section>
  );
}
