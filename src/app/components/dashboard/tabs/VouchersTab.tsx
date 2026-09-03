import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import type { Voucher } from "../../../types/photobooth";
import { CustomSelect } from "../../shared/CustomSelect";
import { CustomDateTimePicker } from "../../shared/CustomDateTimePicker";
import { formatDate, formatOptionalDate } from "../DashboardUtils";

interface VouchersTabProps {
  sessionPrice: number;
  vouchers: Voucher[];
  voucherDraft: {
    code: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    maxUses: number | null;
    startsAt: string;
    expiresAt: string;
  };
  setVoucherDraft: React.Dispatch<React.SetStateAction<{
    code: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    maxUses: number | null;
    startsAt: string;
    expiresAt: string;
  }>>;
  voucherSaving: boolean;
  onSaveVoucher: () => Promise<void>;
  onToggleVoucher: (id: string, active: boolean) => Promise<void>;
  onExportCsv: () => void;
  onOpenEditModal: (voucher: Voucher) => void;
  onOpenDeleteModal: (id: string, code: string) => void;
  onSaveNotice: (msg: string) => void;
}

export function VouchersTab({
  sessionPrice,
  vouchers,
  voucherDraft,
  setVoucherDraft,
  voucherSaving,
  onSaveVoucher,
  onToggleVoucher,
  onExportCsv,
  onOpenEditModal,
  onOpenDeleteModal,
  onSaveNotice,
}: VouchersTabProps) {
  const safeVouchers = (vouchers || []).filter((v): v is Voucher => Boolean(v && v.code));

  const formatVoucherValue = (voucher: Voucher) =>
    voucher.discountType === "percent"
      ? `${voucher.discountValue}%`
      : `Rp${voucher.discountValue.toLocaleString("id-ID")}`;

  const discountAmount = Math.min(
    sessionPrice,
    voucherDraft.discountType === "percent"
      ? Math.round((sessionPrice * voucherDraft.discountValue) / 100)
      : voucherDraft.discountValue,
  );

  const finalAmount = Math.max(0, sessionPrice - discountAmount);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground">Voucher & Discount</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Diskon dihitung server sebelum QRIS dinamis dibuat.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExportCsv}
            className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/85 px-4 py-2.5 text-xs font-black text-foreground shadow-sm transition-all hover:bg-white dark:border-white/10 dark:bg-white/10"
          >
            <Download size={15} className="text-primary" /> Ekspor CSV
          </button>
          <div className="rounded-xl bg-white/75 px-4 py-2 text-right shadow-sm dark:bg-white/10">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Harga sesi</p>
            <p className="text-lg font-black text-primary">Rp{sessionPrice.toLocaleString("id-ID")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-2xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm font-black text-foreground">
              Kode voucher
              <input
                value={voucherDraft.code}
                onChange={(event) =>
                  setVoucherDraft((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                  }))
                }
                placeholder="EVENT25"
                maxLength={32}
                className="w-full rounded-xl border border-white bg-white/85 px-4 py-3 font-mono text-sm uppercase outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
              />
            </label>
            <label className="space-y-1 text-sm font-black text-foreground">
              Tipe diskon
              <CustomSelect
                value={voucherDraft.discountType}
                onChange={(val) => setVoucherDraft((current) => ({ ...current, discountType: val as "fixed" | "percent" }))}
                options={[
                  { value: "fixed", label: "Nominal Rupiah (Rp)", badge: "Rp" },
                  { value: "percent", label: "Persentase (%)", badge: "%" },
                ]}
                className="mt-1"
              />
            </label>
            <label className="space-y-1 text-sm font-black text-foreground">
              Nilai diskon
              <input
                type="number"
                min={1}
                max={voucherDraft.discountType === "percent" ? 100 : sessionPrice}
                value={voucherDraft.discountValue}
                onChange={(event) =>
                  setVoucherDraft((current) => ({ ...current, discountValue: Math.max(1, Number(event.target.value) || 1) }))
                }
                className="mt-1 w-full rounded-xl border border-white bg-white/85 px-4 py-2.5 text-sm font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
              />
            </label>
            <label className="space-y-1 text-sm font-black text-foreground">
              Kuota penggunaan
              <input
                type="number"
                min={1}
                value={voucherDraft.maxUses ?? ""}
                onChange={(event) =>
                  setVoucherDraft((current) => ({
                    ...current,
                    maxUses: event.target.value ? Math.max(1, Number(event.target.value)) : null,
                  }))
                }
                placeholder="Tanpa batas"
                className="mt-1 w-full rounded-xl border border-white bg-white/85 px-4 py-2.5 text-sm font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
              />
            </label>
            <label className="space-y-1 text-sm font-black text-foreground">
              Mulai berlaku
              <CustomDateTimePicker
                value={voucherDraft.startsAt}
                onChange={(val) => setVoucherDraft((current) => ({ ...current, startsAt: val || "" }))}
                placeholder="Mulai sekarang"
                className="mt-1"
              />
            </label>
            <label className="space-y-1 text-sm font-black text-foreground">
              Kedaluwarsa
              <CustomDateTimePicker
                value={voucherDraft.expiresAt}
                onChange={(val) => setVoucherDraft((current) => ({ ...current, expiresAt: val || "" }))}
                placeholder="Tanpa kedaluwarsa"
                className="mt-1"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void onSaveVoucher()}
            disabled={voucherSaving || voucherDraft.code.length < 3}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-md disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus size={17} /> {voucherSaving ? "Menyimpan..." : "Tambah Voucher"}
          </button>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/10">
          <p className="text-xs font-black uppercase text-muted-foreground">Preview perhitungan</p>
          <div className="mt-4 space-y-3 text-sm font-bold">
            <div className="flex justify-between gap-3">
              <span>Harga awal</span>
              <span>Rp{sessionPrice.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between gap-3 text-emerald-600">
              <span>Diskon</span>
              <span>-Rp{discountAmount.toLocaleString("id-ID")}</span>
            </div>
            <div className="border-t border-border pt-3 text-lg font-black text-primary">
              <div className="flex justify-between gap-3">
                <span>Total QRIS</span>
                <span>Rp{finalAmount.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Grid View — Active on mobile, tablet & landscape screens up to 2xl */}
      <div className="grid gap-3 sm:grid-cols-2 2xl:hidden">
        {safeVouchers.map((voucher) => (
          <article key={voucher.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-black text-foreground">{voucher.code}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Dibuat {formatOptionalDate(voucher.createdAt)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${voucher.active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {voucher.active ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><p className="font-black uppercase text-muted-foreground">Diskon</p><p className="mt-1 font-black text-primary">{formatVoucherValue(voucher)}</p></div>
              <div><p className="font-black uppercase text-muted-foreground">Kuota</p><p className="mt-1 font-bold text-foreground">{voucher.usedCount}/{voucher.maxUses ?? "∞"}</p></div>
              <div><p className="font-black uppercase text-muted-foreground">Mulai</p><p className="mt-1 font-bold text-foreground">{formatOptionalDate(voucher.startsAt)}</p></div>
              <div><p className="font-black uppercase text-muted-foreground">Kedaluwarsa</p><p className="mt-1 font-bold text-foreground">{formatOptionalDate(voucher.expiresAt)}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/60 pt-3 dark:border-white/10">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-white/75 px-3 text-xs font-black text-foreground shadow-sm dark:bg-white/10">
                <input
                  type="checkbox"
                  checked={voucher.active}
                  onChange={(event) => void onToggleVoucher(voucher.id, event.target.checked).catch((error) => onSaveNotice(error.message))}
                  className="h-4 w-4 accent-pink-500"
                />
                {voucher.active ? "Aktif" : "Nonaktif"}
              </label>
              <button
                type="button"
                onClick={() => onOpenEditModal(voucher)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/75 px-3 text-xs font-black text-fuchsia-600 shadow-sm dark:bg-white/10"
              >
                <Pencil size={15} /> Edit
              </button>
              <button
                type="button"
                onClick={() => onOpenDeleteModal(voucher.id, voucher.code)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-600 shadow-sm dark:bg-rose-950/40"
              >
                <Trash2 size={15} /> Hapus
              </button>
            </div>
          </article>
        ))}
        {safeVouchers.length === 0 && <p className="col-span-full rounded-2xl bg-white/70 p-5 text-sm font-bold text-muted-foreground">Belum ada voucher server-side.</p>}
      </div>

      {/* Table View — Ultra wide screens only */}
      <div className="hidden overflow-x-auto rounded-2xl border border-white/70 bg-white/70 dark:border-white/10 dark:bg-white/10 2xl:block">
        <div className="grid min-w-[48rem] grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_6rem_7rem_6rem] gap-3 border-b border-border px-4 py-3 text-[11px] font-black uppercase text-muted-foreground">
          <span>Kode</span><span>Diskon</span><span>Kuota</span><span>Status</span><span>Aksi</span>
        </div>
        {safeVouchers.map((voucher) => (
          <div key={voucher.id} className="grid min-w-[48rem] grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_6rem_7rem_6rem] items-center gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0">
            <div className="min-w-0">
              <p className="truncate font-mono font-black text-foreground">{voucher.code}</p>
              <p className="truncate text-[11px] font-semibold text-muted-foreground">{voucher.expiresAt ? `s.d. ${formatDate(voucher.expiresAt)}` : "Tanpa kedaluwarsa"}</p>
            </div>
            <span className="font-black text-primary">{formatVoucherValue(voucher)}</span>
            <span className="font-bold text-foreground">{voucher.usedCount}/{voucher.maxUses ?? "∞"}</span>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-black">
              <input
                type="checkbox"
                checked={voucher.active}
                onChange={(event) => void onToggleVoucher(voucher.id, event.target.checked).catch((error) => onSaveNotice(error.message))}
                className="h-4 w-4 accent-pink-500"
              />
              {voucher.active ? "Aktif" : "Nonaktif"}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenEditModal(voucher)}
                className="grid h-9 w-9 place-items-center rounded-lg text-fuchsia-500 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30"
                aria-label={`Edit voucher ${voucher.code}`}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => onOpenDeleteModal(voucher.id, voucher.code)}
                className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                aria-label={`Hapus voucher ${voucher.code}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {safeVouchers.length === 0 && <p className="p-5 text-sm font-bold text-muted-foreground">Belum ada voucher server-side.</p>}
      </div>
    </section>
  );
}
