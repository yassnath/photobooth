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
    window.setTimeout(() => setCopied(false), 1800);
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
      className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.38 }}
    >
      <div className="booth-bg absolute inset-0" />
      <FloatingParticles count={8} />
      {showConfetti && <Confetti />}

      <main className="result-experience relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
          <div className="min-w-0">
            <h2 className="text-xl font-black sm:text-2xl" style={{ fontFamily: "Pacifico, cursive" }}>{formatMeta[format].heading}</h2>
            <p className="truncate text-xs text-muted-foreground">Unduh hasil atau pindai QR dari ponsel</p>
          </div>
          <SessionTimer endsAt={sessionEndsAt} />
        </header>

        <div className="result-content-grid grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)] lg:gap-6">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-gray-950 p-3 shadow-xl sm:p-4">
            <div className="relative flex min-h-[18rem] flex-1 items-center justify-center overflow-auto rounded-xl bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.22),transparent_58%)] p-3 sm:p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={format === "photo" ? format : `${format}-${activePhoto}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={format === "live" ? { opacity: 1, scale: [1, 1.025, 1] } : { opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={format === "live" ? { duration: 2.2, repeat: Infinity } : { duration: 0.24 }}
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
                <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black tracking-wide text-white shadow-lg">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {format === "live" ? "LIVE" : "GIF"}
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
            <section className="flex items-center gap-4 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur-sm dark:bg-card/80 lg:flex-col">
              {shareStatus === "ready" ? (
                <a href={shareUrl} target="_blank" rel="noreferrer" aria-label="Buka halaman download" className="shrink-0 overflow-hidden rounded-lg border-2 border-white bg-white shadow-md">
                  <ScannableQRCode value={shareUrl} size={132} label="QR unduhan hasil foto" />
                </a>
              ) : (
                <div className="grid h-[136px] w-[136px] shrink-0 place-items-center rounded-lg border-2 border-white bg-white shadow-md" aria-label="Menyiapkan QR unduhan">
                  {shareStatus === "uploading" ? <LoaderCircle size={30} className="animate-spin text-primary" /> : <span className="px-3 text-center text-xs font-bold text-red-500">QR tidak tersedia</span>}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left lg:text-center">
                <p className="text-sm font-black">Scan untuk download</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {shareStatus === "uploading" ? "Menyiapkan tautan sesi..." : shareStatus === "ready" ? "Buka dan download dari ponsel." : "Download server belum terhubung."}
                </p>
                <button type="button" onClick={copyLink} disabled={shareStatus !== "ready"} className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-primary disabled:cursor-not-allowed disabled:opacity-40">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Tersalin" : "Salin link"}
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={download}
              disabled={isDownloading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-3.5 font-black text-white shadow-lg shadow-pink-200/40 disabled:opacity-60"
            >
              {isDownloading ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}
              {isDownloading ? "Menyiapkan hasil..." : `Unduh ${formatMeta[format].extension}`}
            </button>
            {downloadError && <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{downloadError}</p>}

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Ulang", icon: <RotateCcw size={16} />, action: onRetake },
                { label: "Filter", icon: <Wand2 size={16} />, action: onEdit },
                { label: "Galeri", icon: <Images size={16} />, action: onGallery },
                { label: "Cetak", icon: <Printer size={16} />, action: onPrint },
              ].map((item) => (
                <button
                  type="button"
                  key={item.label}
                  onClick={item.action}
                  className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-white/80 bg-white/65 px-1 py-2 text-[10px] font-black text-foreground/65 backdrop-blur-sm transition-colors hover:bg-white dark:bg-white/10"
                >
                  {item.icon}<span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={share} className="flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white/60 px-3 py-3 text-sm font-black text-primary dark:bg-white/10">
                <Share2 size={16} /> Bagikan
              </button>
              <button type="button" onClick={onFinish} className="rounded-xl bg-foreground px-3 py-3 text-sm font-black text-background">Selesai</button>
            </div>
          </aside>
        </div>
      </main>
    </motion.div>
  );
}
