import { Download, RefreshCcw } from "lucide-react";
import type { OrderRecord } from "../../../types/photobooth";
import { formatMoney, formatOptionalDate } from "../DashboardUtils";

interface OrdersTabProps {
  orders: OrderRecord[];
  todayOrders: OrderRecord[];
  pendingOrderCount: number;
  paidOrderRevenue: number;
  onRefresh: () => Promise<void>;
  onExportCsv: () => void;
}

const STATUS_META: Record<OrderRecord["status"], { label: string; bg: string; text: string }> = {
  pending:  { label: "Menunggu", bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-700 dark:text-amber-300" },
  paid:     { label: "Lunas",    bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-700 dark:text-emerald-300" },
  expired:  { label: "Expired",  bg: "bg-zinc-100 dark:bg-zinc-800",         text: "text-zinc-600 dark:text-zinc-400" },
  failed:   { label: "Gagal",    bg: "bg-rose-100 dark:bg-rose-950/60",      text: "text-rose-600 dark:text-rose-300" },
};

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-xl font-black leading-tight text-foreground sm:text-3xl">{value}</p>
    </div>
  );
}

function OrderCard({ order }: { order: OrderRecord }) {
  const s = STATUS_META[order.status] ?? { label: order.status, bg: "bg-zinc-100", text: "text-zinc-600" };
  return (
    <article className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-black text-foreground">{order.orderId}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{formatOptionalDate(order.createdAt)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${s.bg} ${s.text}`}>{s.label}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="font-black uppercase tracking-wide text-muted-foreground">Metode</p>
          <p className="mt-0.5 font-bold text-foreground">{order.method.toUpperCase()}</p>
        </div>
        <div>
          <p className="font-black uppercase tracking-wide text-muted-foreground">Diskon</p>
          <p className="mt-0.5 font-bold text-emerald-600">-{formatMoney(order.discountAmount)}</p>
        </div>
        <div>
          <p className="font-black uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-0.5 font-black text-primary">{formatMoney(order.amount)}</p>
        </div>
      </div>

      {order.voucherCode && (
        <p className="mt-2 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
          🎟 {order.voucherCode}
        </p>
      )}
    </article>
  );
}

export function OrdersTab({
  orders,
  todayOrders,
  pendingOrderCount,
  paidOrderRevenue,
  onRefresh,
  onExportCsv,
}: OrdersTabProps) {
  const safeOrders = (orders || []).filter((o): o is OrderRecord => Boolean(o && o.orderId));

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground">Order Masuk</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Daftar transaksi QRIS/voucher dari kiosk.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void onRefresh()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/80 px-4 text-sm font-black text-primary shadow-sm dark:bg-white/10">
            <RefreshCcw size={16} /> Refresh
          </button>
          <button type="button" onClick={onExportCsv} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-md">
            <Download size={16} /> Ekspor CSV
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Order hari ini" value={todayOrders.length} />
        <MetricCard label="Total order"    value={safeOrders.length} />
        <MetricCard label="Pending"        value={pendingOrderCount} />
        <MetricCard label="Omset lunas"    value={formatMoney(paidOrderRevenue)} />
      </div>

      {/* Empty state */}
      {safeOrders.length === 0 && (
        <p className="rounded-2xl bg-white/70 p-5 text-sm font-bold text-muted-foreground dark:bg-white/10">
          Belum ada order masuk.
        </p>
      )}

      {/* Responsive: card grid up to 2xl screens, table on ultra wide 2xl */}
      {safeOrders.length > 0 && (
        <>
          {/* Card grid — shown on mobile, tablet & landscape screens up to 2xl */}
          <div className="grid gap-3 sm:grid-cols-2 2xl:hidden">
            {safeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {/* Compact table — 7 columns, shown only on 2xl+ */}
          <div className="hidden 2xl:block overflow-hidden rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/60 bg-white/70 text-[10.5px] font-black uppercase text-muted-foreground dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3 text-right">Harga</th>
                  <th className="px-4 py-3 text-right">Diskon</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60 dark:divide-white/10">
                {safeOrders.map((order) => {
                  const s = STATUS_META[order.status] ?? { label: order.status, bg: "bg-zinc-100", text: "text-zinc-600" };
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-white/55 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-black text-foreground">{order.orderId}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatOptionalDate(order.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${s.bg} ${s.text}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 font-bold uppercase text-foreground">{order.method}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatMoney(order.baseAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">-{formatMoney(order.discountAmount)}</td>
                      <td className="px-4 py-3 text-right font-black text-primary">{formatMoney(order.amount)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{order.voucherCode || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
