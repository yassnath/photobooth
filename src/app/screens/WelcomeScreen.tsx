import { useCallback, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, Camera, Sparkles, Heart } from "lucide-react";

import { pageAnimate, pageIn } from "../components/shared/animations";
import type { BoothThemeSettings } from "../types/photobooth";

interface WelcomeScreenProps {
  isDark?: boolean;
  uiTheme: BoothThemeSettings;
  onStart: () => void;
  onDashboard: () => void;
  onToggleDark?: () => void;
}

/**
 * Efek Audio Gerbang Istana (Sintesis Ringan Web Audio API)
 */
function playGateOpenSound() {
  window.setTimeout(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;

      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = "sine";
      chime.frequency.setValueAtTime(880, now);
      chime.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25);
      chimeGain.gain.setValueAtTime(0.08, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chime.start(now);
      chime.stop(now + 0.28);

      window.setTimeout(() => {
        try {
          void ctx.close();
        } catch {
          // ignore
        }
      }, 350);
    } catch {
      // Audio aman diabaikan jika dibatasi browser
    }
  }, 0);
}

/**
 * Ornamen Sudut Filigree Emas Presisi (Ringan & Elegan)
 */
function GoldFiligreeCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const posConfig = {
    tl: "top-1 left-1 rotate-0",
    tr: "top-1 right-1 rotate-90",
    br: "bottom-1 right-1 rotate-180",
    bl: "bottom-1 left-1 -rotate-90",
  }[position];

  return (
    <div className={`pointer-events-none absolute h-3 w-3 sm:h-4 sm:w-4 z-20 opacity-80 ${posConfig}`}>
      <svg viewBox="0 0 100 100" fill="none" className="h-full w-full text-amber-400">
        <path
          d="M8 8 C35 8 60 14 70 30 C76 42 70 54 58 54 C48 54 44 44 52 38 C58 34 64 36 64 42 M8 8 C8 35 14 60 30 70 C42 76 54 70 54 58 C54 48 44 44 38 52 C34 58 36 64 42 64 M8 8 L30 30"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="5" fill="currentColor" />
      </svg>
    </div>
  );
}

/**
 * Roset Medali Emas Daun Pintu Klasik (Royal Rosette Boss)
 */
function RoyalDoorRosette() {
  return (
    <div className="relative flex items-center justify-center h-7 w-7 sm:h-9 sm:w-9 md:h-11 md:w-11 rounded-full border border-amber-400/80 bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 shadow-sm shadow-amber-950/20">
      <div className="flex h-4.5 w-4.5 sm:h-6 sm:w-6 md:h-7 md:w-7 items-center justify-center rounded-full border border-amber-600/40 bg-gradient-to-tl from-amber-300 to-amber-100 shadow-inner">
        <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-700/60 shadow-xs" />
      </div>
    </div>
  );
}

/**
 * Kisi-kisi Sunburst Busur Emas Puncak Pintu (Arched Sunburst Grille)
 */
function SunburstArchGrille() {
  return (
    <svg viewBox="0 0 100 60" fill="none" className="w-full h-full text-amber-400/75 opacity-90">
      <path d="M5 58 C5 30 25 10 50 10 C75 10 95 30 95 58" stroke="currentColor" strokeWidth="2.5" />
      <path d="M18 58 C18 40 32 24 50 24 C68 24 82 40 82 58" stroke="currentColor" strokeWidth="2" />
      <line x1="50" y1="10" x2="50" y2="58" stroke="currentColor" strokeWidth="2" />
      <line x1="28" y1="19" x2="42" y2="58" stroke="currentColor" strokeWidth="1.8" />
      <line x1="72" y1="19" x2="58" y2="58" stroke="currentColor" strokeWidth="1.8" />
      <line x1="12" y1="36" x2="35" y2="58" stroke="currentColor" strokeWidth="1.8" />
      <line x1="88" y1="36" x2="65" y2="58" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="50" cy="58" r="6" fill="currentColor" />
    </svg>
  );
}

/**
 * Gagang Pengetuk Pintu Kuningan Emas Mewah (Luxury Door Knocker)
 */
