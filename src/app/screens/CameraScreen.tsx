import { AlertCircle, ArrowLeft, Camera, Clock, LayoutTemplate, RefreshCcw, RotateCcw, SwitchCamera, Trash2, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { SessionTimer } from "../components/shared/SessionTimer";
import { FRAME_LAYOUTS, SAMPLE_PHOTOS, TEMPLATES, getCaptureCount } from "../data/photobooth";
import { useCameraStream } from "../hooks/useCameraStream";
import type { FrameLayout, TemplateOption } from "../types/photobooth";

interface CameraScreenProps {
  frameLayout: FrameLayout;
  sessionEndsAt: number;
  templateId: string;
  frames?: TemplateOption[];
  onBack: () => void;
  onComplete: (photos: string[]) => void;
}

export function CameraScreen({ frameLayout, sessionEndsAt, templateId, frames = TEMPLATES, onBack, onComplete }: CameraScreenProps) {
  const totalShots = getCaptureCount(frameLayout);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [cameraState, setCameraState] = useState<"ready" | "countdown" | "flash">("ready");
  const [timerDuration, setTimerDuration] = useState<3 | 5 | 10>(3);
  const [countdown, setCountdown] = useState(3);
  const [autoSequence, setAutoSequence] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const capturedRef = useRef<string[]>([]);
  const onCompleteRef = useRef(onComplete);
  const template = frames.find((item) => item.id === templateId);
  const layoutLabel = FRAME_LAYOUTS.find((item) => item.id === frameLayout)?.label || frameLayout;
  const {
    videoRef,
    devices,
    selectedDeviceId,
    facingMode,
    activeFacingMode,
    status,
    error,
    refreshDevices,
    startCamera,
    selectDevice,
    switchCamera,
    captureFrame,
  } = useCameraStream();

  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (cameraState !== "countdown") {
      return undefined;
    }

    if (countdown === 0) {
      setCameraState("flash");
      return undefined;
    }

    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cameraState, countdown]);

  useEffect(() => {
    if (cameraState !== "flash") {
      return undefined;
    }

    const timer = window.setTimeout(
      () => {
        const shouldMirror = (activeFacingMode ?? facingMode) === "user";
        const capturedFrame =
          status === "ready"
            ? captureFrame({
                mirror: shouldMirror,
              })
            : null;
        const fallbackIndex = capturedRef.current.length % SAMPLE_PHOTOS.length;
        const nextPhotos = [...capturedRef.current, capturedFrame || SAMPLE_PHOTOS[fallbackIndex]];

        capturedRef.current = nextPhotos;
        setCapturedPhotos(nextPhotos);
        setCameraState("ready");

        if (nextPhotos.length >= totalShots) {
          // Finished all shots!
          return;
        }

        if (autoSequence) {
          setCountdown(timerDuration);
          setCameraState("countdown");
        }
      },
      flashOn ? 620 : 420,
    );

    return () => window.clearTimeout(timer);
  }, [activeFacingMode, autoSequence, cameraState, captureFrame, facingMode, flashOn, status, timerDuration, totalShots]);

  const startCapture = () => {
    if (cameraState !== "ready" || capturedPhotos.length >= totalShots) {
      return;
    }

    setCountdown(timerDuration);
    setCameraState("countdown");
  };

  const cancelCapture = () => {
    setCameraState("ready");
    setCountdown(timerDuration);
  };

  const deleteLastPhoto = () => {
    if (cameraState !== "ready" || capturedPhotos.length === 0) return;
    const nextPhotos = capturedPhotos.slice(0, -1);
    capturedRef.current = nextPhotos;
    setCapturedPhotos(nextPhotos);
  };

  const retakeAllPhotos = () => {
    setCameraState("ready");
    setCountdown(timerDuration);
    capturedRef.current = [];
    setCapturedPhotos([]);
  };

  const deletePhotoAtIndex = (indexToDelete: number) => {
    if (cameraState !== "ready") return;
    const nextPhotos = capturedPhotos.filter((_, idx) => idx !== indexToDelete);
    capturedRef.current = nextPhotos;
    setCapturedPhotos(nextPhotos);
  };

  const previewIndex = capturedRef.current.length % SAMPLE_PHOTOS.length;
  const isCameraReady = status === "ready";
  const showShotCounter = totalShots > 1;

  return (
    <motion.div
      className="camera-screen relative bg-gray-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
    >
      <div className="camera-preview relative min-h-0 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${isCameraReady ? "opacity-100" : "opacity-0"}`}
          style={{ transform: (activeFacingMode ?? facingMode) === "user" ? "scaleX(-1)" : "none" }}
          onLoadedMetadata={(event) => {
            void event.currentTarget.play();
          }}
        />

        {!isCameraReady && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-pink-900/60 via-fuchsia-900/40 to-violet-900/60" />
            <img
              src={SAMPLE_PHOTOS[previewIndex]}
              alt="Camera fallback preview"
              className="absolute inset-0 h-full w-full object-cover opacity-55"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity }}>
                {status === "requesting" ? <RefreshCcw size={48} className="animate-spin text-white/40" /> : <Camera size={48} className="text-white/35" />}
              </motion.div>
              <div>
                <p className="text-sm font-bold text-white/55">
                  {status === "requesting" ? "Connecting camera..." : status === "blocked" ? "Camera unavailable" : "Camera simulation"}
                </p>
                {error && <p className="mx-auto mt-2 max-w-xs text-xs text-white/45">{error}</p>}
              </div>
              {status !== "requesting" && (
                <button
                  onClick={() => startCamera({ deviceId: selectedDeviceId || undefined })}
                  className="mt-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  Try Camera Again
                </button>
              )}
            </div>
          </>
        )}

        {template && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: `inset 0 0 80px ${template.color}70`,
            }}
          />
        )}

        <div className="camera-top-overlay absolute inset-x-0 top-0 flex flex-col gap-2 p-3 sm:p-4 z-30">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onBack}
              className="rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition-transform hover:scale-110"
              aria-label="Back to templates"
            >
              <ArrowLeft size={19} />
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 rounded-full bg-black/50 px-3 py-1.5 text-center text-[11px] font-black tracking-wide text-white backdrop-blur-sm sm:text-xs">
                {showShotCounter ? `${capturedPhotos.length} / ${totalShots} foto` : layoutLabel}
              </div>
              <SessionTimer endsAt={sessionEndsAt} compact />
            </div>

            <div className="flex shrink-0 gap-2">
              <div className="flex items-center gap-1 rounded-full bg-black/40 p-1 backdrop-blur-sm">
                <Clock size={14} className="ml-1.5 text-white/70" />
                {[3, 5, 10].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setTimerDuration(sec as 3 | 5 | 10)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-black transition-all ${
                      timerDuration === sec ? "bg-pink-400 text-white shadow-xs" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              <button
                onClick={() => setFlashOn((value) => !value)}
                className={`rounded-full p-2.5 backdrop-blur-sm transition-transform hover:scale-110 ${
                  flashOn ? "bg-yellow-400/80 text-black" : "bg-black/40 text-white"
                }`}
                aria-label="Toggle flash effect"
              >
                <Zap size={17} />
              </button>
              <button
                onClick={switchCamera}
                className="rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition-transform hover:scale-110"
                aria-label="Switch camera"
              >
                <SwitchCamera size={17} />
              </button>
            </div>
          </div>

          <div className="camera-device-bar flex items-center gap-2 rounded-2xl bg-black/35 p-2 backdrop-blur-sm sm:ml-auto sm:w-auto">
            <select
              value={selectedDeviceId}
              onChange={(event) => selectDevice(event.target.value)}
              disabled={devices.length === 0 || status === "requesting"}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white outline-none sm:w-72 sm:flex-none"
              aria-label="Select camera device"
            >
              {devices.length === 0 ? (
                <option value="">No camera detected</option>
              ) : (
                devices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId} className="text-gray-950">
                    {device.label}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={() => refreshDevices()}
              className="rounded-xl bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              aria-label="Refresh camera list"
            >
              <RefreshCcw size={16} />
            </button>
          </div>
        </div>

        {showShotCounter && (
          <div className="absolute inset-x-0 top-28 flex justify-center gap-2 px-4 sm:top-24 z-20">
            {capturedPhotos.map((url, index) => (
              <motion.div
                key={`${url}-${index}`}
                className="group relative h-16 w-12 overflow-hidden rounded-md border-2 border-white bg-pink-100 shadow-lg"
                initial={{ scale: 0, y: -18, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 16 }}
              >
                <img src={url} alt={`Shot ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => deletePhotoAtIndex(index)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Hapus foto ke-${index + 1}`}
                >
                  <Trash2 size={16} className="text-red-400" />
                </button>
              </motion.div>
            ))}
            {Array.from({ length: totalShots - capturedPhotos.length }, (_, index) => (
              <div key={`empty-${index}`} className="h-16 w-12 rounded-md border-2 border-dashed border-white/30" />
            ))}
          </div>
        )}

        <AnimatePresence>
          {cameraState === "countdown" && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px] z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                key={countdown}
                className="relative flex items-center justify-center"
                initial={{ scale: 2.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 14 }}
              >
                <motion.div
                  className="absolute h-44 w-44 rounded-full border-4 border-pink-400/70"
                  initial={{ scale: 0.7, opacity: 0.9 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ duration: 0.85, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute h-44 w-44 rounded-full border-2 border-white/40"
                  initial={{ scale: 0.5, opacity: 0.7 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ duration: 0.85, delay: 0.1, ease: "easeOut" }}
                />
                <span
                  className="select-none text-8xl font-black text-white sm:text-9xl"
                  style={{
                    fontFamily: "Pacifico, cursive",
                    textShadow: "0 0 40px rgba(244,114,182,0.9), 0 4px 24px rgba(0,0,0,0.6)",
                  }}
                >
                  {countdown === 0 ? "✨" : countdown}
                </span>
              </motion.div>

              <motion.button
                type="button"
                onClick={cancelCapture}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-12 flex items-center gap-2 rounded-full border border-white/30 bg-black/60 px-5 py-2.5 text-xs font-black text-white backdrop-blur-md transition-all hover:bg-black/80 hover:scale-105 active:scale-95 shadow-lg"
              >
                <RotateCcw size={14} className="text-pink-400" /> Batal / Reset Timer
              </motion.button>
            </motion.div>
          )}

          {cameraState === "flash" && (
            <motion.div className="pointer-events-none absolute inset-0 bg-white z-50" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }} />
          )}
        </AnimatePresence>
      </div>

      <div className="camera-control-panel shrink-0 border-t border-white/5 bg-gray-950 px-4 py-4 sm:px-5 sm:py-5">
        <div className="camera-control-main mx-auto flex max-w-lg items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {capturedPhotos.length > 0 && (
              <button
                type="button"
                onClick={retakeAllPhotos}
                disabled={cameraState !== "ready"}
                className="flex h-11 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 text-xs font-bold text-white transition-all hover:bg-white/20 disabled:opacity-40"
                title="Foto Ulang Semua"
              >
                <RotateCcw size={15} /> Ulang
              </button>
            )}
          </div>

          {capturedPhotos.length >= totalShots ? (
            <motion.button
              type="button"
              className="flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-6 font-black text-white shadow-lg shadow-pink-500/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCompleteRef.current(capturedPhotos)}
            >
              Lanjut ke Editor ✨
            </motion.button>
          ) : (
            <motion.button
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/80"
              style={{ boxShadow: "0 0 24px rgba(244,114,182,0.35)" }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.9 }}
              onClick={startCapture}
              disabled={cameraState !== "ready"}
              aria-label="Take photo"
            >
              <motion.div
                className={`h-14 w-14 rounded-full transition-all duration-200 ${cameraState === "ready" ? "bg-white" : "bg-pink-400"}`}
                animate={cameraState === "countdown" ? { scale: [1, 0.88, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            </motion.button>
          )}

          <div className="flex items-center gap-2">
            {capturedPhotos.length > 0 && (
              <button
                type="button"
                onClick={deleteLastPhoto}
                disabled={cameraState !== "ready"}
                className="flex h-11 items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/20 px-3.5 text-xs font-bold text-red-200 transition-all hover:bg-red-500/30 disabled:opacity-40"
                title="Hapus Foto Terakhir"
              >
                <Trash2 size={15} /> Hapus
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
