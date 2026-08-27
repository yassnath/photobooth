import { ArrowLeft, Camera, Images, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

import { FloatingParticles } from "../components/shared/FloatingParticles";
import { SessionTimer } from "../components/shared/SessionTimer";
import { pageAnimate, pageIn, pageOut, pageTransition } from "../components/shared/animations";
import type { ConsentSettings } from "../types/photobooth";

interface ConsentScreenProps {
  sessionEndsAt?: number | null;
  onBack: () => void;
  onContinue: (consent: ConsentSettings) => void;
}

export function ConsentScreen({ sessionEndsAt, onBack, onContinue }: ConsentScreenProps) {
  const [captureAccepted, setCaptureAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [gallerySharingAllowed, setGallerySharingAllowed] = useState(false);
  const canContinue = captureAccepted && privacyAccepted;

  const allAccepted = captureAccepted && privacyAccepted && gallerySharingAllowed;
  const toggleAll = (checked: boolean) => {
    setCaptureAccepted(checked);
    setPrivacyAccepted(checked);
    setGallerySharingAllowed(checked);
  };

  const submit = () => {
    if (!canContinue) return;
    onContinue({ captureAccepted, privacyAccepted, gallerySharingAllowed, acceptedAt: new Date().toISOString() });
  };

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto"
      initial={pageIn}
      animate={pageAnimate}
      exit={pageOut}
      transition={pageTransition}
    >
      <div className="booth-bg absolute inset-0" />
      <FloatingParticles count={7} />

      <main className="consent-shell relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5 flex items-center gap-3 sm:mb-7">
          <button type="button" onClick={onBack} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/70 bg-white/70 shadow-sm dark:bg-white/10" aria-label="Kembali ke pembayaran">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl font-black sm:text-2xl" style={{ fontFamily: "Pacifico, cursive" }}>Consent Sharing</h2>
            <p className="truncate text-xs text-muted-foreground">Kamu tetap memegang kendali atas fotomu</p>
          </div>
          {sessionEndsAt && <div className="ml-auto"><SessionTimer endsAt={sessionEndsAt} /></div>}
        </header>

        <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900">
            <ShieldCheck className="mt-0.5 shrink-0" size={22} />
            <div>
              <p className="font-black">Privasi kamu penting</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800/75">Foto hanya dipakai sesuai pilihan di bawah dan dapat dihapus oleh operator melalui dashboard.</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="consent-option flex cursor-pointer items-start gap-3 rounded-xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:bg-white/10">
              <input type="checkbox" checked={captureAccepted} onChange={(event) => setCaptureAccepted(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-pink-500" />
              <Camera size={20} className="mt-0.5 shrink-0 text-pink-500" />
              <span className="min-w-0">
                <span className="block text-sm font-black">Izinkan pengambilan foto</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Saya setuju kamera digunakan selama sesi photobooth ini.</span>
              </span>
              <span className="ml-auto text-xs font-black text-pink-500">Wajib</span>
            </label>

            <label className="consent-option flex cursor-pointer items-start gap-3 rounded-xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:bg-white/10">
              <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-pink-500" />
              <LockKeyhole size={20} className="mt-0.5 shrink-0 text-violet-500" />
              <span className="min-w-0">
                <span className="block text-sm font-black">Setujui penyimpanan sementara</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Hasil disimpan agar dapat diproses, diunduh, dan dicetak.</span>
              </span>
              <span className="ml-auto text-xs font-black text-pink-500">Wajib</span>
            </label>

            <label className="consent-option flex cursor-pointer items-start gap-3 rounded-xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:bg-white/10">
              <input type="checkbox" checked={gallerySharingAllowed} onChange={(event) => setGallerySharingAllowed(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-pink-500" />
              <Images size={20} className="mt-0.5 shrink-0 text-sky-500" />
              <span className="min-w-0">
                <span className="block text-sm font-black">Tampilkan di galeri publik</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Izinkan hasil sesi tampil di galeri booth. Pilihan ini dapat dilewati.</span>
              </span>
              <span className="ml-auto text-xs font-bold text-muted-foreground">Opsional</span>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-pink-200/80 bg-white/80 p-3.5 shadow-sm backdrop-blur-sm dark:border-pink-900/40 dark:bg-white/10">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={allAccepted}
                onChange={(e) => toggleAll(e.target.checked)}
                className="h-5 w-5 rounded accent-pink-500 cursor-pointer"
              />
              <span className="text-xs font-black text-foreground">
                Setujui Semua Persyaratan (Pilih Semua)
              </span>
            </label>
            <button
              type="button"
              onClick={() => toggleAll(!allAccepted)}
              className="rounded-lg bg-pink-500/10 px-3 py-1 text-xs font-black text-pink-600 transition-colors hover:bg-pink-500/20 dark:text-pink-300"
            >
              {allAccepted ? "Batal Centang Semua" : "Centang Semua ✨"}
            </button>
          </div>

          <button
            type="button"
            disabled={!canContinue}
            onClick={submit}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-3.5 font-black text-white shadow-lg shadow-pink-200/40 transition-transform enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Setuju dan Lanjut Pilih Frame
          </button>
        </section>
      </main>
    </motion.div>
  );
}
