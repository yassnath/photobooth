import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

import { SAMPLE_PHOTOS } from "../data/photobooth";
import { FloatingParticles } from "../components/shared/FloatingParticles";
import { pageAnimate, pageIn, pageOut, pageTransition } from "../components/shared/animations";
import type { BoothThemeSettings } from "../types/photobooth";

interface WelcomeScreenProps {
  isDark: boolean;
  uiTheme: BoothThemeSettings;
  onStart: () => void;
  onDashboard: () => void;
  onToggleDark: () => void;
}

export function WelcomeScreen({ isDark, uiTheme, onStart, onDashboard, onToggleDark }: WelcomeScreenProps) {
  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden px-4 py-8"
      initial={pageIn}
      animate={pageAnimate}
      exit={pageOut}
      transition={pageTransition}
    >
      <div className="booth-bg absolute inset-0" />
      <motion.div
        className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-pink-300/35 blur-3xl"
        animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 7, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-violet-300/35 blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl"
        animate={{ x: [0, -30, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 9, repeat: Infinity }}
      />
      <FloatingParticles count={18} />

      <button
        onClick={onDashboard}
        className="absolute left-5 top-5 z-10 rounded-full border border-white/60 bg-white/50 px-4 py-2 text-xs font-black text-foreground shadow-sm backdrop-blur-sm transition-transform hover:scale-105 dark:bg-white/10"
      >
        Dashboard
      </button>

      <button
        onClick={onToggleDark}
        className="absolute right-5 top-5 z-10 rounded-full border border-white/60 bg-white/50 p-2.5 text-foreground shadow-sm backdrop-blur-sm transition-transform hover:scale-110 dark:bg-white/10"
        aria-label="Toggle dark mode"
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="welcome-shell relative z-10 min-h-[calc(100dvh-4rem)] items-center justify-center gap-5 text-center sm:gap-7">
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 90 }}
        >
          <motion.div
            className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-400 via-fuchsia-400 to-violet-500 shadow-2xl shadow-pink-400/40 sm:h-24 sm:w-24"
            animate={{ rotate: [0, 6, -6, 0], scale: [1, 1.04, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="text-4xl sm:text-5xl">{uiTheme.logoEmoji}</span>
          </motion.div>
          <h1
            className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-5xl font-black text-transparent sm:text-6xl"
            style={{ fontFamily: "Pacifico, cursive" }}
          >
            {uiTheme.brandName}
          </h1>
        </motion.div>

        <motion.p
          className="text-base font-bold text-foreground/70 sm:text-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          Let&apos;s Take Some Memories! ✨
        </motion.p>

        <motion.p
          className="-mt-2 text-xs text-foreground/45 sm:-mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {uiTheme.tagline}
        </motion.p>

        <motion.div
          className="flex max-w-full gap-2 overflow-hidden px-1 sm:gap-2.5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          {SAMPLE_PHOTOS.slice(0, 5).map((url, index) => (
            <motion.div
              key={url}
              className="h-14 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-pink-100 shadow-md sm:h-16 sm:w-14"
              animate={{ y: [0, index % 2 === 0 ? -5 : 5, 0] }}
              transition={{ duration: 2.4 + index * 0.22, repeat: Infinity, delay: index * 0.18, ease: "easeInOut" }}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </motion.div>
          ))}
        </motion.div>

        <motion.button
          className="w-full max-w-md rounded-2xl bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-500 px-8 py-4 text-base font-black text-white shadow-xl shadow-pink-400/35 transition-shadow hover:shadow-pink-400/55 sm:text-lg"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 130 }}
          onClick={onStart}
        >
          Start Your Photoshoot 🎉
        </motion.button>

        <motion.div className="flex flex-wrap justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {["Photo Strip", "GIF", "Boomerang", "Live Photo", "Video"].map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/60 bg-white/55 px-3 py-1 text-xs font-semibold text-foreground/55 backdrop-blur-sm"
            >
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