function LuxuryDoorKnocker({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-15 ${isLeft ? "right-2 sm:right-3 md:right-5" : "left-2 sm:left-3 md:left-5"
        }`}
    >
      <div className="flex h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 items-center justify-center rounded-full border-2 border-amber-400 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-md shadow-amber-950/20">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 shadow-inner">
          <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-gradient-to-b from-amber-700 to-amber-900 shadow-xs" />
        </div>
      </div>
      <div className="-mt-1.5 h-4.5 w-4.5 sm:h-6 sm:w-6 md:h-7 md:w-7 rounded-full border-[2.5px] sm:border-[3px] border-amber-400 bg-transparent shadow-xs" />
    </div>
  );
}

/**
 * Lentera Dinding Arsitektural Mewah dengan Nyala Api Berdenyut Lembut
 */
function WallSconce() {
  return (
    <div className="flex flex-col items-center select-none">
      <div className="h-1.5 w-3.5 sm:h-2 sm:w-5 rounded-xs bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 border border-amber-500/80 shadow-xs" />
      <div className="h-1.5 w-1 bg-gradient-to-b from-amber-400 to-amber-600" />
      <div className="relative flex h-4.5 w-3 sm:h-6 sm:w-4 items-center justify-center rounded-t-xs border border-amber-400/90 bg-gradient-to-b from-amber-100/90 via-amber-200/80 to-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.5)] overflow-hidden">
        <motion.div
          className="h-1.5 w-1 sm:h-2 sm:w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
          animate={{
            scale: [1, 1.25, 0.95, 1.2, 1],
            opacity: [0.8, 1, 0.75, 1, 0.8],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
      <div className="h-1 w-1.5 sm:h-1.5 sm:w-2 bg-gradient-to-b from-amber-400 to-amber-700 rounded-b-xs" />
    </div>
  );
}

/**
 * Efek Debu Emas & Kelip Dongeng Mewah yang Melayang Lembut di Pelataran
 */
function AtmosphericSparkles() {
  const sparkles = [
    { x: "12%", y: "25%", size: 6, delay: 0, duration: 4 },
    { x: "24%", y: "65%", size: 5, delay: 1.2, duration: 4.8 },
    { x: "78%", y: "30%", size: 6, delay: 0.6, duration: 4.2 },
    { x: "88%", y: "70%", size: 5, delay: 1.8, duration: 5 },
    { x: "50%", y: "15%", size: 7, delay: 0.9, duration: 3.8 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-15">
      {sparkles.map((s, i) => (
        <motion.div
          key={`sparkle-${i}`}
          className="absolute rounded-full bg-gradient-to-r from-amber-300 to-pink-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
          style={{
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
          }}
          animate={{
            y: [-8, 8, -8],
            x: [-4, 4, -4],
            opacity: [0.25, 0.85, 0.25],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
            delay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Komponen Sampel Strip Foto Asli Photobooth Korea (Real Korean Photobooth 4-Cut Strip)
 * Dilengkapi animasi mengambang lembut (floating sway), kilatan glossy, dan reaksi interaktif hover.
 */
function RealPhotoboothStrip({
  src,
  alt = "Korean Photobooth Strip",
  tilt = -2.5,
  floatY = 6,
  duration = 4.6,
  delay = 0,
}: {
  src: string;
  alt?: string;
  tilt?: number;
  floatY?: number;
  duration?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className="group relative w-28 sm:w-32 md:w-36 lg:w-40 rounded-xl bg-white p-1.5 sm:p-2 pb-3 shadow-lg shadow-pink-500/15 border-2 border-pink-200/90 shrink-0 cursor-pointer select-none"
      style={{ willChange: "transform" }}
      animate={{
        y: [-floatY, floatY, -floatY],
        rotate: [tilt - 1.2, tilt + 1.2, tilt - 1.2],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay,
      }}
      whileHover={{
        scale: 1.07,
        rotate: 0,
        y: -12,
        zIndex: 40,
        boxShadow: "0 20px 30px -10px rgba(236,72,153,0.35)",
        transition: { type: "spring", stiffness: 350, damping: 22 },
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Pita Washi Tape Penjepit Atas */}
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-4 w-12 sm:w-14 bg-amber-300/90 border-y border-dashed border-amber-500/70 shadow-2xs rotate-[-1deg] z-20" />

      {/* Gambar Strip Foto Asli dengan Efek Shimmer Kilap Glossy */}
      <div className="relative aspect-[1/2.4] w-full rounded-md overflow-hidden bg-pink-50/50 shadow-inner border border-pink-200/70 mt-1">
        <img
          src={src}
          alt={alt}
          loading="eager"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Kilatan Cahaya Glossy Berjalan */}
        <motion.div
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]"
          animate={{ x: ["-120%", "220%"] }}
          transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 3 + delay, ease: "easeInOut" }}
        />
      </div>

      {/* Footer Strip: Grafis Barcode Estetik Minimalis */}
      <div className="pt-2 px-1 flex flex-col items-center">
        <div className="h-2 w-14 sm:w-18 bg-gradient-to-r from-gray-700 via-gray-900 to-gray-700 rounded-2xs opacity-75" />
      </div>

      {/* Mini badge stiker lucu di pojok bawah */}
      <div className="absolute -bottom-2 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-[10px] text-white shadow-md border-2 border-white rotate-12 transition-transform duration-300 group-hover:rotate-0 group-hover:scale-110">
        💖
      </div>
    </motion.div>
  );
}

/**
 * Komponen Sampel Foto Polaroid Klasik (Wide Studio Polaroid)
 * Dilengkapi animasi mengambang lembut, kilatan glossy, dan stiker bintang ceria.
 */
function SamplePolaroidPhoto({
  photo = "/samples/polaroid_sample.jpg",
  tilt = 2.5,
  floatY = 5,
  duration = 5.2,
  delay = 0.6,
}: {
  photo?: string;
  tilt?: number;
  floatY?: number;
  duration?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className="group relative w-24 sm:w-28 md:w-32 lg:w-36 rounded-xl bg-white p-1.5 sm:p-2 pb-3.5 shadow-lg shadow-purple-500/15 border-2 border-amber-200/90 shrink-0 flex flex-col justify-between cursor-pointer select-none"
      style={{ willChange: "transform" }}
      animate={{
        y: [floatY, -floatY, floatY],
        rotate: [tilt + 1.2, tilt - 1.2, tilt + 1.2],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay,
      }}
      whileHover={{
        scale: 1.08,
        rotate: 0,
        y: -12,
        zIndex: 40,
        boxShadow: "0 20px 30px -10px rgba(168,85,247,0.35)",
        transition: { type: "spring", stiffness: 350, damping: 22 },
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Lakban Lilin Penjepit */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-3.5 w-10 sm:w-12 bg-pink-300/85 border-y border-dashed border-pink-400/70 shadow-2xs rotate-[2deg] z-20" />

      {/* Foto Polaroid Otentik dengan Shimmer Glossy */}
      <div className="relative aspect-[4/5] w-full rounded-md overflow-hidden bg-purple-100/60 shadow-xs border border-purple-200/60 mt-1">
        <img
          src={photo}
          alt="Polaroid Sample"
          loading="eager"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <motion.div
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]"
          animate={{ x: ["-120%", "220%"] }}
          transition={{ duration: 4.8, repeat: Infinity, repeatDelay: 3.5 + delay, ease: "easeInOut" }}
        />
      </div>

      {/* Mini badge stiker lucu di pojok bawah */}
      <div className="absolute -bottom-2 -left-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] text-white shadow-md border-2 border-white -rotate-12 transition-transform duration-300 group-hover:rotate-0 group-hover:scale-110">
        ⭐
      </div>
    </motion.div>
  );
}

/**
 * Komponen Sampel Grid 2x2 Photobooth
 * Dilengkapi animasi mengambang lembut, kilatan glossy, dan pita stiker.
 */
function SampleGridPhoto({
  tilt = -1.5,
  floatY = 5.5,
  duration = 4.8,
  delay = 0.4,
}: {
  tilt?: number;
  floatY?: number;
  duration?: number;
  delay?: number;
}) {
  const cuts = [
    "/samples/grid_cut_1.jpg",
    "/samples/grid_cut_2.jpg",
    "/samples/grid_cut_3.jpg",
    "/samples/grid_cut_4.jpg",
  ];

  return (
    <motion.div
      className="group relative w-26 sm:w-30 md:w-34 lg:w-38 rounded-xl bg-gradient-to-b from-white via-amber-50/40 to-white p-1.5 sm:p-2 pb-3 shadow-lg shadow-amber-500/15 border-2 border-amber-200/90 shrink-0 cursor-pointer select-none"
      style={{ willChange: "transform" }}
      animate={{
        y: [floatY, -floatY, floatY],
        rotate: [tilt - 1.2, tilt + 1.2, tilt - 1.2],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay,
      }}
      whileHover={{
        scale: 1.08,
        rotate: 0,
        y: -12,
        zIndex: 40,
        boxShadow: "0 20px 30px -10px rgba(245,158,11,0.35)",
        transition: { type: "spring", stiffness: 350, damping: 22 },
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-3.5 w-11 sm:w-13 bg-amber-300/80 border-y border-dashed border-amber-400/60 shadow-2xs z-20" />

      {/* Grid 2x2 Foto Nyata Terpotong Sempurna dengan Shimmer Glossy */}
      <div className="relative grid grid-cols-2 gap-1 rounded-md overflow-hidden p-0.5 bg-amber-50/70 border border-amber-200/60 mt-1">
        {cuts.map((src, idx) => (
          <div key={`grid-${idx}`} className="aspect-square w-full rounded-xs overflow-hidden bg-amber-100/60 shadow-2xs">
            <img
              src={src}
              alt={`Grid Cut ${idx + 1}`}
              loading="eager"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ))}
        <motion.div
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]"
          animate={{ x: ["-120%", "220%"] }}
          transition={{ duration: 5, repeat: Infinity, repeatDelay: 4 + delay, ease: "easeInOut" }}
        />
      </div>

      {/* Mini badge stiker lucu di pojok */}
      <div className="absolute -bottom-2 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] text-white shadow-md border-2 border-white rotate-12 transition-transform duration-300 group-hover:rotate-0 group-hover:scale-110">
        🎀
      </div>
    </motion.div>
  );
}

/**
 * Pilar Klasik Gerbang Bergalur
 */
function RoyalPalacePillar({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className={`pointer-events-none absolute top-0 bottom-0 w-3.5 sm:w-5 md:w-6 bg-gradient-to-r from-amber-200 via-pink-50 to-amber-200 border-x border-amber-300/90 shadow-md z-25 flex flex-col justify-between items-center ${
        isLeft ? "-left-2 sm:-left-3 md:-left-3.5" : "-right-2 sm:-right-3 md:-right-3.5"
      }`}
    >
      <div className="h-4 sm:h-5 w-[124%] -mx-[12%] rounded-t-xs bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border border-amber-600 shadow-xs flex items-center justify-center">
        <div className="h-0.5 w-3/4 bg-amber-100/90 rounded-full" />
      </div>
      <div className="flex-1 w-full flex justify-evenly px-0.5 py-1">
        <div className="w-0.5 h-full bg-amber-300/50 rounded-full" />
        <div className="w-0.5 h-full bg-white/70 rounded-full" />
      </div>
      <div className="h-4 sm:h-5 w-[124%] -mx-[12%] rounded-b-xs bg-gradient-to-t from-amber-400 to-amber-300 border border-amber-600 shadow-xs flex items-center justify-center">
        <div className="h-0.5 w-3/4 rounded-full bg-amber-200/90" />
      </div>
    </div>
  );
}

/**
 * Rangkaian Lampu Peri Bohlam Gantung yang Berpendar Lembut (Warm Fairy Light Garland)
 */
function FairyLightGarland() {
  return (
    <div className="pointer-events-none absolute top-0 left-0 right-0 z-30 flex items-center justify-around px-4 overflow-hidden h-4 select-none">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="relative flex flex-col items-center">
          <div className="w-[1px] h-1.5 bg-amber-400/60" />
          <motion.div
            className="h-2 w-2 rounded-full border border-amber-200"
            style={{
              background:
                i % 3 === 0
                  ? "radial-gradient(circle, #fef08a, #f59e0b)"
                  : i % 3 === 1
                  ? "radial-gradient(circle, #fbcfe8, #ec4899)"
                  : "radial-gradient(circle, #ddd6fe, #8b5cf6)",
              boxShadow: i % 2 === 0 ? "0 0 8px rgba(251, 191, 36, 0.9)" : "0 0 8px rgba(236, 72, 153, 0.8)",
            }}
            animate={{
              opacity: [0.65, 1, 0.65],
              scale: [0.9, 1.15, 0.9],
            }}
            transition={{
              duration: 1.8 + (i % 5) * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (i * 0.15) % 2,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Efek Twinkle Kilatan Kamera Studio Lembut yang Menyala Berkala
 */
function StudioCameraFlash() {
  const [flashPos, setFlashPos] = useState({ x: 30, y: 35, active: false });

  useEffect(() => {
    const interval = setInterval(() => {
      const x = 15 + Math.random() * 70;
      const y = 20 + Math.random() * 60;
      setFlashPos({ x, y, active: true });
      setTimeout(() => {
        setFlashPos((prev) => ({ ...prev, active: false }));
      }, 200);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  if (!flashPos.active) return null;

  return (
    <div
      className="pointer-events-none absolute z-25 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${flashPos.x}%`, top: `${flashPos.y}%` }}
    >
      <div className="h-24 w-24 rounded-full bg-radial from-white via-amber-200/50 to-transparent blur-md animate-ping" />
      <div className="absolute inset-0 flex items-center justify-center text-amber-300 text-xl font-bold">
        ✦
      </div>
    </div>
  );
}

