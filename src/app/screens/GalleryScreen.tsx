import { ArrowLeft, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { SAMPLE_PHOTOS } from "../data/photobooth";
import { pageAnimate, pageIn, pageOut, pageTransition } from "../components/shared/animations";

type GalleryTab = "all" | "photos" | "strips" | "gifs";

interface GalleryScreenProps {
  photos: string[];
  onBack: () => void;
}

export function GalleryScreen({ photos, onBack }: GalleryScreenProps) {
  const [tab, setTab] = useState<GalleryTab>("all");
  const [bigPhoto, setBigPhoto] = useState<string | null>(null);
  const allPhotos = useMemo(() => {
    const extras = Array.from({ length: 14 }, (_, index) => SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length]);
    return [...photos, ...extras].slice(0, 18);
  }, [photos]);
  const visiblePhotos = useMemo(() => {
    if (tab === "photos") {
      return photos.length > 0 ? photos : allPhotos.slice(0, 6);
    }

    if (tab === "strips") {
      return allPhotos.filter((_, index) => index % 3 !== 1);
    }

    if (tab === "gifs") {
      return allPhotos.filter((_, index) => index % 3 === 1);
    }

    return allPhotos;
  }, [allPhotos, photos, tab]);

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden"
      initial={pageIn}
      animate={pageAnimate}
      exit={pageOut}
      transition={pageTransition}
    >
      <div className="booth-bg absolute inset-0" />

      <div className="gallery-shell relative z-10 h-[100dvh]">
        <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-5 sm:px-6">
          <button
            onClick={onBack}
            className="rounded-full border border-white/60 bg-white/60 p-2.5 shadow-sm transition-transform hover:scale-110 dark:bg-white/10"
            aria-label="Back to result"
          >
            <ArrowLeft size={19} />
          </button>
          <h2 className="text-2xl font-black" style={{ fontFamily: "Pacifico, cursive" }}>
            Gallery ✨
          </h2>
          <span className="ml-auto text-xs font-bold text-muted-foreground">{visiblePhotos.length} photos</span>
        </div>

        <div className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide sm:px-6">
          {(["all", "photos", "strips", "gifs"] as GalleryTab[]).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold capitalize transition-all ${
                tab === item ? "bg-pink-400 text-white shadow-md" : "border border-white/60 bg-white/60 text-muted-foreground dark:bg-white/10"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide sm:px-6">
          <div className="columns-2 gap-2.5 space-y-2.5 min-[520px]:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6">
            {visiblePhotos.map((url, index) => (
              <motion.button
                key={`${url}-${index}`}
                className="block w-full break-inside-avoid overflow-hidden rounded-2xl border-2 border-white bg-white p-0 shadow-md transition-transform hover:scale-[1.03]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.6) }}
                onClick={() => setBigPhoto(url)}
              >
                <img
                  src={url}
                  alt={`Photo ${index + 1}`}
                  className="block w-full object-cover"
                  style={{ height: `${140 + (index % 4) * 34}px` }}
                />
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {bigPhoto && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBigPhoto(null)}
          >
            <motion.img
              src={bigPhoto}
              alt="Full size preview"
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 160 }}
              onClick={(event) => event.stopPropagation()}
            />
            <button
              className="absolute right-5 top-5 rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/35"
              onClick={() => setBigPhoto(null)}
              aria-label="Close preview"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
