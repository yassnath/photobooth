import { ArrowLeft, CheckCircle2, LoaderCircle, QrCode, RefreshCcw, Sparkles, Ticket, X, XCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { FloatingParticles } from "../components/shared/FloatingParticles";
import { ScannableQRCode } from "../components/shared/ScannableQRCode";
import { pageAnimate, pageIn, pageOut, pageTransition } from "../components/shared/animations";
import type { BoothThemeSettings, PaymentMethod, PaymentRecord } from "../types/photobooth";
import { type PaymentApiRecord, type VoucherQuote, photoboothApi } from "../../shared/api/client";

interface PaymentScreenProps {
  uiTheme: BoothThemeSettings;
  amount?: number;
  onBack: () => void;
  onPaid: (payment: PaymentRecord) => void;
}

function toPaymentRecord(payment: PaymentApiRecord): PaymentRecord {
  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    status: payment.status,
    method: payment.method as PaymentMethod,
    baseAmount: payment.baseAmount,
    discountAmount: payment.discountAmount,
    amount: payment.amount,
    voucherCode: payment.voucherCode,
    expiresAt: payment.expiresAt,
    paidAt: payment.paidAt || new Date().toISOString(),
  };
}

export function PaymentScreen({ uiTheme, amount = 25_000, onBack, onPaid }: PaymentScreenProps) {
  const [method, setMethod] = useState<PaymentMethod>("qris");
  const [payment, setPayment] = useState<PaymentApiRecord | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherQuote, setVoucherQuote] = useState<VoucherQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  const [error, setError] = useState("");
  const [successPayment, setSuccessPayment] = useState<PaymentApiRecord | null>(null);
  const [voucherModal, setVoucherModal] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    quote?: VoucherQuote;
  } | null>(null);
  const initializedRef = useRef(false);
  const completedRef = useRef(false);

  const handleProceed = useCallback((paidPayment: PaymentApiRecord) => {
    onPaid(toPaymentRecord(paidPayment));
  }, [onPaid]);

  const complete = useCallback((paidPayment: PaymentApiRecord) => {
    if (completedRef.current) return;
    completedRef.current = true;
    setSuccessPayment(paidPayment);
  }, []);

  useEffect(() => {
    if (!successPayment) return undefined;
    const timer = window.setTimeout(() => {
      handleProceed(successPayment);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [handleProceed, successPayment]);

  useEffect(() => {
    if (!voucherModal) return undefined;
    const duration = voucherModal.type === "success" ? 5000 : 3000;
    const timer = window.setTimeout(() => {
      setVoucherModal(null);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [voucherModal]);

  const createPayment = useCallback(async (code?: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await photoboothApi.createPayment(code);
      setPayment(response.payment);
      if (response.payment.status === "paid") {
        complete(response.payment);
      } else {
        setMethod("qris");
      }
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Pembayaran tidak dapat dibuat.");
    } finally {
      setLoading(false);
    }
  }, [complete]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void createPayment();
  }, [createPayment]);

  useEffect(() => {
    if (!payment || payment.status !== "pending") return undefined;
    const checkStatus = async () => {
      try {
        const response = await photoboothApi.getPayment(payment.id);
        setPayment(response.payment);
        if (response.payment.status === "paid") complete(response.payment);
        if (response.payment.status === "expired" || response.payment.status === "failed") {
          setError(response.payment.status === "expired" ? "QR pembayaran sudah kedaluwarsa." : "Pembayaran gagal diproses.");
        }
      } catch {
        // A temporary network interruption should not discard the active order.
      }
    };
    const timer = window.setInterval(() => void checkStatus(), 2_000);
    return () => window.clearTimeout(timer);
  }, [complete, payment]);

  const verifyVoucher = async (event: FormEvent) => {
    event.preventDefault();
    setCheckingVoucher(true);
    setVoucherQuote(null);
    setError("");
    try {
      const quote = await photoboothApi.quoteVoucher(voucherCode);
      setVoucherQuote(quote);
      if (quote.valid) {
        setVoucherModal({
          type: "success",
          title: "Voucher Berhasil Dipasang! 🎉",
          message: `Kode ${voucherCode.toUpperCase()} terverifikasi! Potongan diskon Rp${quote.discountAmount.toLocaleString("id-ID")}.`,
          quote,
        });
      } else {
        setVoucherModal({
          type: "error",
          title: "Voucher Tidak Valid ❌",
          message: quote.reason || "Voucher tidak dapat digunakan atau kuota telah habis.",
        });
      }
    } catch (voucherError) {
      const msg = voucherError instanceof Error ? voucherError.message : "Voucher tidak ditemukan atau sudah kedaluwarsa.";
      setError(msg);
      setVoucherModal({
        type: "error",
        title: "Pemeriksaan Voucher Gagal ⚠️",
        message: msg,
      });
    } finally {
      setCheckingVoucher(false);
    }
  };

  const simulate = async () => {
    if (!payment) return;
    setLoading(true);
    try {
      const response = await photoboothApi.simulatePayment(payment.id);
      setPayment(response.payment);
      complete(response.payment);
    } catch (simulationError) {
      setError(simulationError instanceof Error ? simulationError.message : "Simulasi pembayaran gagal.");
    } finally {
      setLoading(false);
    }
  };

  const currentBaseAmount = payment?.baseAmount ?? voucherQuote?.baseAmount ?? amount;
  const currentDiscount = payment?.discountAmount ?? voucherQuote?.discountAmount ?? 0;
  const currentAmount = payment?.amount ?? voucherQuote?.finalAmount ?? currentBaseAmount;

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto"
      initial={pageIn}
      animate={pageAnimate}
      exit={pageOut}
      transition={pageTransition}
    >
      <div className="booth-bg absolute inset-0" />
      <FloatingParticles count={8} />

      <main className="payment-shell relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5 flex items-center gap-3 sm:mb-7">
          <button type="button" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/70 bg-white/70 shadow-md backdrop-blur-sm transition-transform hover:scale-105 dark:bg-white/10" aria-label="Kembali ke pilihan format">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="text-2xl font-black sm:text-3xl" style={{ fontFamily: "Pacifico, cursive" }}>Pembayaran</h2>
            <p className="truncate text-xs font-semibold text-muted-foreground">Sesi dibuka otomatis setelah pembayaran terverifikasi</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Total Bayar</p>
            <p className="text-xl font-black text-primary sm:text-2xl">Rp{currentAmount.toLocaleString("id-ID")}</p>
          </div>
        </header>

        <section className="payment-panel mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/75 shadow-2xl backdrop-blur-md dark:bg-card/85 lg:grid lg:grid-cols-[14rem_1fr] sm:lg:grid-cols-[16rem_1fr]">
          {/* Narrow Left Column */}
          <div className="flex flex-col justify-between bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600 p-5 text-white sm:p-6">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-2xl shadow-inner">{uiTheme.logoEmoji}</div>
                <div className="min-w-0">
                  <p className="text-lg font-black leading-tight">{uiTheme.brandName}</p>
                  <p className="text-[11px] font-mono font-bold text-white/80 truncate">{payment?.orderId ? "Order " + payment.orderId : "Menyiapkan..."}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-2xl bg-black/20 p-4 text-xs font-bold backdrop-blur-sm border border-white/10">
              <div className="flex justify-between text-white/80"><span>Harga Sesi</span><span>Rp{currentBaseAmount.toLocaleString("id-ID")}</span></div>
              {currentDiscount > 0 && <div className="flex justify-between text-emerald-300 font-bold"><span>Voucher</span><span>-Rp{currentDiscount.toLocaleString("id-ID")}</span></div>}
              <div className="flex justify-between border-t border-white/20 pt-2 text-base font-black text-white"><span>Total</span><span>Rp{currentAmount.toLocaleString("id-ID")}</span></div>
            </div>
          </div>

          {/* Expanded Right Column */}
          <div className="flex min-h-0 flex-col p-5 sm:p-7 bg-white/50 dark:bg-card/50">
            <div className="mb-5 grid grid-cols-2 rounded-2xl bg-gray-200/70 dark:bg-muted p-1.5 shadow-inner">
              <button type="button" onClick={() => setMethod("qris")} className={"flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-all " + (method === "qris" ? "bg-white text-pink-600 shadow-md dark:bg-white/20 dark:text-white scale-[1.01]" : "text-muted-foreground hover:text-foreground")}>
                <QrCode size={18} /> Bayar QRIS
              </button>
              <button type="button" onClick={() => setMethod("voucher")} className={"flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-all " + (method === "voucher" ? "bg-white text-pink-600 shadow-md dark:bg-white/20 dark:text-white scale-[1.01]" : "text-muted-foreground hover:text-foreground")}>
                <Ticket size={18} /> Gunakan Voucher
              </button>
            </div>

            {error && (
              <div role="alert" className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs sm:text-sm font-bold text-rose-700 shadow-sm">
                <XCircle size={18} className="shrink-0 text-rose-500" /> <span className="min-w-0 flex-1">{error}</span>
                {method === "qris" && <button type="button" onClick={() => void createPayment()} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white shadow-sm hover:scale-105 transition-transform" aria-label="Buat ulang pembayaran"><RefreshCcw size={14} /></button>}
              </div>
            )}

            {method === "qris" ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center py-2">
                {/* Enlarged QR Code Box (260px x 260px) */}
                <div className="grid h-[260px] w-[260px] place-items-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-2xl ring-1 ring-black/5 transition-transform hover:scale-102">
                  {loading && !payment ? (
                    <LoaderCircle size={42} className="animate-spin text-pink-500" />
                  ) : payment?.qrString ? (
                    <ScannableQRCode value={payment.qrString} size={250} label="QR pembayaran sesi" />
                  ) : payment?.qrImageUrl ? (
                    <img src={payment.qrImageUrl} alt="QR pembayaran sesi" className="h-[250px] w-[250px] object-contain" />
                  ) : (
                    <QrCode size={64} className="text-muted-foreground/30" />
                  )}
                </div>

                <p className="mt-5 text-base sm:text-lg font-black text-foreground">{payment?.status === "paid" ? "Pembayaran Berhasil! 🎉" : "Menunggu Pembayaran QRIS"}</p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-muted-foreground">{payment?.provider === "mock" ? "Pindai kode QR menggunakan m-Banking atau e-Wallet." : "Status transaksi diperiksa otomatis oleh sistem."}</p>

                <div className="mt-4 flex items-center gap-2 rounded-full bg-amber-100/80 dark:bg-amber-950/50 border border-amber-200 px-4 py-1.5 text-xs font-black text-amber-700 dark:text-amber-300 shadow-sm">
                  {payment?.status === "paid" ? <CheckCircle2 size={16} className="text-emerald-500" /> : <LoaderCircle size={16} className="animate-spin text-amber-600" />}
                  {payment?.status === "paid" ? "Terverifikasi" : "Menunggu Verifikasi Pembayaran"}
                </div>

                {payment?.provider === "mock" && payment.status === "pending" && (
                  <button type="button" onClick={() => void simulate()} disabled={loading} className="mt-5 w-full max-w-sm rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-6 py-3.5 text-sm sm:text-base font-black text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                    Simulasikan Pembayaran Berhasil ✨
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={verifyVoucher} className="flex flex-1 flex-col justify-center max-w-md mx-auto w-full py-4">
                <label htmlFor="voucher" className="text-sm font-black text-foreground mb-2 block">Masukkan Kode Voucher Promo</label>
                <div className="flex gap-2">
                  <input
                    id="voucher"
                    value={voucherCode}
                    onChange={(event) => {
                      setVoucherCode(event.target.value.toUpperCase());
                      setVoucherQuote(null);
                      setError("");
                    }}
                    placeholder="CONTOH: PROMOBOOTH"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-2xl border border-pink-200 bg-white px-4 py-3.5 text-sm font-bold uppercase outline-none focus:border-pink-500 shadow-inner dark:bg-white/10"
                  />
                  <button type="submit" disabled={checkingVoucher || voucherCode.trim().length < 3} className="rounded-2xl bg-pink-600 px-6 py-3.5 text-sm font-black text-white shadow-md hover:bg-pink-700 disabled:opacity-45 transition-colors">
                    {checkingVoucher ? "..." : "Cek Voucher"}
                  </button>
                </div>

                {voucherQuote?.valid && (
                  <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3.5 text-sm font-bold text-emerald-800 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-700 font-black"><CheckCircle2 size={18} /> Voucher Berhasil Dipasang!</div>
                    <p className="mt-1 text-xs text-emerald-600">Potongan diskon Rp{voucherQuote.discountAmount.toLocaleString("id-ID")}; Total bayar Rp{voucherQuote.finalAmount.toLocaleString("id-ID")}.</p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!voucherQuote?.valid || loading}
                  onClick={() => void createPayment(voucherCode.trim().toUpperCase())}
                  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-6 py-4 text-sm font-black text-white shadow-xl transition-all enabled:hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {voucherQuote?.finalAmount === 0 ? "Gunakan Voucher Gratis ✨" : "Lanjut Pembayaran Diskon →"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Pop-up Pembayaran Berhasil (5 Detik Auto-Close / Manual Close) */}
      <AnimatePresence>
        {successPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-b from-white via-pink-50/90 to-purple-50/70 p-7 text-center shadow-2xl"
            >
              <button
                onClick={() => handleProceed(successPayment)}
                className="absolute right-4 top-4 rounded-full bg-black/5 p-2 text-foreground/60 hover:bg-black/10 transition-colors"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 shadow-xl dark:bg-emerald-950/70 dark:text-emerald-400">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                >
                  <CheckCircle2 size={48} className="stroke-[2.5]" />
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider text-pink-500">
                  <Sparkles size={14} /> Transaksi Berhasil <Sparkles size={14} />
                </div>
                <h3 className="mt-1 text-2xl font-black text-foreground sm:text-3xl" style={{ fontFamily: "Pacifico, cursive" }}>
                  Pembayaran Berhasil!
                </h3>
                <p className="mt-2 text-xs font-bold text-muted-foreground">
                  Terima kasih! QRIS telah terverifikasi oleh server.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-5 space-y-2 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-left text-xs font-bold text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-mono font-black">{successPayment.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode</span>
                  <span className="uppercase font-black">{successPayment.method}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200/50 pt-2 text-sm font-black text-emerald-700 dark:text-emerald-300">
                  <span>Total Dibayar</span>
                  <span>Rp{successPayment.amount.toLocaleString("id-ID")}</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 space-y-3"
              >
                <button
                  type="button"
                  onClick={() => handleProceed(successPayment)}
                  className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 py-3.5 text-sm font-black text-white shadow-xl transition-transform hover:scale-[1.02]"
                >
                  Lanjutkan Sesi Foto →
                </button>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Mengalihkan otomatis dalam 5 detik...
                </p>
              </motion.div>

              {/* Progress Bar 5 Detik */}
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 5.0, ease: "linear" }}
                className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop-up Voucher Modal (5 Detik untuk Success, 3 Detik untuk Error / Lainnya) */}
      <AnimatePresence>
        {voucherModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md"
            onClick={() => setVoucherModal(null)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-b from-white via-pink-50/90 to-purple-50/70 p-6 text-center shadow-2xl"
            >
              <button
                onClick={() => setVoucherModal(null)}
                className="absolute right-4 top-4 rounded-full bg-black/5 p-1.5 text-foreground/60 hover:bg-black/10 shadow-sm transition-colors"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>

              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg ${voucherModal.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400'
                }`}>
                {voucherModal.type === 'success' ? <Ticket size={32} /> : <XCircle size={32} />}
              </div>

              <h3 className="mt-4 text-lg font-black text-foreground">
                {voucherModal.title}
              </h3>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">
                {voucherModal.message}
              </p>

              {voucherModal.quote?.valid && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <div className="flex justify-between">
                    <span>Harga Sesi</span>
                    <span>Rp{voucherModal.quote.baseAmount.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-rose-500">
                    <span>Diskon Voucher</span>
                    <span>-Rp{voucherModal.quote.discountAmount.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-200/60 pt-1.5 text-sm font-black text-emerald-700 dark:text-emerald-200">
                    <span>Total Pembayaran</span>
                    <span>Rp{voucherModal.quote.finalAmount.toLocaleString("id-ID")}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setVoucherModal(null)}
                className={`mt-5 w-full rounded-2xl py-3.5 text-xs sm:text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.02] ${voucherModal.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-rose-500 to-red-600'
                  }`}
              >
                {voucherModal.type === 'success' ? 'Gunakan Diskon & Tutup' : 'Tutup'}
              </button>

              {/* Progress Bar 5 Detik untuk Success, 3 Detik untuk Error */}
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: voucherModal.type === "success" ? 5.0 : 3.0, ease: "linear" }}
                className={`absolute bottom-0 left-0 h-1.5 ${voucherModal.type === "success" ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-rose-400 to-red-500"}`}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
