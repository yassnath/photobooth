import { ArrowLeft, RotateCcw, Sliders, Sparkles, Type, X } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

import { PhotoFrame } from "../components/shared/PhotoFrame";
import { SessionTimer } from "../components/shared/SessionTimer";
import { FILTERS, SAMPLE_PHOTOS, STICKERS, TEMPLATES } from "../data/photobooth";
import type { CaptureMode, EditorState, EditorTab, FilterOption, FrameLayout, PhotoAdjustments, TemplateOption } from "../types/photobooth";

interface EditorScreenProps {
  photos: string[];
  mode: CaptureMode;
  frameLayout: FrameLayout;
  sessionEndsAt: number;
  templateId: string;
  initialEditor: EditorState;
  filters?: FilterOption[];
  frames?: TemplateOption[];
  brandName?: string;
  onBack: () => void;
  onContinue: (editor: EditorState) => void;
}

const tabs: Array<{ id: EditorTab; label: string; icon: JSX.Element }> = [
  { id: "filters", label: "Filters", icon: <Sparkles size={15} /> },
  { id: "stickers", label: "Stickers", icon: <span className="text-sm">🎀</span> },
  { id: "text", label: "Text", icon: <Type size={15} /> },
  { id: "adjust", label: "Adjust", icon: <Sliders size={15} /> },
];

export function EditorScreen({
  photos,
  mode,
  frameLayout,
  sessionEndsAt,
  templateId,
  initialEditor,
  filters = FILTERS,
  frames = TEMPLATES,
  brandName = "PixieBooth",
  onBack,
  onContinue,
}: EditorScreenProps) {
  const [tab, setTab] = useState<EditorTab>("filters");
  const [filterId, setFilterId] = useState(initialEditor.filterId);
  const [stickers, setStickers] = useState<string[]>(initialEditor.stickers);
  const [caption, setCaption] = useState(initialEditor.caption);
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>(initialEditor.adjustments);
  const previewPhoto = photos[0] || SAMPLE_PHOTOS[0];

  const updateAdjustment = (key: keyof PhotoAdjustments, value: number) => {
    setAdjustments((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetAdjustments = () => {
    setAdjustments({ brightness: 100, contrast: 100, saturation: 100 });
  };

  const removeLastSticker = () => {
    setStickers((current) => current.slice(0, -1));
  };

  return (
    <motion.div
      className="editor-screen bg-gray-950 flex h-[100dvh] flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
    >
      {/* Header Bar */}
      <div className="editor-header flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3 bg-gray-950/80 backdrop-blur-md z-20">
        <button onClick={onBack} className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20" aria-label="Back to camera">
          <ArrowLeft size={16} /> Kamera
        </button>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <h3 className="text-base sm:text-lg font-black text-white" style={{ fontFamily: "Pacifico, cursive" }}>Pilih Filter & Hias Foto</h3>
          <SessionTimer endsAt={sessionEndsAt} compact />
        </div>
        <motion.button
          className="rounded-full bg-gradient-to-r from-pink-400 to-violet-500 px-5 py-2 text-xs sm:text-sm font-black text-white shadow-lg shadow-pink-500/25"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => onContinue({ filterId, stickers, caption, adjustments })}
        >
          Selesai & Lanjut ✓
        </motion.button>
      </div>

      {/* Main Content Area: Side-by-Side 2-Column Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Side: 100% Full Size Photo Frame Preview */}
        <div className="editor-preview-pane flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-6 bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.12),transparent_70%)]">
          <PhotoFrame
            photos={photos}
            mode={mode}
            frameLayout={frameLayout}
            templateId={templateId}
            editor={{ filterId, stickers, caption, adjustments }}
            variant="editor"
            fallbackPhoto={SAMPLE_PHOTOS[0]}
            filters={filters}
            frames={frames}
            brandName={brandName}
          />
        </div>

        {/* Right Side: Full-Height Sidebar Controls */}
        <div className="editor-sidebar w-72 sm:w-80 lg:w-96 flex flex-col shrink-0 border-l border-white/10 bg-gray-900 overflow-hidden shadow-2xl z-10">
          {/* Sidebar Tabs */}
          <div className="grid grid-cols-4 border-b border-white/10 bg-gray-950/50 shrink-0">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-black transition-all ${
                  tab === item.id ? "border-b-2 border-pink-400 text-pink-400 bg-white/5" : "text-white/40 hover:text-white/70"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Sidebar Content Panel */}
          <div className="editor-panel-content flex-1 overflow-y-auto p-4 scrollbar-hide">
            {tab === "filters" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white/50 uppercase tracking-wider">Efek Filter Warna</span>
                  <span className="text-[11px] font-bold text-pink-400">{filters.length} Pilihan</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {filters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setFilterId(filter.id)}
                      className={`flex flex-col items-center gap-1.5 transition-all p-1.5 rounded-xl border ${
                        filterId === filter.id
                          ? "border-pink-400 bg-pink-400/10 shadow-md shadow-pink-400/20"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="aspect-square w-full overflow-hidden rounded-lg bg-pink-100">
                        <img src={previewPhoto} alt={filter.label} className="h-full w-full object-cover" style={{ filter: filter.css || undefined }} />
                      </div>
                      <span className={`text-[10.5px] font-bold truncate w-full text-center ${filterId === filter.id ? "text-pink-300 font-black" : "text-white/70"}`}>
                        {filter.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "stickers" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white/50 uppercase tracking-wider">{stickers.length} Sticker Terpasang</span>
                  <button
                    onClick={removeLastSticker}
                    disabled={stickers.length === 0}
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <X size={13} /> Hapus Sticker
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {STICKERS.map((sticker, idx) => (
                    <button
                      key={`${sticker}-${idx}`}
                      onClick={() => setStickers((current) => [...current, sticker])}
                      className="aspect-square flex items-center justify-center rounded-xl bg-white/5 text-2xl transition-all hover:scale-110 hover:bg-white/15 active:scale-95 border border-white/10"
                    >
                      {sticker}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "text" && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-black text-white/50 uppercase tracking-wider block mb-2" htmlFor="caption-input">
                    Teks / Caption Frame
                  </label>
                  <input
                    id="caption-input"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    maxLength={32}
                    placeholder="PixieBooth ♡"
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-pink-400"
                  />
                  <p className="mt-1 text-right text-[11px] font-semibold text-white/40">{caption.length}/32 Karakter</p>
                </div>
              </div>
            )}

            {tab === "adjust" && (
              <div className="space-y-5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white/50 uppercase tracking-wider">Penyesuaian Visual</span>
                  <button
                    onClick={resetAdjustments}
                    className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20"
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Brightness (Kecerahan)", key: "brightness" as const, value: adjustments.brightness },
                    { label: "Contrast (Kontras)", key: "contrast" as const, value: adjustments.contrast },
                    { label: "Saturation (Saturasi)", key: "saturation" as const, value: adjustments.saturation },
                  ].map((item) => (
                    <div key={item.key} className="space-y-1.5 rounded-xl bg-white/5 p-3 border border-white/10">
                      <div className="flex items-center justify-between text-xs font-bold text-white/80">
                        <span>{item.label}</span>
                        <span className="text-pink-400 font-mono">{item.value}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        value={item.value}
                        onChange={(event) => updateAdjustment(item.key, Number(event.target.value))}
                        className="w-full h-1.5 cursor-pointer accent-pink-400 rounded-lg bg-white/20"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
