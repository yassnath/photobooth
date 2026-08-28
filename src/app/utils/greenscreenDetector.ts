import type { FrameSlotRect } from "../types/photobooth";

export interface SlotRect {
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  wPercent: number; // 0 to 100
  hPercent: number; // 0 to 100
}

export function slotRectToFrameSlotRect(rect: SlotRect): FrameSlotRect {
  return {
    x: Math.round(rect.xPercent * 100) / 100,
    y: Math.round(rect.yPercent * 100) / 100,
    w: Math.round(rect.wPercent * 100) / 100,
    h: Math.round(rect.hPercent * 100) / 100,
  };
}

export function frameSlotRectToSlotRect(rect: FrameSlotRect): SlotRect {
  return {
    xPercent: rect.x,
    yPercent: rect.y,
    wPercent: rect.w,
    hPercent: rect.h,
  };
}

export function defaultEqualSlots(count: number): SlotRect[] {
  const slots: SlotRect[] = [];
  const hPercent = 100 / (count || 1);
  for (let i = 0; i < (count || 1); i++) {
    slots.push({
      xPercent: 0,
      yPercent: i * hPercent,
      wPercent: 100,
      hPercent,
    });
  }
  return slots;
}

export function detectGreenscreenSlotsFromCanvas(
  img: HTMLImageElement,
  expectedShots: number
): SlotRect[] {
  const width = img.naturalWidth || img.width || 600;
  const height = img.naturalHeight || img.height || 1800;
  if (!width || !height) return defaultEqualSlots(expectedShots);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return defaultEqualSlots(expectedShots);

  try {
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const rowHasGreen = new Array(height).fill(false);
    const rowMinX = new Array(height).fill(width);
    const rowMaxX = new Array(height).fill(-1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Green detection: High green channel relative to red/blue
        // OR transparent cutout windows INSIDE the frame boundary (not outer margins)
        const isChromaGreen = g > 50 && g > r * 1.12 && g > b * 1.12 && a > 30;
        const isTransparentCutout = a < 30 && x > width * 0.03 && x < width * 0.97 && y > height * 0.02 && y < height * 0.98;

        if (isChromaGreen || isTransparentCutout) {
          rowHasGreen[y] = true;
          if (x < rowMinX[y]) rowMinX[y] = x;
          if (x > rowMaxX[y]) rowMaxX[y] = x;
        }
      }
    }

    const rawBands: Array<{ startY: number; endY: number; minX: number; maxX: number }> = [];
    let inBand = false;
    let startY = 0;
    let bandMinX = width;
    let bandMaxX = -1;

    for (let y = 0; y < height; y++) {
      if (rowHasGreen[y]) {
        if (!inBand) {
          inBand = true;
          startY = y;
          bandMinX = rowMinX[y];
          bandMaxX = rowMaxX[y];
        } else {
          if (rowMinX[y] < bandMinX) bandMinX = rowMinX[y];
          if (rowMaxX[y] > bandMaxX) bandMaxX = rowMaxX[y];
        }
      } else {
        if (inBand) {
          if (y - startY > height * 0.015) {
            rawBands.push({ startY, endY: y - 1, minX: bandMinX, maxX: bandMaxX });
          }
          inBand = false;
        }
      }
    }
    if (inBand && height - startY > height * 0.015) {
      rawBands.push({ startY, endY: height - 1, minX: bandMinX, maxX: bandMaxX });
    }

    // Merge adjacent bands that have very small gaps (< 2% height)
    const bands: Array<{ startY: number; endY: number; minX: number; maxX: number }> = [];
    for (const b of rawBands) {
      if (bands.length === 0) {
        bands.push({ ...b });
      } else {
        const last = bands[bands.length - 1];
        if (b.startY - last.endY < height * 0.02) {
          last.endY = b.endY;
          last.minX = Math.min(last.minX, b.minX);
          last.maxX = Math.max(last.maxX, b.maxX);
        } else {
          bands.push({ ...b });
        }
      }
    }

    if (bands.length === expectedShots) {
      return bands.map((b) => ({
        xPercent: Math.round(((b.minX / width) * 100) * 100) / 100,
        yPercent: Math.round(((b.startY / height) * 100) * 100) / 100,
        wPercent: Math.round((((b.maxX - b.minX + 1) / width) * 100) * 100) / 100,
        hPercent: Math.round((((b.endY - b.startY + 1) / height) * 100) * 100) / 100,
      }));
    }

    if (bands.length === 1 && expectedShots > 1) {
      const b = bands[0];
      const totalH = b.endY - b.startY + 1;
      const slotH = totalH / expectedShots;
      const slots: SlotRect[] = [];
      for (let i = 0; i < expectedShots; i++) {
        slots.push({
          xPercent: Math.round(((b.minX / width) * 100) * 100) / 100,
          yPercent: Math.round((((b.startY + i * slotH) / height) * 100) * 100) / 100,
          wPercent: Math.round((((b.maxX - b.minX + 1) / width) * 100) * 100) / 100,
          hPercent: Math.round(((slotH / height) * 100) * 100) / 100,
        });
      }
      return slots;
    }

    if (bands.length > 0) {
      return bands.slice(0, expectedShots).map((b) => ({
        xPercent: Math.round(((b.minX / width) * 100) * 100) / 100,
        yPercent: Math.round(((b.startY / height) * 100) * 100) / 100,
        wPercent: Math.round((((b.maxX - b.minX + 1) / width) * 100) * 100) / 100,
        hPercent: Math.round((((b.endY - b.startY + 1) / height) * 100) * 100) / 100,
      }));
    }
  } catch {
    // Fall back to default equal slots on error
  }

  return defaultEqualSlots(expectedShots);
}
