import { Check, Copy, Download, Images, LoaderCircle, Printer, RotateCcw, Share2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Confetti } from "../components/shared/Confetti";
import { FloatingParticles } from "../components/shared/FloatingParticles";
import { PhotoFrame } from "../components/shared/PhotoFrame";
import { ScannableQRCode } from "../components/shared/ScannableQRCode";
import { SessionTimer } from "../components/shared/SessionTimer";
import { FILTERS, SAMPLE_PHOTOS, TEMPLATES } from "../data/photobooth";
import type { CaptureMode, EditorState, FilterOption, FrameLayout, ResultFormat, TemplateOption } from "../types/photobooth";
import { createGifResultBlob, createLiveResultBlob, createPhotoResultBlob, downloadGifResult, downloadLiveResult, downloadPhotoResult } from "../utils/exportResult";
import { saveLocalResultBackup } from "../../shared/storage/localPhotoBackup";

interface ResultScreenProps {
  photos: string[];
  mode: CaptureMode;
  frameLayout: FrameLayout;
  sessionEndsAt: number;
  sessionId: string;
  templateId: string;
  editor: EditorState;
  format: ResultFormat;
  filters?: FilterOption[];
  frames?: TemplateOption[];
  brandName?: string;
  onEdit: () => void;
  onGallery: () => void;
  onPrint: () => void;
  onRetake: () => void;
  onFinish: () => void;
}

const formatMeta: Record<ResultFormat, { heading: string; extension: string }> = {
  photo: { heading: "Hasil Fotomu", extension: "JPG" },
  live: { heading: "Hasil Live Photo-mu", extension: "WEBM" },
  gif: { heading: "Hasil GIF-mu", extension: "GIF" },
};

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Hasil tidak dapat disiapkan untuk QR."));
    reader.readAsDataURL(blob);
  });
}

