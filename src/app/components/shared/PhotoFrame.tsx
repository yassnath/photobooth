import { useEffect, useState } from "react";
import { FILTERS, TEMPLATES, getCaptureCount, getFilterCss } from "../../data/photobooth";
import type { CaptureMode, EditorState, FilterOption, FrameLayout, TemplateOption } from "../../types/photobooth";
import { SlotRect, defaultEqualSlots, detectGreenscreenSlotsFromCanvas, frameSlotRectToSlotRect } from "../../utils/greenscreenDetector";

type PhotoFrameVariant = "editor" | "result" | "print";

interface PhotoFrameProps {
  photos: string[];
  mode: CaptureMode;
  frameLayout?: FrameLayout;
  templateId: string;
  editor: EditorState;
  variant?: PhotoFrameVariant;
  fallbackPhoto: string;
  printFormat?: "strip" | "single";
  filters?: FilterOption[];
  frames?: TemplateOption[];
  brandName?: string;
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

function stickerPosition(index: number, photoIndex = 0) {
  return {
    left: `${(photoIndex * 19 + index * 23) % 72}%`,
    top: `${(index * 31) % 68}%`,
  };
}

export function PhotoFrame({
  photos,
  mode,
  frameLayout,
  templateId,
  editor,
  variant = "result",
  fallbackPhoto,
  printFormat,
  filters = FILTERS,
  frames = TEMPLATES,
  brandName = "PixieBooth",
}: PhotoFrameProps) {
  const template = frames.find((item) => item.id === templateId);
  const safePhotos = photos.length > 0 ? photos : [fallbackPhoto];
  const layoutCount = frameLayout ? getCaptureCount(frameLayout) : mode === "strip" ? 4 : 1;
  const showStrip = printFormat ? printFormat === "strip" : layoutCount > 1;
  const borderWidth = variant === "print" ? 3.5 : variant === "editor" ? 5 : 6;
  const filterCss = [getFilterCss(editor.filterId, filters), `brightness(${editor.adjustments.brightness}%) contrast(${editor.adjustments.contrast}%) saturate(${editor.adjustments.saturation}%)`]
    .filter(Boolean)
    .join(" ");

  const [detectedSlots, setDetectedSlots] = useState<SlotRect[]>(() => {
    if (template?.slots && template.slots.length > 0) {
      return template.slots.map(frameSlotRectToSlotRect);
    }
    return defaultEqualSlots(layoutCount);
  });

  useEffect(() => {
    if (template?.slots && template.slots.length > 0) {
      setDetectedSlots(template.slots.map(frameSlotRectToSlotRect));
      return;
    }
    if (!template?.overlayImage) {
      setDetectedSlots(defaultEqualSlots(layoutCount));
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!active) return;
      const slots = detectGreenscreenSlotsFromCanvas(img, layoutCount);
      setDetectedSlots(slots);
    };
    img.onerror = () => {
      if (active) setDetectedSlots(defaultEqualSlots(layoutCount));
    };
    img.src = template.overlayImage;
    return () => {
      active = false;
    };
  }, [template?.slots, template?.overlayImage, layoutCount]);

  const singleWidth =
    variant === "print"
      ? "w-[min(46vw,10rem)] sm:w-40 lg:w-[min(24vw,18rem)]"
      : variant === "editor"
        ? "w-[min(68vw,18rem)] sm:w-[min(48vw,21rem)] lg:w-[min(34vw,26rem)]"
        : "w-[min(72vw,17rem)] sm:w-[min(48vw,21rem)] lg:w-[min(34vw,24rem)]";
  const stripWidth = variant === "print"
    ? layoutCount >= 4
      ? "w-[min(34vw,7rem)] sm:w-28 lg:w-36"
      : "w-[min(42vw,9rem)] sm:w-32 lg:w-40"
    : layoutCount >= 4
      ? "w-[min(45vw,10rem)] sm:w-[min(30vw,11rem)] lg:w-[min(18vw,15rem)]"
      : layoutCount === 3
        ? "w-[min(52vw,12rem)] sm:w-[min(34vw,13rem)] lg:w-[min(21vw,17rem)]"
        : "w-[min(60vw,15rem)] sm:w-[min(38vw,16rem)] lg:w-[min(24vw,19rem)]";

