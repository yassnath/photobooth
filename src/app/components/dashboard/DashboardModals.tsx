import { motion, AnimatePresence } from "motion/react";
import { LogOut, Pencil, Trash2, X } from "lucide-react";
import { CustomSelect } from "../shared/CustomSelect";
import { CustomDateTimePicker } from "../shared/CustomDateTimePicker";
import type { Voucher } from "../../types/photobooth";

export interface ConfirmModalState {
  type: "logout" | "clear_sessions" | "delete_voucher" | "delete_frame" | "delete_filter" | "deactivate_admin";
  voucherId?: string;
  voucherCode?: string;
  frameId?: string;
  frameLabel?: string;
  filterId?: string;
  filterLabel?: string;
  adminId?: string;
  adminUsername?: string;
  onConfirm?: () => void;
}

export interface ActionResultModalState {
  type: "success" | "error" | "info";
  title: string;
  message: string;
}

export interface EditVoucherModalState {
  id: string;
  code: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  maxUses: number | null;
  startsAt: string;
  expiresAt: string;
  saving: boolean;
}

interface DashboardModalsProps {
  adminName: string;
  showLoginSuccess?: boolean;
  onCloseLoginSuccess?: () => void;
  confirmModal: ConfirmModalState | null;
  setConfirmModal: (state: ConfirmModalState | null) => void;
  actionResultModal: ActionResultModalState | null;
  setActionResultModal: (state: ActionResultModalState | null) => void;
  editVoucherModal: EditVoucherModalState | null;
  setEditVoucherModal: React.Dispatch<React.SetStateAction<EditVoucherModalState | null>>;
  selectedPhoto: string | null;
  setSelectedPhoto: (photo: string | null) => void;
  onLogout: () => void;
  onClearSessions: () => void;
  onDeleteVoucher: (id: string) => Promise<void>;
  onDeactivateAdmin: (id: string) => Promise<void>;
  onUpdateVoucher: (id: string, patch: Partial<Voucher>) => Promise<void>;
  showActionResult: (type: "success" | "error" | "info", title: string, message: string) => void;
}

