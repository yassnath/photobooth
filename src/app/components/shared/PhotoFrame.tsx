import { FILTERS, TEMPLATES, getCaptureCount, getFilterCss } from "../../data/photobooth";
import type { CaptureMode, EditorState, FilterOption, FrameLayout, TemplateOption } from "../../types/photobooth";

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
    return (
      <div
        className={`photo-frame relative overflow-hidden rounded-2xl bg-white shadow-2xl ${stripWidth}`}
        data-shots={layoutCount}
        style={{ border: `${borderWidth}px solid ${template?.accent || "#EC4899"}` }}
      >
        {Array.from({ length: layoutCount }, (_, photoIndex) => safePhotos[photoIndex] || safePhotos[photoIndex % safePhotos.length]).map((url, photoIndex) => (
          <div key={`${url}-${photoIndex}`} className="relative">
            <img
              src={url}
              alt={`Shot ${photoIndex + 1}`}
              className="block aspect-[13/8] w-full object-cover"
              style={{ filter: filterCss }}
            />
            {editor.stickers.slice(0, 3).map((sticker, stickerIndex) => (
              <span
                key={`${sticker}-${stickerIndex}`}
                className="pointer-events-none absolute select-none text-lg sm:text-xl"
                style={stickerPosition(stickerIndex, photoIndex)}
              >
                {sticker}
              </span>
            ))}
          </div>
        ))}
        {template?.overlayImage && <img src={template.overlayImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
        <div className="bg-white px-2 py-1.5 text-center text-xs font-black text-gray-400" style={{ fontFamily: "Pacifico, cursive" }}>
          {editor.caption.trim() || `${brandName} ♡`}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`photo-frame relative overflow-hidden rounded-2xl bg-white shadow-2xl ${singleWidth}`}
      data-shots="1"
      style={{ border: `${borderWidth}px solid ${template?.accent || "#EC4899"}` }}
    >
      <div className="relative">
        <img src={safePhotos[0]} alt="Captured result" className="block aspect-[3/4] w-full object-cover" style={{ filter: filterCss }} />
        {template?.overlayImage && (
          <img src={template.overlayImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        )}
        {editor.stickers.map((sticker, stickerIndex) => (
          <span
            key={`${sticker}-${stickerIndex}`}
            className="pointer-events-none absolute select-none text-xl sm:text-2xl"
            style={stickerPosition(stickerIndex)}
          >
            {sticker}
          </span>
        ))}
      </div>
      <div className="bg-white px-2 py-1.5 text-center text-xs font-black text-gray-400" style={{ fontFamily: "Pacifico, cursive" }}>
        {editor.caption.trim() || `${brandName} ♡`}
      </div>
    </div>
  );
}
