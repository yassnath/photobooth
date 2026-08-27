import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

import { FloatingParticles } from "../components/shared/FloatingParticles";
import { pageAnimate, pageIn, pageOut, pageTransition } from "../components/shared/animations";
import { MODES } from "../data/photobooth";
import type { CaptureMode } from "../types/photobooth";

interface ModeSelectorScreenProps {
  initialMode: CaptureMode;
  onBack: () => void;
  onSelect: (mode: CaptureMode) => void;
}

export function ModeSelectorScreen({ initialMode, onBack, onSelect }: ModeSelectorScreenProps) {
  const [selected, setSelected] = useState<CaptureMode>(initialMode);
  const captureModes = MODES.filter((mode) => mode.id === "photo" || mode.id === "live" || mode.id === "gif");

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden"
      initial={pageIn}
      animate={pageAnimate}
      exit={pageOut}
      transition={pageTransition}
    >
      <div className="booth-bg absolute inset-0" />
      <FloatingParticles count={8} />

      <div className="selection-shell relative z-10">
        <div className="mb-6 flex items-center gap-3 sm:mb-8">
          <button
            onClick={onBack}
            className="rounded-full border border-white/60 bg-white/60 p-2.5 shadow-sm backdrop-blur-sm transition-transform hover:scale-110 dark:bg-white/10"
            aria-label="Back to welcome"
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <h2 className="text-2xl font-black" style={{ fontFamily: "Pacifico, cursive" }}>
              Pilih Hasil Foto
            </h2>
            <p className="text-xs text-muted-foreground">Format ini akan digunakan sampai sesi selesai</p>
          </div>
        </div>

        <div className="mode-grid flex-1">
          {captureModes.map((mode, index) => (
            <motion.button
              key={mode.id}
              className={`mode-card relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 p-4 text-center transition-all sm:p-5 ${
                selected === mode.id
                  ? "border-pink-400 bg-white shadow-xl shadow-pink-200/40 dark:bg-white/10"
                  : "border-white/60 bg-white/60 backdrop-blur-sm hover:border-pink-200 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
              }`}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelected(mode.id)}
              aria-label={`Pilih format ${mode.label}`}
              aria-pressed={selected === mode.id}
            >
              {selected === mode.id && (
                <motion.div
                  className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-pink-400"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                >
                  <Check size={11} className="text-white" />
                </motion.div>
              )}
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-sm ${mode.gradient}`}>
                {mode.emoji}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{mode.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{mode.description}</p>
              </div>
            </motion.button>
          ))}
        </div>

        <motion.button
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-pink-400 to-violet-500 py-4 text-base font-black text-white shadow-lg shadow-pink-200/50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(selected)}
        >
          Lanjut dengan {captureModes.find((mode) => mode.id === selected)?.label}
        </motion.button>
      </div>
    </motion.div>
  );
}