export function DashboardModals({
  adminName,
  showLoginSuccess,
  onCloseLoginSuccess,
  confirmModal,
  setConfirmModal,
  actionResultModal,
  setActionResultModal,
  editVoucherModal,
  setEditVoucherModal,
  selectedPhoto,
  setSelectedPhoto,
  onLogout,
  onClearSessions,
  onDeleteVoucher,
  onDeactivateAdmin,
  onUpdateVoucher,
  showActionResult,
}: DashboardModalsProps) {
  return (
    <>
      <AnimatePresence>
        {showLoginSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md"
            onClick={onCloseLoginSuccess}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-b from-white via-pink-50/90 to-purple-50/70 p-6 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-600 text-3xl text-white shadow-xl">
                ✨
              </div>
              <h3 className="mt-4 text-xl font-black text-foreground">Login Berhasil!</h3>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Selamat datang kembali di Dashboard Admin, <span className="font-bold text-primary">{adminName}</span> 🎉
              </p>
              <button
                type="button"
                onClick={onCloseLoginSuccess}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 py-3 text-xs font-black text-white shadow-lg transition-transform hover:scale-[1.02]"
              >
                Masuk ke Dashboard
              </button>
              <button
                onClick={onCloseLoginSuccess}
                className="absolute right-4 top-4 rounded-full bg-rose-100/90 p-1.5 text-rose-500 hover:bg-rose-200 hover:text-rose-700 shadow-sm transition-colors dark:bg-rose-950/60 dark:text-rose-400"
                aria-label="Tutup notifikasi"
              >
                <X size={16} />
              </button>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 2, ease: "linear" }}
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-pink-500 to-violet-500"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setConfirmModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-900/95 backdrop-blur-xl"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl shadow-xs ${confirmModal.type === "logout"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400"
                    : "bg-rose-100 text-rose-500 dark:bg-rose-950/70 dark:text-rose-400"
                    }`}
                >
                  {confirmModal.type === "logout" ? <LogOut size={22} /> : <Trash2 size={22} />}
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <h3 className="text-base font-black text-foreground">
                    {confirmModal.type === "logout" && "Konfirmasi Logout"}
                    {confirmModal.type === "clear_sessions" && "Hapus Semua Sesi Foto"}
                    {confirmModal.type === "delete_voucher" && `Hapus Voucher ${confirmModal.voucherCode}`}
                    {confirmModal.type === "delete_frame" && `Hapus Frame ${confirmModal.frameLabel}`}
                    {confirmModal.type === "delete_filter" && `Hapus Filter ${confirmModal.filterLabel}`}
                    {confirmModal.type === "deactivate_admin" && `Nonaktifkan Admin ${confirmModal.adminUsername}`}
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-purple-600 dark:text-purple-300">
                    {confirmModal.type === "logout" && "Apakah Anda yakin ingin keluar dari Dashboard Admin PixieBooth?"}
                    {confirmModal.type === "clear_sessions" && "Tindakan ini akan menghapus riwayat sesi foto secara permanen."}
                    {confirmModal.type === "delete_voucher" && `Voucher ${confirmModal.voucherCode} akan dihapus dari database.`}
                    {confirmModal.type === "delete_frame" && `Frame ${confirmModal.frameLabel} akan dihapus dari database.`}
                    {confirmModal.type === "delete_filter" && `Filter ${confirmModal.filterLabel} akan dihapus dari database.`}
                    {confirmModal.type === "deactivate_admin" && `Akun ${confirmModal.adminUsername} tidak bisa login sampai diaktifkan kembali.`}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="rounded-full border border-gray-200 bg-white px-5 py-2 text-xs font-black text-foreground shadow-xs transition-colors hover:bg-gray-100 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmModal.onConfirm) {
                      confirmModal.onConfirm();
                    } else {
                      if (confirmModal.type === "logout") onLogout();
                      if (confirmModal.type === "clear_sessions") {
                        onClearSessions();
                        showActionResult("success", "Sesi Foto Dibersihkan 🧹", "Riwayat sesi foto telah berhasil dibersihkan.");
                      }
                      if (confirmModal.type === "delete_voucher" && confirmModal.voucherId) {
                        const code = confirmModal.voucherCode || "";
                        void onDeleteVoucher(confirmModal.voucherId)
                          .then(() => showActionResult("success", "Voucher Dihapus! 🗑️", `Voucher ${code} telah dihapus dari database.`))
                          .catch((error) => showActionResult("error", "Gagal Menghapus ❌", error.message));
                      }
                      if (confirmModal.type === "deactivate_admin" && confirmModal.adminId) {
                        const username = confirmModal.adminUsername || "";
                        void onDeactivateAdmin(confirmModal.adminId)
                          .then(() => showActionResult("success", "Admin Dinonaktifkan", `Akun ${username} sudah dinonaktifkan.`))
                          .catch((error) => showActionResult("error", "Gagal Menonaktifkan Admin", error.message));
                      }
                    }
                    setConfirmModal(null);
                  }}
                  className={`rounded-full px-5 py-2 text-xs font-black text-white shadow-md transition-transform active:scale-95 ${confirmModal.type === "logout"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    : "bg-[#e11d48] hover:bg-[#be123c] shadow-rose-200 dark:shadow-none"
                    }`}
                >
                  {confirmModal.type === "logout" && "Ya, Logout"}
                  {confirmModal.type === "clear_sessions" && "Ya, Hapus Semua Sesi"}
                  {confirmModal.type === "delete_voucher" && "Ya, Hapus Voucher"}
                  {confirmModal.type === "delete_frame" && "Ya, Hapus Frame"}
                  {confirmModal.type === "delete_filter" && "Ya, Hapus Filter"}
                  {confirmModal.type === "deactivate_admin" && "Ya, Nonaktifkan"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-rose-100/90 text-rose-500 shadow-xs transition-colors hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-400"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionResultModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md"
            onClick={() => setActionResultModal(null)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-b from-white via-pink-50/90 to-purple-50/70 p-6 text-center shadow-2xl"
            >
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg ${actionResultModal.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400' : actionResultModal.type === 'error' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400'
                }`}>
                {actionResultModal.type === 'success' && '✨'}
                {actionResultModal.type === 'error' && '❌'}
                {actionResultModal.type === 'info' && '⚡'}
              </div>

              <h3 className="mt-4 text-lg font-black text-foreground">
                {actionResultModal.title}
              </h3>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">
                {actionResultModal.message}
              </p>

              <button
                type="button"
                onClick={() => setActionResultModal(null)}
                className={`mt-5 w-full rounded-2xl py-3 text-xs font-black text-white shadow-lg transition-transform hover:scale-[1.02] ${actionResultModal.type === 'success' ? 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600' : actionResultModal.type === 'error' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'
                  }`}
              >
                Tutup
              </button>

              <button
                onClick={() => setActionResultModal(null)}
                className="absolute right-4 top-4 rounded-full bg-rose-100/90 p-1.5 text-rose-500 hover:bg-rose-200 hover:text-rose-700 shadow-sm transition-colors dark:bg-rose-950/60 dark:text-rose-400"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>

              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 2.2, ease: "linear" }}
                className={`absolute bottom-0 left-0 h-1 ${actionResultModal.type === 'success' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : actionResultModal.type === 'error' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'
                  }`}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editVoucherModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-4 backdrop-blur-md"
            onClick={() => setEditVoucherModal(null)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative my-auto w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl border border-white/80 bg-gradient-to-b from-white via-pink-50/90 to-purple-50/70 p-6 shadow-2xl"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-violet-600 text-white shadow-xl">
                <Pencil size={24} />
              </div>
              <h3 className="mt-4 text-center text-lg font-black text-foreground">Edit Voucher</h3>
              <p className="mt-1 text-center font-mono text-xs font-bold text-muted-foreground">{editVoucherModal.code}</p>

              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs font-black text-foreground">
                    Tipe Diskon
                    <CustomSelect
                      value={editVoucherModal.discountType}
                      onChange={(val) => setEditVoucherModal((curr) => curr ? { ...curr, discountType: val as "fixed" | "percent" } : null)}
                      options={[
                        { value: "fixed", label: "Nominal (Rp)", badge: "Rp" },
                        { value: "percent", label: "Persentase (%)", badge: "%" },
                      ]}
                      className="mt-1"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-black text-foreground">
                    Nilai Diskon
                    <input
                      type="number"
                      min={1}
                      value={editVoucherModal.discountValue}
                      onChange={(e) => setEditVoucherModal((curr) => curr ? { ...curr, discountValue: Math.max(1, Number(e.target.value) || 1) } : null)}
                      className="mt-1 w-full rounded-xl border border-white bg-white/85 px-3 py-2.5 text-xs font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                    />
                  </label>
                </div>
                <label className="space-y-1 text-xs font-black text-foreground">
                  Kuota Penggunaan
                  <input
                    type="number"
                    min={1}
                    value={editVoucherModal.maxUses ?? ""}
                    onChange={(e) => setEditVoucherModal((curr) => curr ? { ...curr, maxUses: e.target.value ? Math.max(1, Number(e.target.value)) : null } : null)}
                    placeholder="Tanpa batas"
                    className="mt-1 w-full rounded-xl border border-white bg-white/85 px-3 py-2.5 text-xs font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                  />
                </label>
                <div className="space-y-2">
                  <label className="space-y-1 text-xs font-black text-foreground">
                    Mulai Berlaku
                    <CustomDateTimePicker
                      value={editVoucherModal.startsAt}
                      onChange={(val) => setEditVoucherModal((curr) => curr ? { ...curr, startsAt: val } : null)}
                      placeholder="Mulai sekarang"
                      className="mt-1"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-black text-foreground">
                    Kedaluwarsa
                    <CustomDateTimePicker
                      value={editVoucherModal.expiresAt}
                      onChange={(val) => setEditVoucherModal((curr) => curr ? { ...curr, expiresAt: val } : null)}
                      placeholder="Tanpa kedaluwarsa"
                      className="mt-1"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditVoucherModal(null)}
                  className="flex-1 rounded-2xl border border-white/60 bg-white/70 py-3 text-xs font-black text-muted-foreground transition-all hover:bg-white dark:bg-white/10"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={editVoucherModal.saving}
                  onClick={async () => {
                    setEditVoucherModal((curr) => curr ? { ...curr, saving: true } : null);
                    try {
                      await onUpdateVoucher(editVoucherModal.id, {
                        discountType: editVoucherModal.discountType,
                        discountValue: editVoucherModal.discountValue,
                        maxUses: editVoucherModal.maxUses,
                        startsAt: editVoucherModal.startsAt ? new Date(editVoucherModal.startsAt).toISOString() : null,
                        expiresAt: editVoucherModal.expiresAt ? new Date(editVoucherModal.expiresAt).toISOString() : null,
                      });
                      setEditVoucherModal(null);
                      showActionResult("success", "Voucher Berhasil Diperbarui! ✨", `Voucher ${editVoucherModal.code} telah berhasil diperbarui.`);
                    } catch (error) {
                      setEditVoucherModal((curr) => curr ? { ...curr, saving: false } : null);
                      showActionResult("error", "Gagal Memperbarui Voucher ❌", error instanceof Error ? error.message : "Voucher gagal diperbarui.");
                    }
                  }}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3 text-xs font-black text-white shadow-lg transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editVoucherModal.saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>

              <button
                onClick={() => setEditVoucherModal(null)}
                className="absolute right-4 top-4 rounded-full bg-rose-100/90 p-1.5 text-rose-500 hover:bg-rose-200 hover:text-rose-700 shadow-sm transition-colors dark:bg-rose-950/60 dark:text-rose-400"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPhoto(null)}
          >
            <img src={selectedPhoto} alt="Selected captured result" className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
            <button
              className="absolute right-5 top-5 rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/35"
              onClick={() => setSelectedPhoto(null)}
              aria-label="Close preview"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
