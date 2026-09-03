import { useEffect, useState } from "react";

interface ChromaImageProps {
  src: string;
  className?: string;
  alt?: string;
}

/**
 * Renders an overlay image with chroma-key (greenscreen #00FF00) pixels
 * converted to transparent alpha in real time.
 */
export function ChromaImage({ src, className, alt = "" }: ChromaImageProps) {
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
