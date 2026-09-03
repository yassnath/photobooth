import type { FilterPreset, FrameCategory, FrameLayout, TemplateOption } from "../../types/photobooth";
import { TEMPLATE_CATEGORIES } from "../../data/photobooth";

export interface FilterBuilder {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  grayscale: number;
  hue: number;
  blur: number;
}

export const defaultBuilder: FilterBuilder = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sepia: 0,
  grayscale: 0,
  hue: 0,
  blur: 0,
};

export const defaultFilterDraft: FilterPreset = {
  id: "custom-filter",
  label: "Custom Filter",
  css: "brightness(105%) contrast(108%) saturate(118%)",
  source: "Dashboard",
};

export const frameCategories = TEMPLATE_CATEGORIES.filter(
  (category): category is FrameCategory => category !== "All",
);

export function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
}

export function buildFilterCss(builder: FilterBuilder) {
  return [
    `brightness(${builder.brightness}%)`,
    `contrast(${builder.contrast}%)`,
    `saturate(${builder.saturation}%)`,
    builder.sepia > 0 ? `sepia(${builder.sepia / 100})` : "",
    builder.grayscale > 0 ? `grayscale(${builder.grayscale / 100})` : "",
    builder.hue !== 0 ? `hue-rotate(${builder.hue}deg)` : "",
    builder.blur > 0 ? `blur(${builder.blur}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseFilterPayload(payload: string): FilterPreset[] {
  const parsed = JSON.parse(payload) as unknown;
  const filters = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed && "filters" in parsed
      ? (parsed as { filters: unknown }).filters
      : [];

  if (!Array.isArray(filters)) return [];

  return filters
    .filter((filter): filter is FilterPreset => {
      return typeof filter === "object" && filter !== null && "label" in filter && "css" in filter;
    })
    .map((filter) => ({
      id: typeof filter.id === "string" ? filter.id : makeId("filter"),
      label: String(filter.label),
      css: String(filter.css),
      source: typeof filter.source === "string" ? filter.source : "Imported",
      createdAt: typeof filter.createdAt === "string" ? filter.createdAt : new Date().toISOString(),
    }));
}

export function parseFramePayload(payload: string): TemplateOption[] {
  const parsed = JSON.parse(payload) as unknown;
  const frames = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed && "frames" in parsed
      ? (parsed as { frames: unknown }).frames
      : [];

  if (!Array.isArray(frames)) return [];

  return frames
    .filter((frame): frame is TemplateOption => {
      return typeof frame === "object" && frame !== null && "label" in frame && "color" in frame && "accent" in frame;
    })
    .map((frame) => ({
      id: typeof frame.id === "string" ? frame.id : makeId("frame"),
      label: String(frame.label),
      category: frameCategories.includes(frame.category as FrameCategory)
        ? (frame.category as FrameCategory)
        : "Custom",
      color: String(frame.color),
      accent: String(frame.accent),
      emoji: typeof frame.emoji === "string" ? frame.emoji : "✨",
      overlayImage: typeof frame.overlayImage === "string" ? frame.overlayImage : undefined,
    }));
}

export function isToday(dateValue: string) {
  return new Date(dateValue).toDateString() === new Date().toDateString();
}

export function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

export function formatOptionalDate(dateValue?: string | null) {
  return dateValue ? formatDate(dateValue) : "-";
}

export function toTimestamp(dateValue?: string | null) {
  if (!dateValue) return 0;
  const value = new Date(dateValue).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function formatMoney(value?: number) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

export function getFrameResolutionLabel(layout?: FrameLayout | "all") {
  const resMap: Record<string, string> = {
    "1x1": "600 x 800 px (3:4)",
    "1x2": "600 x 1200 px (1:2)",
    "1x3": "600 x 1800 px (1:3)",
    "1x4": "600 x 1800 px (1:3)",
    all: "Responsif (600 x 1800)",
  };
  return resMap[layout || "all"] || "600 x 1800 px";
}
