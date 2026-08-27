import { motion } from "motion/react";

import { PAGE_STEPS } from "../../data/photobooth";
import type { Screen } from "../../types/photobooth";

interface ProgressBarProps {
  screen: Screen;
}

export function ProgressBar({ screen }: ProgressBarProps) {
  const step = PAGE_STEPS.indexOf(screen);

  if (step < 0) {
    return null;
  }

  const percent = Math.round(((step + 1) / PAGE_STEPS.length) * 100);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 bg-pink-100/60">
      <motion.div
        className="h-full bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-500"
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
    </div>
  );
}
