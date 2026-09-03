import { ArrowLeft, Check, Download, Instagram, Share2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "motion/react";

import { ScannableQRCode } from "../components/shared/ScannableQRCode";
import { FloatingParticles } from "../components/shared/FloatingParticles";
import { pageAnimate, pageIn, pageOut, pageTransition } from "../components/shared/animations";

interface ShareScreenProps {
  onBack: () => void;
  onGoodbye: () => void;
}

export function ShareScreen({ onBack, onGoodbye }: ShareScreenProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const copy = async () => {
    const shareUrl = "pixiebooth.io/s/abc123";

    try {
      await navigator.clipboard?.writeText(shareUrl);
    } catch {
      // The label still gives feedback when clipboard is unavailable.
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  };

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden px-4 py-6 sm:py-8"
      initial={pageIn}
      animate={pageAnimate}
      exit={pageOut}
      transition={pageTransition}
    >
      <div className="booth-bg absolute inset-0" />
      <FloatingParticles count={10} />

      <div className="share-shell relative z-10 gap-5 sm:gap-6">
        <div className="flex w-full items-center justify-between">
          <button
            onClick={onBack}
            className="rounded-full border border-white/60 bg-white/60 p-2.5 shadow-sm transition-transform hover:scale-110 dark:bg-white/10"
            aria-label="Back to result"
          >
            <ArrowLeft size={19} />
          </button>
          <h2 className="text-2xl font-black" style={{ fontFamily: "Pacifico, cursive" }}>
            <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">Share ♡</span>
          </h2>
          <div className="w-10" />
        </div>

        <p className="text-center text-sm text-muted-foreground">Scan QR or share via your favorite app ✨</p>

        <motion.div
          className="rounded-3xl border border-border bg-white p-5 shadow-xl dark:bg-card sm:p-6"
          initial={{ scale: 0, rotate: -12 }}
          animate={revealed ? { scale: 1, rotate: 0 } : {}}
          transition={{ type: "spring", stiffness: 160, damping: 13 }}
        >
          <div className="mx-auto w-fit">
            <ScannableQRCode value={window.location.href} size={190} label="QR hasil photobooth" />
          </div>
          <p className="mt-3 text-center text-xs font-bold text-muted-foreground">Scan to get your photos ♡</p>
          <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">pixiebooth.io/s/abc123</span>
            <button onClick={copy} className="shrink-0 text-xs font-bold text-primary">
              {copied ? <Check size={14} /> : "Copy"}
            </button>
          </div>
        </motion.div>

        <div className="grid w-full grid-cols-2 gap-3">
          {[
            { label: "Download", icon: <Download size={17} />, gradient: "from-pink-400 to-rose-500" },
            { label: "Instagram", icon: <Instagram size={17} />, gradient: "from-purple-500 to-pink-500" },
            { label: "WhatsApp", icon: <Share2 size={17} />, gradient: "from-green-400 to-emerald-600" },
            { label: "TikTok", icon: <Video size={17} />, gradient: "from-sky-400 to-blue-600" },
          ].map((item) => (
            <motion.button
              key={item.label}
              className={`flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r py-3.5 font-bold text-white shadow-md ${item.gradient}`}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              {item.icon} {item.label}
            </motion.button>
          ))}
        </div>

        <motion.button
          className="rounded-2xl border-2 border-pink-300 px-8 py-3 font-bold text-pink-500 transition-colors hover:bg-pink-50 dark:text-pink-300 dark:hover:bg-pink-900/30"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onGoodbye}
        >
          Finish Session ♡
        </motion.button>
      </div>
    </motion.div>
  );
}