/**
 * Stiker-Stiker Fotobooth Imut Melayang dengan Animasi Mengapung Halus
 */
function FloatingPropsStickers() {
  const stickers = [
    { emoji: "🎀", x: "6%", y: "24%", delay: 0, rotate: -14 },
    { emoji: "✨", x: "12%", y: "82%", delay: 0.8, rotate: 12 },
    { emoji: "💖", x: "88%", y: "26%", delay: 0.4, rotate: 14 },
    { emoji: "⭐", x: "92%", y: "80%", delay: 1.2, rotate: -10 },
    { emoji: "📸", x: "94%", y: "50%", delay: 0.6, rotate: -8 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20 select-none">
      {stickers.map((stk, i) => (
        <motion.div
          key={`stk-${i}`}
          className="absolute flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/85 shadow-md shadow-pink-500/15 border border-pink-200/80 text-base sm:text-lg backdrop-blur-2xs"
          style={{ left: stk.x, top: stk.y }}
          animate={{
            y: [-6, 6, -6],
            rotate: [stk.rotate - 4, stk.rotate + 4, stk.rotate - 4],
            scale: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: 3.5 + i * 0.5,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
            delay: stk.delay,
          }}
        >
          <span>{stk.emoji}</span>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Seni Neon Siluet Studio Estetik (Warm Aesthetic Neon Art)
 */
function NeonStudioArt({ type }: { type: "heart" | "camera" }) {
  if (type === "heart") {
    return (
      <motion.div
        className="pointer-events-none select-none flex items-center justify-center"
        animate={{
          opacity: [0.85, 1, 0.9, 1, 0.85],
          scale: [0.97, 1.03, 0.98, 1.02, 0.97],
        }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 100 85" className="h-12 w-16 sm:h-16 sm:w-20 drop-shadow-[0_0_12px_rgba(244,114,182,0.9)] drop-shadow-[0_0_24px_rgba(236,72,153,0.55)]">
          <path
            d="M50 72 C22 48 10 32 10 20 C10 10 18 4 28 4 C36 4 44 9 50 17 C56 9 64 4 72 4 C82 4 90 10 90 20 C90 32 78 48 50 72 Z"
            fill="none"
            stroke="#f472b6"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M50 62 C30 42 22 29 22 20 C22 14 26 10 32 10 C38 10 44 14 50 20 C56 14 62 10 68 10 C74 10 78 14 78 20 C78 29 70 42 50 62 Z"
            fill="none"
            stroke="#fbcfe8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
          <path
            d="M78 8 L81 14 L87 17 L81 20 L78 26 L75 20 L69 17 L75 14 Z"
            fill="#fef08a"
            className="drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]"
          />
        </svg>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="pointer-events-none select-none flex items-center justify-center"
      animate={{
        opacity: [0.85, 1, 0.9, 1, 0.85],
        scale: [0.97, 1.03, 0.98, 1.02, 0.97],
      }}
      transition={{ duration: 4.0, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
    >
      <svg viewBox="0 0 100 85" className="h-12 w-16 sm:h-16 sm:w-20 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] drop-shadow-[0_0_24px_rgba(245,158,11,0.55)]">
        <rect
          x="12"
          y="24"
          width="76"
          height="52"
          rx="12"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M34 24 L39 12 L61 12 L66 24"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="50" r="16" fill="none" stroke="#fef08a" strokeWidth="3" />
        <circle cx="50" cy="50" r="6" fill="#fef08a" />
        <circle cx="74" cy="34" r="3" fill="#f43f5e" className="drop-shadow-[0_0_4px_rgba(244,63,94,0.9)]" />
        <path
          d="M20 10 L23 16 L29 19 L23 22 L20 28 L17 22 L11 19 L17 16 Z"
          fill="#fef08a"
          className="drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
        />
      </svg>
    </motion.div>
  );
}

/**
 * Tali Lampu Peri Menggantung Cantik di Atas Sayap Foto
 */
function FairyLightStringDrape() {
  return (
    <div className="pointer-events-none relative w-full h-6 overflow-hidden select-none opacity-85 my-0.5">
      <svg viewBox="0 0 300 35" className="w-full h-full text-amber-300">
        <path
          d="M0 5 Q75 30 150 16 Q225 30 300 5"
          fill="none"
          stroke="rgba(251, 191, 36, 0.55)"
          strokeWidth="1.5"
        />
        <circle cx="45" cy="18" r="3" fill="#fef08a" className="drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
        <circle cx="105" cy="26" r="3" fill="#fbcfe8" className="drop-shadow-[0_0_6px_rgba(244,114,182,0.9)]" />
        <circle cx="150" cy="16" r="3.5" fill="#fef08a" className="drop-shadow-[0_0_7px_rgba(251,191,36,0.95)]" />
        <circle cx="195" cy="26" r="3" fill="#ddd6fe" className="drop-shadow-[0_0_6px_rgba(167,139,250,0.9)]" />
        <circle cx="255" cy="18" r="3" fill="#fef08a" className="drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
      </svg>
    </div>
  );
}

/**
 * Rak Display Aksesoris / Properti Foto Bando Lucu Khas Photobooth
 */
function PropAccessoryShelf({ items }: { items: { emoji: string; bg: string }[] }) {
  return (
    <div className="relative flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:py-1.5 rounded-2xl bg-white/75 backdrop-blur-md border border-pink-200/90 shadow-sm shadow-pink-500/10">
      {items.map((item, i) => (
        <motion.button
          key={`prop-${i}`}
          type="button"
          className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-sm sm:text-base shadow-2xs border border-white/80 cursor-pointer ${item.bg}`}
          whileHover={{ scale: 1.25, rotate: i % 2 === 0 ? 10 : -10 }}
          whileTap={{ scale: 0.92 }}
          animate={{ y: [0, i % 2 === 0 ? -2 : 2, 0] }}
          transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
          aria-label={`Aksesoris photobooth ${item.emoji}`}
        >
          <span>{item.emoji}</span>
        </motion.button>
      ))}
    </div>
  );
}

/**
 * Tanaman Hias Pot Keramik di Sudut Bawah
 */
function PottedStudioPlant({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className={`pointer-events-none absolute bottom-0.5 z-10 flex flex-col items-center opacity-75 select-none ${
        isLeft ? "left-0.5 sm:left-2" : "right-0.5 sm:right-2 -scale-x-100"
      }`}
    >
      <svg viewBox="0 0 60 70" className="h-9 w-8 sm:h-12 sm:w-11">
        <polygon points="15,45 45,45 40,68 20,68" fill="#fce7f3" stroke="#f472b6" strokeWidth="2" />
        <ellipse cx="30" cy="45" rx="15" ry="4" fill="#fda4af" />
        <path d="M30 45 C28 32 15 25 8 18 C15 15 25 22 30 38" fill="#86efac" stroke="#16a34a" strokeWidth="1.5" />
        <path d="M30 45 C32 30 45 20 52 14 C48 24 40 32 30 40" fill="#4ade80" stroke="#16a34a" strokeWidth="1.5" />
        <path d="M30 45 C30 25 25 15 30 5 C35 15 34 28 30 42" fill="#22c55e" stroke="#15803d" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/**
 * Tirai Beludru Sutra Studio di Tepi Layar
 */
function StudioCurtainDrape({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className={`pointer-events-none absolute top-0 bottom-0 z-10 w-8 sm:w-14 md:w-20 select-none overflow-hidden ${
        isLeft ? "left-0" : "right-0 -scale-x-100"
      }`}
    >
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(90deg, rgba(244,114,182,0.38) 0%, rgba(251,113,133,0.2) 40%, rgba(253,164,175,0.06) 75%, transparent 100%)",
        }}
      />
    </div>
  );
}

export function WelcomeScreen({ uiTheme, onStart, onDashboard }: WelcomeScreenProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleStart = useCallback(() => {
    if (isOpening) return;
    setIsOpening(true);
    playGateOpenSound();

    // Waktu transisi enteng dan cepat (~380ms)
    window.setTimeout(() => {
      onStart();
    }, 380);
  }, [isOpening, onStart]);

  return (
    <motion.div
      className="fixed inset-0 h-[100dvh] w-[100dvw] max-h-[100dvh] max-w-[100dvw] overflow-hidden select-none touch-none z-20 flex items-center justify-center"
      initial={pageIn}
      animate={pageAnimate}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Background Khas Pixiebooth */}
      <div className="booth-bg absolute inset-0 z-0" />

      {/* Rangkaian Lampu Peri Gantung di Puncak Layar (Top 0px) */}
      <FairyLightGarland />

      {/* Partikel Kelip Dongeng & Kilatan Kamera Studio */}
      <AtmosphericSparkles />
      <StudioCameraFlash />
      <FloatingPropsStickers />

      {/* Tombol Akses Dashboard Admin */}
      <motion.button
        type="button"
        onClick={onDashboard}
        disabled={isOpening}
        animate={{ opacity: isOpening ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        className="absolute left-3 top-3 sm:left-4 sm:top-4 z-40 flex items-center gap-1.5 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur-md transition-transform hover:scale-105 active:scale-95 dark:bg-white/10 cursor-pointer"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-pink-500" />
        <span>Dashboard</span>
      </motion.button>

      {/* Logo Brand PixieBooth Elegan di Puncak Tengah - Bersih & Fullscreen */}
      <motion.div
        className="pointer-events-none absolute top-2 sm:top-3 md:top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center select-none"
        animate={{ opacity: isOpening ? 0 : 1, y: isOpening ? -20 : 0 }}
        transition={{ duration: 0.25 }}
      >
        <h1
          className="bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 bg-clip-text text-3xl sm:text-4xl md:text-5xl font-black text-transparent tracking-wide drop-shadow-[0_4px_18px_rgba(236,72,153,0.35)]"
          style={{ fontFamily: "Pacifico, cursive" }}
        >
          {uiTheme.brandName || "PixieBooth"}
        </h1>
      </motion.div>

      {/* =========================================================================
          FASAD UTAMA 100% FULLSCREEN (SAYAP FOTO KIRI, GERBANG ISTANA, SAYAP FOTO KANAN)
         ========================================================================= */}
      <div className="relative w-full h-full min-h-[100dvh] flex items-center justify-between px-1 sm:px-3 md:px-6 z-20 overflow-hidden">
        {/* Tirai Beludru Studio & Tanaman Hias Sudut */}
        <StudioCurtainDrape side="left" />
        <StudioCurtainDrape side="right" />
        <PottedStudioPlant side="left" />
        <PottedStudioPlant side="right" />

        {/* SAYAP FOTO KIRI: NEON ART, FAIRY LIGHTS, STRIP & POLAROID, PROP SHELF */}
        <div className="relative z-10 flex-1 h-full flex flex-col items-center justify-between py-5 sm:py-7 px-1.5 sm:px-3 max-w-[420px] min-w-0">
          {/* Bagian Atas: Wall Sconce & Seni Neon Hati Hangat */}
          <div className="w-full flex items-center justify-center gap-2 sm:gap-5 shrink-0 pt-1">
            <div className="hidden sm:block">
              <WallSconce />
            </div>
            <NeonStudioArt type="heart" />
            <div className="hidden md:block">
              <WallSconce />
            </div>
          </div>

          {/* Tali Lampu Peri Menggantung Cantik */}
          <FairyLightStringDrape />

          {/* Area Foto Strip & Polaroid Tengah yang Bergerak Dinamis */}
          <div className="relative z-10 flex items-center justify-center gap-2.5 sm:gap-4 w-full my-auto py-1">
            <RealPhotoboothStrip
              src="/samples/strip_left.jpg"
              tilt={-3}
              floatY={7}
              duration={4.6}
              delay={0}
            />
            <SamplePolaroidPhoto
              photo="/samples/polaroid_sample.jpg"
              tilt={2.5}
              floatY={6}
              duration={5.2}
              delay={0.6}
            />
          </div>

          {/* Bagian Bawah: Rak Display Properti Bando & Kacamata Photobooth */}
          <div className="relative z-20 w-full flex flex-col items-center shrink-0 pb-2.5 sm:pb-3.5">
            <PropAccessoryShelf
              items={[
                { emoji: "🐰", bg: "bg-pink-100/90" },
                { emoji: "🕶️", bg: "bg-rose-100/90" },
                { emoji: "👑", bg: "bg-amber-100/90" },
                { emoji: "🎀", bg: "bg-purple-100/90" },
              ]}
            />
          </div>
        </div>

        {/* GERBANG MEWAH UTAMA DI TENGAH (100% FULLSCREEN HEIGHT DARI ATAS KE BAWAH) */}
        <div className="relative z-20 flex flex-col items-center justify-center h-full w-full max-w-[380px] sm:max-w-[440px] md:max-w-[500px] shrink-0 pt-10 sm:pt-12 md:pt-14 pb-0">
          <div
            onClick={handleStart}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleStart();
            }}
            aria-label="Buka Gerbang Photobooth"
            className="relative w-full h-full min-h-0 rounded-t-[100px] sm:rounded-t-[140px] md:rounded-t-[180px] flex items-center justify-center overflow-hidden border-[5px] sm:border-[7px] md:border-[9px] border-pink-200/90 shadow-2xl bg-gradient-to-b from-pink-50/50 via-white/40 to-pink-50/50 cursor-pointer"
          >
            {/* Lis Emas Lengkungan */}
            <div className="pointer-events-none absolute inset-0 rounded-t-[94px] sm:rounded-t-[132px] md:rounded-t-[170px] border-2 border-amber-300/80 z-25" />

            {/* KONTINER 3D DUA DAUN PINTU GERBANG */}
            <div
              className="absolute inset-0 z-10 overflow-hidden"
              style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
            >
              {/* DAUN PINTU KIRI */}
              <motion.div
                className="absolute left-0 top-0 h-full w-1/2 rounded-tl-[94px] sm:rounded-tl-[132px] md:rounded-tl-[170px] bg-gradient-to-br from-[#fff2f8] via-[#fce7f3] to-[#f6d7ea] shadow-inner overflow-hidden transform-gpu border-r border-amber-300/80"
                style={{
                  transformOrigin: "left center",
                  backfaceVisibility: "hidden",
                  willChange: "transform",
                }}
                animate={{ rotateY: isOpening ? -75 : 0 }}
                transition={{ duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }}
              >
                <div className="flex h-full flex-col justify-between p-1.5 sm:p-2.5 pb-2 gap-1.5 overflow-hidden">
                  {/* Panel 1: Sunburst Arch Transom (Puncak Busur) */}
                  <div className="relative h-18 sm:h-22 md:h-26 rounded-t-full border border-amber-300/90 bg-gradient-to-b from-amber-100/95 via-pink-50/80 to-amber-50/60 shadow-inner overflow-hidden flex items-end justify-center p-0.5 sm:p-1 shrink-0">
                    <SunburstArchGrille />
                  </div>

                  {/* Panel 2: Molding Atas Klasik dengan Relief Roset Emas */}
                  <div className="relative flex-1 rounded-xl border border-amber-300/80 bg-gradient-to-br from-white/95 via-pink-50/50 to-amber-50/40 shadow-inner p-1 sm:p-1.5 flex flex-col items-center justify-center overflow-hidden">
                    <GoldFiligreeCorner position="tl" />
                    <GoldFiligreeCorner position="tr" />
                    <GoldFiligreeCorner position="bl" />
                    <GoldFiligreeCorner position="br" />
                    <div className="w-full h-full rounded-lg border border-amber-300/60 bg-gradient-to-b from-white/75 to-pink-50/40 shadow-2xs flex items-center justify-center">
                      <RoyalDoorRosette />
                    </div>
                  </div>

                  {/* Panel 3: Molding Bawah Klasik dengan Relief Roset Emas */}
                  <div className="relative flex-1 rounded-xl border border-amber-300/80 bg-gradient-to-br from-white/95 via-pink-50/50 to-amber-50/40 shadow-inner p-1 sm:p-1.5 flex flex-col items-center justify-center overflow-hidden">
                    <GoldFiligreeCorner position="tl" />
                    <GoldFiligreeCorner position="tr" />
                    <GoldFiligreeCorner position="bl" />
                    <GoldFiligreeCorner position="br" />
                    <div className="w-full h-full rounded-lg border border-amber-300/60 bg-gradient-to-b from-white/75 to-pink-50/40 shadow-2xs flex items-center justify-center">
                      <RoyalDoorRosette />
                    </div>
                  </div>

                  {/* Panel 4: Plinth Alas Klasik Relief Berlian Emas */}
                  <div className="relative h-12 sm:h-14 md:h-16 rounded-lg border border-amber-300/70 bg-gradient-to-br from-white/90 via-amber-50/50 to-pink-50/60 shadow-inner overflow-hidden flex items-center justify-center p-1 shrink-0">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 border border-amber-400/50 rotate-45 flex items-center justify-center shadow-xs bg-amber-50/50">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-amber-300/70 shadow-2xs" />
                    </div>
                  </div>
                </div>

                <LuxuryDoorKnocker side="left" />

                {/* Lis Sambungan Tengah */}
                <div className="absolute right-0 top-0 h-full w-0.5 bg-gradient-to-b from-amber-300 via-pink-300 to-amber-300" />
              </motion.div>

              {/* DAUN PINTU KANAN */}
              <motion.div
                className="absolute right-0 top-0 h-full w-1/2 rounded-tr-[94px] sm:rounded-tr-[132px] md:rounded-tr-[170px] bg-gradient-to-bl from-[#fff2f8] via-[#fce7f3] to-[#f6d7ea] shadow-[inset_3px_0_12px_rgba(236,72,153,0.12)] overflow-hidden transform-gpu border-l border-amber-300/80"
                style={{
                  transformOrigin: "right center",
                  backfaceVisibility: "hidden",
                  willChange: "transform",
                }}
                animate={{ rotateY: isOpening ? 75 : 0 }}
                transition={{ duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }}
              >
                <div className="flex h-full flex-col justify-between p-1.5 sm:p-2.5 pb-2 gap-1.5 overflow-hidden">
                  {/* Panel 1: Sunburst Arch Transom (Puncak Busur) */}
                  <div className="relative h-18 sm:h-22 md:h-26 rounded-t-full border border-amber-300/90 bg-gradient-to-b from-amber-100/95 via-pink-50/80 to-amber-50/60 shadow-inner overflow-hidden flex items-end justify-center p-0.5 sm:p-1 shrink-0">
                    <SunburstArchGrille />
                  </div>

                  {/* Panel 2: Molding Atas Klasik dengan Relief Roset Emas */}
                  <div className="relative flex-1 rounded-xl border border-amber-300/80 bg-gradient-to-bl from-white/95 via-pink-50/50 to-amber-50/40 shadow-inner p-1 sm:p-1.5 flex flex-col items-center justify-center overflow-hidden">
                    <GoldFiligreeCorner position="tl" />
                    <GoldFiligreeCorner position="tr" />
                    <GoldFiligreeCorner position="bl" />
                    <GoldFiligreeCorner position="br" />
                    <div className="w-full h-full rounded-lg border border-amber-300/60 bg-gradient-to-b from-white/75 to-pink-50/40 shadow-2xs flex items-center justify-center">
                      <RoyalDoorRosette />
                    </div>
                  </div>

                  {/* Panel 3: Molding Bawah Klasik dengan Relief Roset Emas */}
                  <div className="relative flex-1 rounded-xl border border-amber-300/80 bg-gradient-to-bl from-white/95 via-pink-50/50 to-amber-50/40 shadow-inner p-1 sm:p-1.5 flex flex-col items-center justify-center overflow-hidden">
                    <GoldFiligreeCorner position="tl" />
                    <GoldFiligreeCorner position="tr" />
                    <GoldFiligreeCorner position="bl" />
                    <GoldFiligreeCorner position="br" />
                    <div className="w-full h-full rounded-lg border border-amber-300/60 bg-gradient-to-b from-white/75 to-pink-50/40 shadow-2xs flex items-center justify-center">
                      <RoyalDoorRosette />
                    </div>
                  </div>

                  {/* Panel 4: Plinth Alas Klasik Relief Berlian Emas */}
                  <div className="relative h-12 sm:h-14 md:h-16 rounded-lg border border-amber-300/70 bg-gradient-to-bl from-white/90 via-amber-50/50 to-pink-50/60 shadow-inner overflow-hidden flex items-center justify-center p-1 shrink-0">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 border border-amber-400/50 rotate-45 flex items-center justify-center shadow-xs bg-amber-50/50">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-amber-300/70 shadow-2xs" />
                    </div>
                  </div>
                </div>

                <LuxuryDoorKnocker side="right" />
              </motion.div>
            </div>

            {/* TOMBOL START MEDALI SHUTTER MEWAH DI TENGAH */}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-auto"
              animate={
                isOpening
                  ? { scale: 1.15, opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }
                  : { scale: 1, opacity: 1 }
              }
            >
              <motion.button
                type="button"
                onClick={handleStart}
                disabled={isOpening}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                className="group relative flex flex-col items-center justify-center rounded-full p-1.5 cursor-pointer select-none"
                aria-label="Start Your Photoshoot"
              >
                {/* Lapisan 1: Gelombang Denyut Berpendar (Aura Pulse) */}
                <motion.div
                  className="pointer-events-none absolute inset-[-14px] rounded-full bg-gradient-to-r from-pink-500/40 via-amber-400/45 to-fuchsia-600/40 blur-lg"
                  animate={{
                    scale: [1, 1.25, 1],
                    opacity: [0.55, 0.95, 0.55],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Lapisan 2: Gelombang Cincin Kedua (Secondary Pulse) */}
                <motion.div
                  className="pointer-events-none absolute inset-[-6px] rounded-full border-2 border-pink-400/60"
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.8, 0.2, 0.8],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.4,
                  }}
                />

                {/* Lapisan 3: Ring Bezel Emas 3D (Gold Metallic Rim) */}
                <div className="absolute inset-0 rounded-full border-3 sm:border-4 border-amber-300 bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 shadow-xl shadow-amber-950/25" />

                {/* Lapisan 4: Tombol Shutter Utama (Camera Iris Shutter Core) */}
                <div className="relative flex h-22 w-22 sm:h-26 sm:w-26 md:h-28 md:w-28 flex-col items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-600 p-2 text-center text-white overflow-hidden shadow-inner">
                  {/* Kilau Kaca Reflektif Atas */}
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/15 to-white/35 rounded-full" />

                  {/* Lingkaran Aperture / Shutter Blade Indikator */}
                  <div className="relative flex items-center justify-center mb-0.5">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                      className="absolute h-9 w-9 sm:h-11 sm:w-11 rounded-full border border-dashed border-amber-200/60 opacity-80"
                    />
                    {/* Ikon Kamera Shutter Ceria */}
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      className="relative z-10 flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-white/20 backdrop-blur-xs border border-white/60 text-amber-200 shadow-xs"
                    >
                      <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white drop-shadow-xs" />
                    </motion.div>
                  </div>

                  {/* Teks START Bersih, Bold & Ikonik */}
                  <span className="relative text-sm sm:text-base font-black tracking-widest uppercase text-white drop-shadow-md">
                    START
                  </span>
                </div>
              </motion.button>
            </motion.div>
          </div>

          {/* PILAR MARMER CORINTHIAN DI KIRI & KANAN GERBANG */}
          <RoyalPalacePillar side="left" />
          <RoyalPalacePillar side="right" />
        </div>

        {/* SAYAP FOTO KANAN: NEON ART, FAIRY LIGHTS, PROPS STRIP & GRID, PROP SHELF */}
        <div className="relative z-10 flex-1 h-full flex flex-col items-center justify-between py-5 sm:py-7 px-1.5 sm:px-3 max-w-[420px] min-w-0">
          {/* Bagian Atas: Wall Sconce & Seni Neon Kamera Hangat */}
          <div className="w-full flex items-center justify-center gap-2 sm:gap-5 shrink-0 pt-1">
            <div className="hidden md:block">
              <WallSconce />
            </div>
            <NeonStudioArt type="camera" />
            <div className="hidden sm:block">
              <WallSconce />
            </div>
          </div>

          {/* Tali Lampu Peri Menggantung Cantik */}
          <FairyLightStringDrape />

          {/* Area Foto Strip & Grid Collage Tengah yang Bergerak Dinamis */}
          <div className="relative z-10 flex items-center justify-center gap-2.5 sm:gap-4 w-full my-auto py-1">
            <RealPhotoboothStrip
              src="/samples/strip_right.jpg"
              alt="Korean Props Photobooth Strip"
              tilt={3}
              floatY={7}
              duration={4.8}
              delay={0.3}
            />
            <SampleGridPhoto
              tilt={-2}
              floatY={6.5}
              duration={5.0}
              delay={0.8}
            />
          </div>

          {/* Bagian Bawah: Rak Display Properti Bando & Kacamata Photobooth */}
          <div className="relative z-20 w-full flex flex-col items-center shrink-0 pb-2.5 sm:pb-3.5">
            <PropAccessoryShelf
              items={[
                { emoji: "🐻", bg: "bg-amber-100/90" },
                { emoji: "⭐", bg: "bg-yellow-100/90" },
                { emoji: "🪄", bg: "bg-pink-100/90" },
                { emoji: "👓", bg: "bg-blue-100/90" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          EFEK TRANSISI 100% FULLSCREEN & FULL HEIGHT (MENUTUPI SELURUH LAYAR)
          Super cepat, 60fps GPU murni tanpa repaint berat
         ========================================================================= */}
      <AnimatePresence>
        {isOpening && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[9999] bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
