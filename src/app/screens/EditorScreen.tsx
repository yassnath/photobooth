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
      className="editor-screen bg-gray-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
    >
      <div className="editor-header flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <button onClick={onBack} className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20" aria-label="Back to camera">
          <ArrowLeft size={19} />
        </button>
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-sm font-black text-white sm:text-base" style={{ fontFamily: "Pacifico, cursive" }}>Pilih Filter</h3>
          <SessionTimer endsAt={sessionEndsAt} compact />
        </div>
        <motion.button
          className="rounded-full bg-gradient-to-r from-pink-400 to-violet-500 px-4 py-1.5 text-sm font-black text-white shadow-md"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => onContinue({ filterId, stickers, caption, adjustments })}
        >
          Done ✓
        </motion.button>
      </div>

      <div className="editor-preview-pane flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-4">
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

      <div className="editor-panel shrink-0 rounded-t-3xl border-t border-white/10 bg-gray-900">
        <div className="grid grid-cols-4 border-b border-white/10">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-3 text-xs font-bold transition-colors ${
                tab === item.id ? "border-b-2 border-pink-400 text-pink-400" : "text-white/40 hover:text-white/65"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="editor-panel-content h-40 overflow-hidden p-3 sm:h-44">
          {tab === "filters" && (
            <div className="flex h-full items-center gap-3 overflow-x-auto scrollbar-hide">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setFilterId(filter.id)}
                  className={`flex shrink-0 flex-col items-center gap-1.5 transition-all ${filterId === filter.id ? "opacity-100" : "opacity-55 hover:opacity-80"}`}
                >
                  <div
                    className={`h-14 w-14 overflow-hidden rounded-xl border-2 bg-pink-100 transition-all ${
                      filterId === filter.id ? "scale-110 border-pink-400 shadow-md shadow-pink-400/30" : "border-white/15"
                    }`}
                  >
                    <img src={previewPhoto} alt={filter.label} className="h-full w-full object-cover" style={{ filter: filter.css || undefined }} />
                  </div>
                  <span className="text-[10px] font-semibold text-white">{filter.label}</span>
                </button>
              ))}
            </div>
          )}

          {tab === "stickers" && (
            <div className="flex h-full flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/45">{stickers.length} stickers</span>
                <button
                  onClick={removeLastSticker}
                  disabled={stickers.length === 0}
                  className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <X size={13} /> Remove
                </button>
              </div>
              <div className="grid grid-cols-10 gap-1.5 overflow-y-auto pt-1 scrollbar-hide min-[420px]:grid-cols-12">
                {STICKERS.map((sticker) => (
                  <button
                    key={sticker}
                    onClick={() => setStickers((current) => [...current, sticker])}
                    className="rounded-lg p-0.5 text-center text-xl leading-none transition-transform hover:scale-125 hover:bg-white/10"
                  >
                    {sticker}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "text" && (
            <div className="flex h-full flex-col justify-center gap-3">
              <label className="text-xs font-bold text-white/50" htmlFor="caption-input">
                Caption
              </label>
              <input
                id="caption-input"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={32}
                placeholder="PixieBooth ♡"
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-pink-400"
              />
              <p className="text-right text-[11px] font-semibold text-white/35">{caption.length}/32</p>
            </div>
          )}

          {tab === "adjust" && (
            <div className="flex h-full flex-col justify-center gap-3">
              {[
                { label: "Brightness", key: "brightness" as const, value: adjustments.brightness },
                { label: "Contrast", key: "contrast" as const, value: adjustments.contrast },
                { label: "Saturation", key: "saturation" as const, value: adjustments.saturation },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-semibold text-white/50">{item.label}</span>
                  <input
                    type="range"
                    min={50}
                    max={150}
                    value={item.value}
                    onChange={(event) => updateAdjustment(item.key, Number(event.target.value))}
                    className="h-1 flex-1 cursor-pointer accent-pink-400"
                  />
                  <span className="w-9 text-right text-xs text-white/35">{item.value}%</span>
                </div>
              ))}
              <button
                onClick={resetAdjustments}
                className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