  if (showStrip) {
    const hasCustomCaption = editor.caption.trim().length > 0;
    const hasOverlay = Boolean(template?.overlayImage);

    return (
      <div
        className={`photo-frame relative flex flex-col overflow-hidden bg-white shadow-2xl ${stripWidth}`}
        data-shots={layoutCount}
      >
        <div className={`relative flex flex-1 flex-col w-full overflow-hidden ${hasOverlay ? "aspect-[1/3]" : ""}`}>
          {hasOverlay ? (
            Array.from({ length: layoutCount }, (_, photoIndex) => safePhotos[photoIndex] || safePhotos[photoIndex % safePhotos.length]).map((url, photoIndex) => {
              const slot = detectedSlots[photoIndex] || defaultEqualSlots(layoutCount)[photoIndex];
              return (
                <div
                  key={`${url}-${photoIndex}`}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${slot.xPercent}%`,
                    top: `${slot.yPercent}%`,
                    width: `${slot.wPercent}%`,
                    height: `${slot.hPercent}%`,
                  }}
                >
                  <img
                    src={url}
                    alt={`Shot ${photoIndex + 1}`}
                    className="h-full w-full object-cover"
                    style={{ filter: filterCss }}
                  />
                  {editor.stickers.slice(0, 3).map((sticker, stickerIndex) => (
                    <span
                      key={`${sticker}-${stickerIndex}`}
                      className="pointer-events-none absolute select-none text-lg sm:text-xl z-20"
                      style={stickerPosition(stickerIndex, photoIndex)}
                    >
                      {sticker}
                    </span>
                  ))}
                </div>
              );
            })
          ) : (
            Array.from({ length: layoutCount }, (_, photoIndex) => safePhotos[photoIndex] || safePhotos[photoIndex % safePhotos.length]).map((url, photoIndex) => (
              <div key={`${url}-${photoIndex}`} className="relative w-full flex-1 min-h-0">
                <img
                  src={url}
                  alt={`Shot ${photoIndex + 1}`}
                  className="block w-full h-full object-cover"
                  style={{ filter: filterCss }}
                />
                {editor.stickers.slice(0, 3).map((sticker, stickerIndex) => (
                  <span
                    key={`${sticker}-${stickerIndex}`}
                    className="pointer-events-none absolute select-none text-lg sm:text-xl z-20"
                    style={stickerPosition(stickerIndex, photoIndex)}
                  >
                    {sticker}
                  </span>
                ))}
              </div>
            ))
          )}
          {template?.overlayImage && (
            <ChromaImage src={template.overlayImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-fill z-10" />
          )}
        </div>
        {hasCustomCaption && (
          <div className="bg-white px-2 py-1.5 text-center text-xs font-black text-gray-500 relative z-20 shrink-0" style={{ fontFamily: "Pacifico, cursive" }}>
            {editor.caption.trim()}
          </div>
        )}
      </div>
    );
  }

  const hasCustomCaptionSingle = editor.caption.trim().length > 0;

  return (
    <div
      className={`photo-frame relative flex flex-col overflow-hidden bg-white shadow-2xl ${singleWidth}`}
      data-shots="1"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <img src={safePhotos[0]} alt="Captured result" className="block h-full w-full object-cover" style={{ filter: filterCss }} />
        {template?.overlayImage && (
          <ChromaImage src={template.overlayImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-fill z-10" />
        )}
        {editor.stickers.map((sticker, stickerIndex) => (
          <span
            key={`${sticker}-${stickerIndex}`}
            className="pointer-events-none absolute select-none text-xl sm:text-2xl z-20"
            style={stickerPosition(stickerIndex)}
          >
            {sticker}
          </span>
        ))}
      </div>
      {hasCustomCaptionSingle && (
        <div className="bg-white px-2 py-1.5 text-center text-xs font-black text-gray-500 relative z-20 shrink-0" style={{ fontFamily: "Pacifico, cursive" }}>
          {editor.caption.trim()}
        </div>
      )}
    </div>
  );
}
