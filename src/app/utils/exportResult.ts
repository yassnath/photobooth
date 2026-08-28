import { GIFEncoder, applyPalette, quantize } from "gifenc";

import { getCaptureCount, getFilterCss } from "../data/photobooth";
import type { EditorState, FilterOption, FrameLayout, TemplateOption } from "../types/photobooth";
import { SlotRect, defaultEqualSlots, detectGreenscreenSlotsFromCanvas, frameSlotRectToSlotRect } from "./greenscreenDetector";

interface ResultExportOptions {
  photos: string[];
  frameLayout: FrameLayout;
  template?: TemplateOption;
  editor: EditorState;
  filters: FilterOption[];
  brandName: string;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gambar hasil tidak dapat diproses."));
    image.src = source;
  });
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, zoom = 1) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = sourceHeight * targetRatio;
  } else {
    sourceHeight = sourceWidth / targetRatio;
  }

  sourceWidth /= zoom;
  sourceHeight /= zoom;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function createFilter(editor: EditorState, filters: FilterOption[]) {
  return [
    getFilterCss(editor.filterId, filters),
    `brightness(${editor.adjustments.brightness}%) contrast(${editor.adjustments.contrast}%) saturate(${editor.adjustments.saturation}%)`,
  ].filter(Boolean).join(" ");
}

/**
 * Processes an overlay frame image and converts greenscreen pixels (#00FF00 / chroma green)
 * into transparent pixels so photos underneath are cleanly visible through the frame cutouts.
 */
function processChromaKey(overlayImage: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return offscreen;

  ctx.drawImage(overlayImage, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Greenscreen detection threshold (Dominant Green Channel)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (g > 65 && g > r * 1.15 && g > b * 1.15) {
      data[i + 3] = 0; // Alpha = 0 (Transparent)
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return offscreen;
}

/** Ensure caption fonts are loaded before drawing on canvas to avoid fallback font rendering. */
async function ensureFontsLoaded() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.load("700 20px Nunito");
    await document.fonts.load("700 18px Nunito");
  } catch {
    // Silently proceed — caption will use system font fallback
  }
}

async function createPhotoCanvas(options: ResultExportOptions) {
  const { photos, frameLayout, template, editor, filters, brandName } = options;
  const shotCount = getCaptureCount(frameLayout);

  let width = 600;
  let height = 1800; // Default 5cm x 15cm (1:3 ratio) for 1x3 & 1x4

  if (frameLayout === "1x1") {
    width = 600;
    height = 800; // 3cm x 4cm (3:4 ratio)
  } else if (frameLayout === "1x2") {
    width = 600;
    height = 1200; // 5cm x 10cm (1:2 ratio)
  }

  const hasOverlay = Boolean(template?.overlayImage);
  const hasCaption = Boolean(editor.caption.trim());
  const captionHeight = hasCaption ? 56 : 0;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas tidak tersedia.");

  context.fillStyle = template?.color || "#FFFFFF";
  context.fillRect(0, 0, width, height);

  const safePhotos = photos.length > 0 ? photos : [];
  const images = await Promise.all(Array.from({ length: shotCount }, (_, index) => loadImage(safePhotos[index] || safePhotos[index % safePhotos.length])));

  if (hasOverlay && template?.overlayImage) {
    const overlay = await loadImage(template.overlayImage);
    const slots = template?.slots && template.slots.length > 0
      ? template.slots.map(frameSlotRectToSlotRect)
      : detectGreenscreenSlotsFromCanvas(overlay, shotCount);

    context.filter = createFilter(editor, filters) || "none";
    images.forEach((image, index) => {
      const slot = slots[index] || defaultEqualSlots(shotCount)[index];
      const slotX = Math.round((slot.xPercent / 100) * width);
      const slotY = Math.round((slot.yPercent / 100) * height);
      const slotW = Math.round((slot.wPercent / 100) * width);
      const slotH = Math.round((slot.hPercent / 100) * height);
      drawCover(context, image, slotX, slotY, slotW, slotH);
    });
    context.filter = "none";

    if (template.chromaKeyGreen !== false) {
      const keyedOverlayCanvas = processChromaKey(overlay, width, height);
      context.drawImage(keyedOverlayCanvas, 0, 0);
    } else {
      context.drawImage(overlay, 0, 0, width, height);
    }
  } else {
    const padding = 24;
    const gap = frameLayout === "1x4" ? 10 : 14;
    const photoWidth = width - padding * 2;
    const availablePhotoHeight = height - padding * 2 - (shotCount - 1) * gap - captionHeight;
    const photoHeight = Math.floor(availablePhotoHeight / shotCount);

    context.filter = createFilter(editor, filters) || "none";
    images.forEach((image, index) => drawCover(context, image, padding, padding + index * (photoHeight + gap), photoWidth, photoHeight));
    context.filter = "none";
  }

  // Draw custom caption ONLY if user provided one (omit default brand text)
  if (hasCaption) {
    await ensureFontsLoaded();
    context.fillStyle = template?.accent || "#6B21A8";
    context.textAlign = "center";
    context.font = "700 20px Nunito, sans-serif";
    context.fillText(editor.caption.trim(), width / 2, height - 22);
  }
  return canvas;
}

