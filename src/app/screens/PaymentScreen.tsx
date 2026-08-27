import { ArrowLeft, CheckCircle2, LoaderCircle, QrCode, RefreshCcw, Sparkles, Ticket, XCircle } from "lucide-react";
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
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [handleProceed, successPayment]);

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
    return () => window.clearInterval(timer);
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
          <button type="button" onClick={onBack} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/70 bg-white/70 shadow-sm backdrop-blur-sm transition-transform hover:scale-105 dark:bg-white/10" aria-label="Kembali ke pilihan format">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl font-black sm:text-2xl" style={{ fontFamily: "Pacifico, cursive" }}>Pembayaran</h2>
            <p className="truncate text-xs text-muted-foreground">Sesi dibuka otomatis setelah pembayaran terverifikasi</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Total</p>
            <p className="text-base font-black text-primary sm:text-lg">Rp{currentAmount.toLocaleString("id-ID")}</p>
          </div>
        </header>

        <section className="payment-panel mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-xl backdrop-blur-md dark:bg-card/85 lg:grid lg:grid-cols-[minmax(18rem,0.9fr)_minmax(20rem,1.1fr)]">
          <div className="flex flex-col justify-between bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600 p-5 text-white sm:p-7">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-2xl">{uiTheme.logoEmoji}</div>
                <div>
                  <p className="font-black">{uiTheme.brandName}</p>
                  <p className="text-xs text-white/70">{payment?.orderId ? "Order " + payment.orderId : "Menyiapkan order..."}</p>
                </div>
              </div>
              <h3 className="text-2xl font-black sm:text-3xl">Satu sesi, semua format.</h3>
              <p className="mt-2 max-w-sm text-sm text-white/75">Nominal QR dibuat server dan setiap order memiliki identitas transaksi sendiri.</p>
            </div>
            <div className="mt-6 space-y-2 rounded-xl bg-white/10 p-3 text-xs font-bold">
              <div className="flex justify-between"><span>Harga sesi</span><span>Rp{currentBaseAmount.toLocaleString("id-ID")}</span></div>
              {currentDiscount > 0 && <div className="flex justify-between text-emerald-200"><span>Voucher</span><span>-Rp{currentDiscount.toLocaleString("id-ID")}</span></div>}
              <div className="flex justify-between border-t border-white/15 pt-2 text-sm font-black"><span>Total</span><span>Rp{currentAmount.toLocaleString("id-ID")}</span></div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col p-4 sm:p-6">
            <div className="mb-4 grid grid-cols-2 rounded-xl bg-muted p-1">
              <button type="button" onClick={() => setMethod("qris")} className={"flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-black transition-colors " + (method === "qris" ? "bg-white text-primary shadow-sm dark:bg-white/15" : "text-muted-foreground")}>
                <QrCode size={17} /> QRIS
              </button>
              <button type="button" onClick={() => setMethod("voucher")} className={"flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-black transition-colors " + (method === "voucher" ? "bg-white text-primary shadow-sm dark:bg-white/15" : "text-muted-foreground")}>
                <Ticket size={17} /> Voucher
              </button>
            </div>

            {error && (
              <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700">
                <XCircle size={17} className="shrink-0" /> <span className="min-w-0 flex-1">{error}</span>
                {method === "qris" && <button type="button" onClick={() => void createPayment()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white" aria-label="Buat ulang pembayaran"><RefreshCcw size={14} /></button>}
              </div>
            )}

            {method === "qris" ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="grid h-[198px] w-[198px] place-items-center overflow-hidden rounded-xl border-4 border-white bg-white shadow-lg">
                  {loading && !payment ? (
                    <LoaderCircle size={36} className="animate-spin text-primary" />
                  ) : payment?.qrString ? (
                    <ScannableQRCode value={payment.qrString} size={190} label="QR pembayaran sesi" />
                  ) : payment?.qrImageUrl ? (
                    <img src={payment.qrImageUrl} alt="QR pembayaran sesi" className="h-[190px] w-[190px] object-contain" />
                  ) : (
                    <QrCode size={54} className="text-muted-foreground/40" />
                  )}
                </div>
                <p className="mt-4 text-sm font-black">{payment?.status === "paid" ? "Pembayaran berhasil" : "Menunggu pembayaran QRIS"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{payment?.provider === "mock" ? "Mode integrasi mock aktif." : "Status diperiksa otomatis dari server."}</p>
                <div className="mt-4 flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700">
                  {payment?.status === "paid" ? <CheckCircle2 size={14} /> : <LoaderCircle size={14} className="animate-spin" />}
                  {payment?.status === "paid" ? "Terverifikasi" : "Pending"}
                </div>
                {payment?.provider === "mock" && payment.status === "pending" && (
                  <button type="button" onClick={() => void simulate()} disabled={loading} className="mt-4 w-full rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-3 font-black text-white shadow-lg disabled:opacity-50">
                    Simulasikan Pembayaran
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={verifyVoucher} className="flex flex-1 flex-col justify-center">
                <label htmlFor="voucher" className="text-sm font-black">Kode voucher</label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="voucher"
                    value={voucherCode}
                    onChange={(event) => {
                      setVoucherCode(event.target.value.toUpperCase());
                      setVoucherQuote(null);
                      setError("");
                    }}
                    placeholder="Masukkan kode"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-3 font-bold uppercase outline-none focus:border-primary dark:bg-white/10"
                  />
                  <button type="submit" disabled={checkingVoucher || voucherCode.trim().length < 3} className="rounded-xl bg-foreground px-4 py-3 text-sm font-black text-background disabled:opacity-45">
                    {checkingVoucher ? "..." : "Cek"}
                  </button>
                </div>

                {voucherQuote?.valid && (
                  <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-700">
                    <div className="flex items-center gap-2"><CheckCircle2 size={17} /> Voucher valid</div>
                    <p className="mt-1 text-xs">Potongan Rp{voucherQuote.discountAmount.toLocaleString("id-ID")}; total Rp{voucherQuote.finalAmount.toLocaleString("id-ID")}.</p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!voucherQuote?.valid || loading}
                  onClick={() => void createPayment(voucherCode.trim().toUpperCase())}
                  className="mt-5 w-full rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-3.5 font-black text-white shadow-lg transition-transform enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {voucherQuote?.finalAmount === 0 ? "Gunakan Voucher Gratis" : "Buat QRIS dengan Diskon"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {successPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-b from-white via-pink-50/50 to-white p-7 text-center shadow-2xl dark:from-gray-900 dark:via-gray-900 dark:to-gray-950"
            >
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
                  <span className="uppercase">{successPayment.method}</span>
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
                  Mengalihkan otomatis dalam 3 detik...
                </p>
              </motion.div>

              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.8, ease: "linear" }}
                className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {voucherModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setVoucherModal(null)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-b from-white via-pink-50/60 to-white p-6 text-center shadow-2xl dark:from-gray-900 dark:via-gray-900 dark:to-gray-950"
            >
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg ${
                voucherModal.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400'
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
                className={`mt-5 w-full rounded-2xl py-3 text-xs font-black text-white shadow-lg transition-transform hover:scale-[1.02] ${
                  voucherModal.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-rose-500 to-red-600'
                }`}
              >
                {voucherModal.type === 'success' ? 'Gunakan Diskon' : 'Tutup'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
