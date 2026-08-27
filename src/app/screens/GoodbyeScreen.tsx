import { motion } from "motion/react";

import { ScannableQRCode } from "../components/shared/ScannableQRCode";
import { FloatingParticles } from "../components/shared/FloatingParticles";

interface GoodbyeScreenProps {
  onRestart: () => void;
}

export function GoodbyeScreen({ onRestart }: GoodbyeScreenProps) {
  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="booth-bg absolute inset-0" />
      <motion.div
        className="absolute left-0 top-0 h-80 w-80 rounded-full bg-pink-300/30 blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl"
        animate={{ scale: [1.3, 1, 1.3], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 9, repeat: Infinity }}
      />
      <FloatingParticles count={22} />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm flex-col items-center justify-center gap-5 text-center sm:gap-6">
        <motion.div
          className="text-7xl sm:text-8xl"
          animate={{ scale: [1, 1.28, 1], rotate: [0, 12, -12, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          💖
        </motion.div>

        <motion.h1
          className="text-4xl font-black leading-tight sm:text-5xl"
          style={{ fontFamily: "Pacifico, cursive" }}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
            Thanks for making memories!
          </span>
        </motion.h1>

        <motion.p className="text-3xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
          ♡
        </motion.p>

        <motion.p className="text-sm text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          Your photos are saved and ready to share ✨
        </motion.p>

        <motion.div
          className="rounded-3xl border border-border bg-white p-5 shadow-xl dark:bg-card"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.9, type: "spring", stiffness: 130 }}
        >
          <ScannableQRCode value={window.location.origin} size={150} label="QR halaman photobooth" />
          <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">Access your session gallery</p>
        </motion.div>

        <motion.button
          className="rounded-2xl bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-500 px-10 py-4 text-lg font-black text-white shadow-xl shadow-pink-400/35"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, type: "spring" }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRestart}
        >
          Start New Session 📸
        </motion.button>
      </div>
    </motion.div>
  );
}