async function createMotionCanvas(options: ResultExportOptions) {
  const width = 480;
  const height = 640;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas tidak tersedia.");
  const images = await Promise.all(options.photos.map(loadImage));
  return { canvas, context, images };
}

function drawMotionFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: ResultExportOptions,
  progress: number,
) {
  context.filter = "none";
  context.fillStyle = options.template?.color || "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = createFilter(options.editor, options.filters) || "none";
  drawCover(context, image, 18, 18, canvas.width - 36, canvas.height - 72, 1 + progress * 0.035);
  context.filter = "none";
  if (options.editor.caption.trim()) {
    context.fillStyle = options.template?.accent || "#6B21A8";
    context.textAlign = "center";
    context.font = "700 18px Nunito, sans-serif";
    context.fillText(options.editor.caption.trim(), canvas.width / 2, canvas.height - 25);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createPhotoResultBlob(options: ResultExportOptions) {
  const canvas = await createPhotoCanvas(options);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Foto gagal dibuat.");
  return blob;
}

export async function downloadPhotoResult(options: ResultExportOptions) {
  const blob = await createPhotoResultBlob(options);
  downloadBlob(blob, `pixiebooth-${Date.now()}.jpg`);
}

/**
 * Encode GIF frames in a Web Worker to avoid blocking the main thread.
 * Falls back to synchronous main-thread encoding if Worker fails to start.
 */
async function encodeGifInWorker(
  frameData: Uint8ClampedArray[],
  width: number,
  height: number,
  delay: number,
): Promise<Uint8Array> {
  try {
    const worker = new Worker(
      new URL("../workers/gifEncoder.worker.ts", import.meta.url),
      { type: "module" },
    );

    return await new Promise<Uint8Array>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<{ bytes?: Uint8Array; error?: string }>) => {
        worker.terminate();
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else if (event.data.bytes) {
          resolve(event.data.bytes);
        } else {
          reject(new Error("GIF worker mengembalikan hasil kosong."));
        }
      };
      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message || "GIF worker error."));
      };

      // Transfer buffers for zero-copy transfer to worker
      const transferList = frameData.map((d) => d.buffer as ArrayBuffer);
      worker.postMessage({ frames: frameData, width, height, delay }, transferList);
    });
  } catch {
    // Fallback: encode on main thread if Worker fails to instantiate
    const gif = GIFEncoder();
    for (const rgba of frameData) {
      const palette = quantize(rgba, 128);
      const indexed = applyPalette(rgba, palette);
      gif.writeFrame(indexed, width, height, { palette, delay, repeat: 0 });
    }
    gif.finish();
    return Uint8Array.from(gif.bytes());
  }
}

export async function createGifResultBlob(options: ResultExportOptions) {
  const { canvas, context, images } = await createMotionCanvas(options);
  if (images.length === 0) throw new Error("Belum ada foto untuk diekspor.");

  await ensureFontsLoaded();

  const frames = images.length > 1 ? images : Array.from({ length: 5 }, () => images[0]);

  // Extract RGBA pixel data on main thread (canvas.getImageData must run here)
  const frameData: Uint8ClampedArray[] = frames.map((image, index) => {
    drawMotionFrame(context, canvas, image, options, frames.length === 1 ? 0 : index / (frames.length - 1));
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  });

  // Offload heavy quantize + palette + encode to Web Worker
  const bytes = await encodeGifInWorker(frameData, canvas.width, canvas.height, 420);
  return new Blob([bytes.slice()], { type: "image/gif" });
}

export async function downloadGifResult(options: ResultExportOptions) {
  const blob = await createGifResultBlob(options);
  downloadBlob(blob, `pixiebooth-${Date.now()}.gif`);
}

export async function createLiveResultBlob(options: ResultExportOptions) {
  const { canvas, context, images } = await createMotionCanvas(options);
  if (images.length === 0) throw new Error("Belum ada foto untuk diekspor.");
  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    return createGifResultBlob(options);
  }

  await ensureFontsLoaded();

  const stream = canvas.captureStream(20);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  const frames = images.length > 1 ? images : Array.from({ length: 12 }, () => images[0]);
  for (let index = 0; index < frames.length; index += 1) {
    drawMotionFrame(context, canvas, frames[index], options, frames.length === 1 ? 0 : index / (frames.length - 1));
    await new Promise((resolve) => window.setTimeout(resolve, images.length > 1 ? 420 : 90));
  }
  recorder.stop();
  const blob = await finished;
  stream.getTracks().forEach((track) => track.stop());
  return blob;
}

export async function downloadLiveResult(options: ResultExportOptions) {
  const blob = await createLiveResultBlob(options);
  const extension = blob.type === "image/gif" ? "gif" : "webm";
  downloadBlob(blob, `pixiebooth-live-${Date.now()}.${extension}`);
}
