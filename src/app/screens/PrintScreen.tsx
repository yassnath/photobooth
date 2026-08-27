import { ArrowLeft, Check, Printer } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { PhotoFrame } from "../components/shared/PhotoFrame";
import { FILTERS, SAMPLE_PHOTOS, TEMPLATES } from "../data/photobooth";
import { pageAnimate, pageIn, pageOut, pageTransition } from "../components/shared/animations";
import type { CaptureMode, EditorState, FilterOption, FrameLayout, TemplateOption } from "../types/photobooth";
import { createPhotoResultBlob } from "../utils/exportResult";
import { sendPrintJob } from "../../shared/agent/client";

type PrintFormat = "strip" | "4r" | "square" | "custom";

interface PrintScreenProps {
  photos: string[];
  mode: CaptureMode;
  frameLayout: FrameLayout;
  templateId: string;
  editor: EditorState;
  filters?: FilterOption[];
  frames?: TemplateOption[];
  brandName?: string;
  onBack: () => void;
}

const printFormats: Array<{ id: PrintFormat; label: string; emoji: string; description: string }> = [
  { id: "strip", label: "2R Strip", emoji: "🎞️", description: "Classic strip" },
  { id: "4r", label: "4R Print", emoji: "🖼️", description: "Standard photo" },
  { id: "square", label: "Square", emoji: "⬛", description: "Instagram ready" },
  { id: "custom", label: "Custom", emoji: "✨", description: "Your frame style" },
];

export function PrintScreen({
  photos,
  mode,
  frameLayout,
  templateId,
  editor,
  filters = FILTERS,
  frames = TEMPLATES,
  brandName = "PixieBooth",
  onBack,
}: PrintScreenProps) {
  const [format, setFormat] = useState<PrintFormat>("strip");
  const [quantity, setQuantity] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [done, setDone] = useState(false);
  const [printError, setPrintError] = useState("");

  const handlePrint = async () => {
    setPrinting(true);
    setPrintError("");
    try {
      const blob = await createPhotoResultBlob({
        photos,
        frameLayout: format === "strip" ? frameLayout : "1x1",
        template: frames.find((frame) => frame.id === templateId),
        editor,
        filters,
        brandName,
      });
      await sendPrintJob(blob, quantity, format);
      setDone(true);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : "Printer agent tidak dapat dihubungi.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden px-4 py-6"
      initial={pageIn}
      animate={pageAnimate}
      exit={pageOut}
      transition={pageTransition}
    >
      <div className="booth-bg absolute inset-0" />

      <div className="print-shell relative z-10 gap-4 sm:gap-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-full border border-white/60 bg-white/60 p-2.5 shadow-sm transition-transform hover:scale-110 dark:bg-white/10"
            aria-label="Back to result"
          >
            <ArrowLeft size={19} />
          </button>
          <h2 className="text-2xl font-black" style={{ fontFamily: "Pacifico, cursive" }}>
            Print 🖨️
          </h2>
        </div>

        <div className="flex min-h-52 items-center justify-center rounded-3xl border border-border bg-white p-4 shadow-xl dark:bg-card sm:p-5">
          <PhotoFrame
            photos={photos}
            mode={mode}
            frameLayout={frameLayout}
            templateId={templateId}
            editor={editor}
            variant="print"
            fallbackPhoto={SAMPLE_PHOTOS[0]}
            printFormat={format === "strip" ? "strip" : "single"}
            filters={filters}
            frames={frames}
            brandName={brandName}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {printFormats.map((item) => (
            <button
              key={item.id}
              onClick={() => setFormat(item.id)}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all sm:p-3.5 ${
                format === item.id
                  ? "border-pink-400 bg-white shadow-md dark:bg-white/10"
                  : "border-white/60 bg-white/60 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
              }`}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-foreground">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-white/70 p-4 backdrop-blur-sm dark:bg-white/10">
          <span className="font-bold text-foreground">Quantity</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100 text-lg font-black text-pink-600 transition-colors hover:bg-pink-200 dark:bg-pink-900/30"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-6 text-center text-lg font-black">{quantity}</span>
            <button
              onClick={() => setQuantity((value) => Math.min(10, value + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100 text-lg font-black text-pink-600 transition-colors hover:bg-pink-200 dark:bg-pink-900/30"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.button
              key="print"
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-black text-white shadow-lg disabled:cursor-wait disabled:opacity-70"
              style={{ background: "linear-gradient(to right, #EC4899, #8B5CF6)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => void handlePrint()}
              disabled={printing}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {printing ? (
                <span className="flex items-center gap-2">
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}>
                    ⏳
                  </motion.span>
                  Sending to printer...
                </span>
              ) : (
                <>
                  <Printer size={20} /> Print {quantity} {quantity === 1 ? "copy" : "copies"}
                </>
              )}
            </motion.button>
          ) : (
            <motion.div
              key="done"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-4 text-lg font-black text-white shadow-lg"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180 }}
            >
              <Check size={20} /> Sent to printer! ✨
            </motion.div>
          )}
        </AnimatePresence>
        {printError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600">{printError}</p>}
      </div>
    </motion.div>
  );
}
