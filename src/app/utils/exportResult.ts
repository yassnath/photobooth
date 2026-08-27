import { GIFEncoder, applyPalette, quantize } from "gifenc";

import { getCaptureCount, getFilterCss } from "../data/photobooth";
import type { EditorState, FilterOption, FrameLayout, TemplateOption } from "../types/photobooth";

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

async function createPhotoCanvas(options: ResultExportOptions) {
  const { photos, frameLayout, template, editor, filters, brandName } = options;
  const shotCount = getCaptureCount(frameLayout);
  const width = 720;
  const padding = 30;
  const gap = 12;
  const captionHeight = 76;
  const photoWidth = width - padding * 2;
  const photoHeight = shotCount === 1 ? 820 : Math.round(photoWidth * 8 / 13);
  const height = padding + shotCount * photoHeight + (shotCount - 1) * gap + captionHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas tidak tersedia.");

  context.fillStyle = template?.color || "#FFFFFF";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = template?.accent || "#EC4899";
  context.lineWidth = 12;
  context.strokeRect(6, 6, width - 12, height - 12);

  const safePhotos = photos.length > 0 ? photos : [];
  const images = await Promise.all(Array.from({ length: shotCount }, (_, index) => loadImage(safePhotos[index] || safePhotos[index % safePhotos.length])));
  context.filter = createFilter(editor, filters) || "none";
  images.forEach((image, index) => drawCover(context, image, padding, padding + index * (photoHeight + gap), photoWidth, photoHeight));
  context.filter = "none";

  if (template?.overlayImage) {
    const overlay = await loadImage(template.overlayImage);
    context.drawImage(overlay, 0, 0, width, height);
  }

  context.fillStyle = template?.accent || "#6B21A8";
  context.textAlign = "center";
  context.font = "700 24px Nunito, sans-serif";
  context.fillText(editor.caption.trim() || `${brandName} memories`, width / 2, height - 30);
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
  context.fillStyle = options.template?.accent || "#6B21A8";
  context.textAlign = "center";
  context.font = "700 18px Nunito, sans-serif";
  context.fillText(options.editor.caption.trim() || options.brandName, canvas.width / 2, canvas.height - 25);
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

export async function createGifResultBlob(options: ResultExportOptions) {
  const { canvas, context, images } = await createMotionCanvas(options);
  if (images.length === 0) throw new Error("Belum ada foto untuk diekspor.");
  const gif = GIFEncoder();
  const frames = images.length > 1 ? images : Array.from({ length: 5 }, () => images[0]);

  frames.forEach((image, index) => {
    drawMotionFrame(context, canvas, image, options, frames.length === 1 ? 0 : index / (frames.length - 1));
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const palette = quantize(rgba, 128);
    const indexed = applyPalette(rgba, palette);
    gif.writeFrame(indexed, canvas.width, canvas.height, { palette, delay: 420, repeat: 0 });
  });

  gif.finish();
  const bytes = Uint8Array.from(gif.bytes());
  return new Blob([bytes.buffer], { type: "image/gif" });
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
