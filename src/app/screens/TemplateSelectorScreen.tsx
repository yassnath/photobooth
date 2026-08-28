import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

import { SessionTimer } from "../components/shared/SessionTimer";
import { pageAnimate, pageIn, pageOut, pageTransition } from "../components/shared/animations";
import { FRAME_LAYOUTS, TEMPLATE_CATEGORIES, TEMPLATES } from "../data/photobooth";
import type { FrameLayout, TemplateCategory, TemplateOption } from "../types/photobooth";

interface TemplateSelectorScreenProps {
  sessionEndsAt?: number | null;
  onBack: () => void;
  onSelect: (templateId: string, layout: FrameLayout) => void;
  templates?: TemplateOption[];
}

function LayoutPreview({ shots, selected }: { shots: number; selected: boolean }) {
  return (
    <div className={`flex h-14 w-10 shrink-0 flex-col gap-0.5 rounded-md border-2 p-1 ${selected ? "border-pink-500 bg-pink-50" : "border-foreground/25 bg-white/60"}`}>
      {Array.from({ length: shots }, (_, index) => (
        <span key={index} className={`min-h-0 flex-1 rounded-[2px] ${selected ? "bg-pink-300" : "bg-foreground/15"}`} />
      ))}
    </div>
  );
}

function ChromaImage({ src, className, alt = "" }: { src: string; className?: string; alt?: string }) {
  const [cleanedSrc, setCleanedSrc] = useState<string>(src);

  useEffect(() => {
    if (!src) {
      setCleanedSrc("");
      return;
    }
    let isMounted = true;
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 600;
        canvas.height = img.naturalHeight || 1800;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setCleanedSrc(src);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let greenFound = false;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (g > 65 && g > r * 1.15 && g > b * 1.15) {
            data[i + 3] = 0; // Turn green pixels transparent
            greenFound = true;
          }
        }
        if (greenFound) {
          ctx.putImageData(imageData, 0, 0);
          setCleanedSrc(canvas.toDataURL("image/png"));
        } else {
          setCleanedSrc(src);
        }
      } catch {
        setCleanedSrc(src);
      }
    };
    img.onerror = () => setCleanedSrc(src);
    img.src = src;

    return () => {
      isMounted = false;
    };
  }, [src]);

  return <img src={cleanedSrc} alt={alt} className={className} />;
}