export function ResultScreen({
  photos,
  mode,
  frameLayout,
  sessionEndsAt,
  sessionId,
  templateId,
  editor,
  format,
  filters = FILTERS,
  frames = TEMPLATES,
  brandName = "PixieBooth",
  onEdit,
  onGallery,
  onPrint,
  onRetake,
  onFinish,
}: ResultScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [shareStatus, setShareStatus] = useState<"uploading" | "ready" | "unavailable">("uploading");
  const [shareUrl, setShareUrl] = useState(() => window.location.origin);
  const template = frames.find((item) => item.id === templateId);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowConfetti(false), 3200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (format === "photo" || photos.length <= 1) return undefined;
    const timer = window.setInterval(
      () => setActivePhoto((current) => (current + 1) % photos.length),
      format === "gif" ? 360 : 850,
    );
    return () => window.clearInterval(timer);
  }, [format, photos.length]);

  useEffect(() => {
    let active = true;
    const publishResult = async () => {
      setShareStatus("uploading");
      try {
        const options = { photos, frameLayout, template, editor, filters, brandName };
        const blob = format === "gif"
          ? await createGifResultBlob(options)
          : format === "live"
            ? await createLiveResultBlob(options)
            : await createPhotoResultBlob(options);
        await saveLocalResultBackup(sessionId, format, blob);
        const dataUrl = await blobToDataUrl(blob);
        const response = await fetch(`/api/results/${encodeURIComponent(sessionId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl,
            brandName,
            format,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }),
        });
        if (!response.ok) throw new Error("Server download belum tersedia.");
        const payload = await response.json() as { downloadUrl?: string };
        if (active) {
          if (payload.downloadUrl) setShareUrl(payload.downloadUrl);
          setShareStatus("ready");
        }
      } catch {
        if (active) setShareStatus("unavailable");
      }
    };

    void publishResult();
    return () => {
      active = false;
    };
  }, [brandName, editor, filters, format, frameLayout, photos, sessionId, template]);

  const download = async () => {
    setIsDownloading(true);
    setDownloadError("");
    const options = { photos, frameLayout, template, editor, filters, brandName };
    try {
      if (format === "gif") {
        await downloadGifResult(options);
      } else if (format === "live") {
        await downloadLiveResult(options);
      } else {
        await downloadPhotoResult(options);
      }
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Hasil belum dapat diunduh.");
    } finally {
      setIsDownloading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Keep the visible feedback for browsers without clipboard permission.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: `${brandName} result`, text: "Foto photobooth kamu sudah siap.", url: shareUrl }).catch(() => undefined);
      return;
    }
    await copyLink();
  };

  const previewPhotos = format === "photo" ? photos : [photos[activePhoto] || photos[0] || SAMPLE_PHOTOS[0]];
  const previewLayout: FrameLayout = format === "photo" ? frameLayout : "1x1";

  return (
    <motion.div
      className="relative h-[100dvh] overflow-hidden"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.38 }}
    >
      <div className="booth-bg absolute inset-0" />
      <FloatingParticles count={8} />
      {showConfetti && <Confetti />}

      <main className="result-experience relative z-10 mx-auto flex h-[100dvh] w-full max-w-6xl flex-col px-3 py-3 sm:px-5 sm:py-4">
        <header className="mb-2 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-black sm:text-xl" style={{ fontFamily: "Pacifico, cursive" }}>{formatMeta[format].heading}</h2>
            <p className="truncate text-[11px] text-muted-foreground">Unduh hasil atau pindai QR dari ponsel</p>
          </div>
          <SessionTimer endsAt={sessionEndsAt} />
        </header>

        <div className="result-content-grid flex flex-col lg:flex-row min-h-0 flex-1 gap-4 sm:gap-6 overflow-hidden">
          {/* Left Side: Tight Photo Preview (Fits Strip Height & Aspect Ratio) */}
          <section className="flex shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gray-950 p-3 sm:p-4 shadow-2xl border border-white/10">
            <div className="relative flex min-h-0 h-full items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.2),transparent_65%)] p-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={format === "photo" ? format : `${format}-${activePhoto}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={format === "live" ? { opacity: 1, scale: [1, 1.025, 1] } : { opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={format === "live" ? { duration: 2.2, repeat: Infinity } : { duration: 0.24 }}
                  className="flex h-full items-center justify-center"
                >
                  <PhotoFrame
                    photos={previewPhotos}
                    mode={mode}
                    frameLayout={previewLayout}
                    templateId={templateId}
                    editor={editor}
                    fallbackPhoto={SAMPLE_PHOTOS[0]}
                    variant="result"
                    filters={filters}
                    frames={frames}
                    brandName={brandName}
                  />
                </motion.div>
              </AnimatePresence>
              {format !== "photo" && (
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-black tracking-wide text-white shadow-lg">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  {format === "live" ? "LIVE" : "GIF"}
                </div>
              )}
            </div>
          </section>

          {/* Right Side: Expanded QR Code & Action Panel */}
          <aside className="flex flex-1 min-h-0 flex-col justify-between gap-3 overflow-y-auto p-4 sm:p-5 rounded-3xl border border-white/80 bg-white/75 shadow-2xl backdrop-blur-md dark:bg-card/85 scrollbar-hide">
            {/* Prominent QR Code Download Card */}
            <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-pink-200/80 bg-gradient-to-b from-white to-pink-50/50 p-4 sm:p-5 shadow-md text-center">
              {shareStatus === "ready" ? (
                <a href={shareUrl} target="_blank" rel="noreferrer" aria-label="Buka halaman download" className="shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-xl transition-transform hover:scale-105">
                  <ScannableQRCode value={shareUrl} size={180} label="QR unduhan hasil foto" />
                </a>
              ) : (
                <div className="grid h-[180px] w-[180px] shrink-0 place-items-center rounded-2xl border-4 border-white bg-white shadow-xl">
                  {shareStatus === "uploading" ? (
                    <div className="flex flex-col items-center gap-2">
                      <LoaderCircle size={32} className="animate-spin text-pink-500" />
                      <span className="text-xs font-bold text-pink-600">Menyiapkan QR...</span>
                    </div>
                  ) : (
                    <span className="px-3 text-center text-xs font-bold text-red-500">QR tidak tersedia</span>
                  )}
                </div>
              )}
              <div className="w-full text-center">
                <p className="text-sm sm:text-base font-black text-foreground">Scan QR untuk Download Foto</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {shareStatus === "uploading" ? "Menyiapkan tautan sesi..." : shareStatus === "ready" ? "Buka kamera HP Anda & scan QR code di atas." : "Download server belum terhubung."}
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={shareStatus !== "ready"}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-pink-100 dark:bg-pink-950/40 px-3.5 py-1 text-xs font-black text-pink-600 dark:text-pink-300 transition-colors hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Link Tersalin!" : "Salin Link Download"}
                </button>
              </div>
            </section>

            {/* Action Buttons Section */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={download}
                disabled={isDownloading}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-3.5 text-base font-black text-white shadow-xl shadow-pink-300/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              >
                {isDownloading ? <LoaderCircle size={20} className="animate-spin" /> : <Download size={20} />}
                {isDownloading ? "Menyiapkan File..." : `Unduh ${formatMeta[format].heading} (${formatMeta[format].extension})`}
              </button>
              {downloadError && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{downloadError}</p>}

              {/* 4 Extra Actions */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Ulang", icon: <RotateCcw size={18} />, action: onRetake },
                  { label: "Filter", icon: <Wand2 size={18} />, action: onEdit },
                  { label: "Galeri", icon: <Images size={18} />, action: onGallery },
                  { label: "Cetak", icon: <Printer size={18} />, action: onPrint },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    onClick={item.action}
                    className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/90 bg-white/80 p-2 text-xs font-black text-foreground shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 dark:bg-white/10"
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Bottom Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={share} className="flex items-center justify-center gap-2 rounded-2xl border border-pink-300 bg-white/90 px-4 py-3 text-sm font-black text-pink-600 shadow-sm transition-all hover:bg-white dark:bg-white/10">
                  <Share2 size={17} /> Bagikan
                </button>
                <button type="button" onClick={onFinish} className="rounded-2xl bg-foreground px-4 py-3 text-sm font-black text-background shadow-md transition-all hover:opacity-90">
                  Selesai
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </motion.div>
  );
}