export function TemplateSelectorScreen({ sessionEndsAt, onBack, onSelect, templates = TEMPLATES }: TemplateSelectorScreenProps) {
  const [layout, setLayout] = useState<FrameLayout>("1x1");
  const [category, setCategory] = useState<TemplateCategory>("All");
  const [selected, setSelected] = useState(templates[0]?.id || "han-river");
  const categories = useMemo(() => {
    const dynamicCategories = new Set<TemplateCategory>(["All"]);
    templates.forEach((template) => dynamicCategories.add(template.category));
    return TEMPLATE_CATEGORIES.filter((item) => dynamicCategories.has(item));
  }, [templates]);
  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) => {
        const matchesCategory = category === "All" || template.category === category;
        const matchesLayout = !template.layout || template.layout === "all" || template.layout === layout;
        return matchesCategory && matchesLayout;
      }),
    [category, layout, templates],
  );

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden"
      initial={pageIn}
      animate={pageAnimate}
      exit={pageOut}
      transition={pageTransition}
    >
      <div className="booth-bg absolute inset-0" />

      <main className="selection-shell relative z-10 h-[100dvh]">
        <header className="mb-3 flex items-center gap-3 sm:mb-4">
          <button
            type="button"
            onClick={onBack}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/60 bg-white/60 shadow-sm backdrop-blur-sm transition-transform hover:scale-105 dark:bg-white/10"
            aria-label="Kembali ke consent"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl font-black sm:text-2xl" style={{ fontFamily: "Pacifico, cursive" }}>Pilih Frame</h2>
            <p className="truncate text-xs text-muted-foreground">Tentukan jumlah pose dan desain frame</p>
          </div>
          {sessionEndsAt && <div className="ml-auto"><SessionTimer endsAt={sessionEndsAt} /></div>}
        </header>

        <section className="mb-3 sm:mb-4" aria-labelledby="layout-heading">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="layout-heading" className="text-xs font-black uppercase text-foreground/55">Format foto</h3>
            <span className="text-[11px] font-bold text-muted-foreground">{FRAME_LAYOUTS.find((item) => item.id === layout)?.shots} pose</span>
          </div>
          <div className="frame-layout-grid grid grid-cols-4 gap-2 sm:gap-3">
            {FRAME_LAYOUTS.map((item) => {
              const isSelected = layout === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setLayout(item.id)}
                  aria-pressed={isSelected}
                  className={`relative flex min-w-0 items-center justify-center gap-2 rounded-xl border-2 px-2 py-2 text-left transition-all sm:justify-start sm:px-3 ${isSelected ? "border-pink-400 bg-white shadow-md dark:bg-white/15" : "border-white/70 bg-white/55 hover:bg-white dark:bg-white/5"}`}
                >
                  <LayoutPreview shots={item.shots} selected={isSelected} />
                  <span className="hidden min-w-0 sm:block">
                    <span className="block text-sm font-black">{item.label}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{item.description}</span>
                  </span>
                  <span className="absolute bottom-1 right-1 text-[10px] font-black sm:hidden">{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase text-foreground/55">Desain frame</h3>
          <span className="text-[11px] font-bold text-muted-foreground">{filteredTemplates.length} desain</span>
        </div>
        <div className="mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${category === item ? "bg-pink-400 text-white shadow-md" : "border border-white/60 bg-white/60 text-muted-foreground hover:bg-white dark:bg-white/10"}`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="template-grid min-h-0 flex-1 overflow-y-auto pb-2 scrollbar-hide">
          {filteredTemplates.map((template, index) => (
            <motion.button
              type="button"
              key={template.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.025, 0.25) }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all ${selected === template.id ? "border-pink-400 bg-white shadow-md dark:bg-white/10" : "border-white/60 bg-white/55 hover:bg-white dark:bg-white/5"}`}
              onClick={() => setSelected(template.id)}
            >
              <div
                className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg text-2xl ${
                  layout === "1x1" ? "aspect-[3/4]" : layout === "1x2" ? "aspect-[1/2]" : "aspect-[1/3]"
                }`}
                style={{ backgroundColor: template.color, border: `2px solid ${template.accent}` }}
              >
                <div className="absolute inset-[12%] flex flex-col gap-[3%]">
                  {Array.from({ length: FRAME_LAYOUTS.find((item) => item.id === layout)?.shots || 1 }, (_, slot) => (
                    <span key={slot} className="min-h-0 flex-1 rounded-sm bg-white/80 shadow-xs" />
                  ))}
                </div>
                <span className="relative z-10 text-base">{template.emoji}</span>
                {template.overlayImage && <ChromaImage src={template.overlayImage} alt="" className="absolute inset-0 h-full w-full object-cover z-20 pointer-events-none" />}
                {selected === template.id && <span className="absolute right-1.5 top-1.5 z-30 grid h-5 w-5 place-items-center rounded-full bg-pink-400"><Check size={11} className="text-white" /></span>}
              </div>
              <p className="w-full truncate text-center text-[11px] font-bold text-foreground/70">{template.label}</p>
            </motion.button>
          ))}
        </div>

        <motion.button
          type="button"
          className="mt-3 w-full shrink-0 rounded-xl bg-gradient-to-r from-pink-400 to-violet-500 py-3.5 text-sm font-black text-white shadow-lg shadow-pink-200/50 sm:text-base"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(selected, layout)}
        >
          Gunakan Frame {layout}
        </motion.button>
      </main>
    </motion.div>
  );
}
