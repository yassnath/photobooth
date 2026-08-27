import type {
  BoothBackgroundPreset,
  BoothThemeSettings,
  CaptureMode,
  EditorState,
  FilterOption,
  FilterPreset,
  FrameLayout,
  ModeOption,
  Screen,
  TemplateCategory,
  TemplateOption,
} from "../types/photobooth";

interface SamplePortraitOptions {
  background: [string, string, string];
  hair: string;
  skin: string;
  shirt: string;
  accent: string;
  blush: string;
}

function createSamplePhoto({ background, hair, skin, shirt, accent, blush }: SamplePortraitOptions) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${background[0]}" />
          <stop offset="52%" stop-color="${background[1]}" />
          <stop offset="100%" stop-color="${background[2]}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="32%" r="55%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#4c1d95" flood-opacity="0.16" />
        </filter>
      </defs>
      <rect width="800" height="1000" fill="url(#bg)" />
      <rect width="800" height="1000" fill="url(#glow)" />
      <circle cx="122" cy="156" r="68" fill="#ffffff" opacity="0.26" />
      <circle cx="682" cy="206" r="92" fill="#ffffff" opacity="0.22" />
      <circle cx="654" cy="806" r="120" fill="#ffffff" opacity="0.2" />
      <path d="M178 850 C246 724 305 672 400 672 C496 672 556 724 622 850 L178 850 Z" fill="${shirt}" filter="url(#shadow)" />
      <path d="M290 378 C292 260 348 186 405 186 C474 186 528 258 520 386 C620 430 596 640 492 700 C454 722 348 722 309 696 C206 626 195 426 290 378 Z" fill="${hair}" filter="url(#shadow)" />
      <circle cx="400" cy="438" r="154" fill="${skin}" />
      <path d="M274 422 C290 286 342 232 412 240 C470 247 510 288 530 406 C482 348 426 330 354 348 C322 356 296 382 274 422 Z" fill="${hair}" opacity="0.95" />
      <circle cx="340" cy="446" r="12" fill="#2f1728" />
      <circle cx="460" cy="446" r="12" fill="#2f1728" />
      <circle cx="318" cy="486" r="22" fill="${blush}" opacity="0.42" />
      <circle cx="482" cy="486" r="22" fill="${blush}" opacity="0.42" />
      <path d="M358 530 C384 552 421 552 448 530" fill="none" stroke="#7c2d45" stroke-linecap="round" stroke-width="12" />
      <path d="M320 380 C342 364 364 364 382 380" fill="none" stroke="#2f1728" stroke-linecap="round" stroke-width="10" opacity="0.42" />
      <path d="M420 380 C442 364 466 365 484 382" fill="none" stroke="#2f1728" stroke-linecap="round" stroke-width="10" opacity="0.42" />
      <circle cx="268" cy="566" r="34" fill="${accent}" opacity="0.86" />
      <circle cx="532" cy="566" r="34" fill="${accent}" opacity="0.86" />
      <path d="M240 326 C276 184 390 142 496 216" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-width="20" opacity="0.28" />
      <path d="M198 760 C274 810 520 810 604 760" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-width="18" opacity="0.45" />
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const SAMPLE_PHOTOS = [
  createSamplePhoto({
    background: ["#FCE7F3", "#FDF2F8", "#EDE9FE"],
    hair: "#3B1D2E",
    skin: "#F5C8A8",
    shirt: "#EC4899",
    accent: "#FB7185",
    blush: "#F472B6",
  }),
  createSamplePhoto({
    background: ["#E0F2FE", "#F0FDFA", "#FEF3C7"],
    hair: "#171717",
    skin: "#E9B98E",
    shirt: "#06B6D4",
    accent: "#38BDF8",
    blush: "#FB7185",
  }),
  createSamplePhoto({
    background: ["#FDE68A", "#FFE4E6", "#F5D0FE"],
    hair: "#6B3F2A",
    skin: "#FFD7B5",
    shirt: "#F59E0B",
    accent: "#F97316",
    blush: "#FDA4AF",
  }),
  createSamplePhoto({
    background: ["#DCFCE7", "#ECFDF5", "#CCFBF1"],
    hair: "#262626",
    skin: "#D8A47F",
    shirt: "#10B981",
    accent: "#34D399",
    blush: "#F9A8D4",
  }),
  createSamplePhoto({
    background: ["#EDE9FE", "#FAE8FF", "#FCE7F3"],
    hair: "#4C1D95",
    skin: "#F0BE9C",
    shirt: "#8B5CF6",
    accent: "#A78BFA",
    blush: "#F0ABFC",
  }),
  createSamplePhoto({
    background: ["#FFE4E6", "#FFF7ED", "#FFEDD5"],
    hair: "#5C2E1F",
    skin: "#C98B62",
    shirt: "#FB7185",
    accent: "#FDBA74",
    blush: "#FDA4AF",
  }),
  createSamplePhoto({
    background: ["#F1F5F9", "#E0E7FF", "#DBEAFE"],
    hair: "#111827",
    skin: "#F7C59F",
    shirt: "#2563EB",
    accent: "#60A5FA",
    blush: "#F9A8D4",
  }),
  createSamplePhoto({
    background: ["#FEF9C3", "#FDF2F8", "#FCE7F3"],
    hair: "#7C2D12",
    skin: "#F3BA8B",
    shirt: "#E11D48",
    accent: "#F43F5E",
    blush: "#FB7185",
  }),
] as const;

export const FLOAT_EMOJIS = [
  "♡",
  "✨",
  "⭐",
  "🌸",
  "💕",
  "🎀",
  "🌷",
  "💫",
  "🍬",
  "🦋",
  "🎊",
  "🌺",
  "🌙",
  "🦄",
  "🍓",
] as const;

export const MODES: ModeOption[] = [
  { id: "photo", label: "Photo", emoji: "📸", description: "One perfect shot", gradient: "from-pink-200 to-rose-300" },
  { id: "strip", label: "Photo Strip", emoji: "🎞️", description: "4 cute poses", gradient: "from-violet-200 to-purple-300" },
  { id: "gif", label: "GIF", emoji: "🎭", description: "Animated expression", gradient: "from-sky-200 to-blue-300" },
  { id: "boomerang", label: "Boomerang", emoji: "🔄", description: "Loop it back & forth", gradient: "from-yellow-200 to-amber-300" },
  { id: "live", label: "Live Photo", emoji: "✨", description: "Moving memories", gradient: "from-emerald-200 to-teal-300" },
  { id: "video", label: "Video", emoji: "🎬", description: "Full video clip", gradient: "from-red-200 to-orange-300" },
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "All",
  "Korean",
  "Y2K",
  "Pink",
  "Cute",
  "Vintage",
  "Minimal",
  "Seasonal",
  "Couple",
  "Friends",
  "Custom",
];

export const TEMPLATES: TemplateOption[] = [
  { id: "han-river", label: "Han River", category: "Korean", color: "#FEC8D8", accent: "#FF6BA8", emoji: "🌸" },
  { id: "seoul-cafe", label: "Seoul Cafe", category: "Korean", color: "#FDE8CE", accent: "#D97706", emoji: "☕" },
  { id: "y2k-chrome", label: "Y2K Chrome", category: "Y2K", color: "#C8B4FA", accent: "#9333EA", emoji: "💿" },
  { id: "butterfly", label: "Butterfly", category: "Y2K", color: "#BAE6FD", accent: "#0284C7", emoji: "🦋" },
  { id: "bubblegum", label: "Bubblegum", category: "Pink", color: "#FCE7F3", accent: "#EC4899", emoji: "🩷" },
  { id: "rose-garden", label: "Rose Garden", category: "Pink", color: "#FFC8DC", accent: "#E11D48", emoji: "🌹" },
  { id: "pastel-dream", label: "Pastel Dream", category: "Cute", color: "#FEF3C7", accent: "#F59E0B", emoji: "🐣" },
  { id: "cloud-nine", label: "Cloud Nine", category: "Cute", color: "#E0F2FE", accent: "#0369A1", emoji: "☁️" },
  { id: "film-grain", label: "Film Grain", category: "Vintage", color: "#FDE8CE", accent: "#D97706", emoji: "📷" },
  { id: "polaroid", label: "Polaroid", category: "Vintage", color: "#F3F4F6", accent: "#6B7280", emoji: "🖼️" },
  { id: "clean-white", label: "Clean White", category: "Minimal", color: "#F9FAFB", accent: "#374151", emoji: "⬜" },
  { id: "sakura", label: "Sakura", category: "Seasonal", color: "#FFF1F2", accent: "#FB7185", emoji: "🌸" },
  { id: "forever", label: "Forever", category: "Couple", color: "#FEE2E2", accent: "#DC2626", emoji: "💑" },
  { id: "besties", label: "Besties", category: "Friends", color: "#EDE9FE", accent: "#7C3AED", emoji: "👯" },
];

export const BACKGROUND_PRESETS: BoothBackgroundPreset[] = [
  { id: "pixie", label: "Pixie Pink", start: "#FEF0F9", middle: "#FDF4FF", end: "#F5E8FF" },
  { id: "sakura", label: "Sakura Glow", start: "#FFF1F2", middle: "#FFE4E6", end: "#FCE7F3" },
  { id: "seoul", label: "Seoul Cafe", start: "#FFF7ED", middle: "#FDE8CE", end: "#FAE8FF" },
  { id: "sky", label: "Soft Sky", start: "#E0F2FE", middle: "#F0FDFA", end: "#F5F3FF" },
  { id: "midnight", label: "Midnight Booth", start: "#13051E", middle: "#2D0A47", end: "#07111F" },
];

export const DEFAULT_UI_THEME: BoothThemeSettings = {
  brandName: "PixieBooth",
  tagline: "Korean ✦ Japanese ✦ Y2K ✦ Kawaii photobooth",
  logoEmoji: "📸",
  primaryColor: "#EC4899",
  secondaryColor: "#8B5CF6",
  backgroundPresetId: "pixie",
  background: BACKGROUND_PRESETS[0],
};

export const FILTERS: FilterPreset[] = [
  { id: "none", label: "Original", css: "" },
  { id: "rose", label: "Rose", css: "sepia(0.2) saturate(1.6) hue-rotate(300deg) brightness(1.05)" },
  { id: "vintage", label: "Vintage", css: "sepia(0.5) contrast(1.1) brightness(0.92)" },
  { id: "vivid", label: "Vivid", css: "saturate(1.8) contrast(1.08)" },
  { id: "dreamy", label: "Dreamy", css: "brightness(1.12) saturate(0.85) contrast(0.94)" },
  { id: "bw", label: "B&W", css: "grayscale(1) contrast(1.12)" },
  { id: "cool", label: "Cool", css: "saturate(1.2) hue-rotate(22deg) brightness(1.04)" },
  { id: "warm", label: "Warm", css: "sepia(0.18) saturate(1.4) brightness(1.06)" },
];

export const STICKERS = [
  "🌸",
  "💕",
  "✨",
  "⭐",
  "🦋",
  "🎀",
  "🌈",
  "💫",
  "🍓",
  "🌷",
  "🎊",
  "💖",
  "🌺",
  "🍬",
  "🎠",
  "🪄",
  "🫧",
  "🌙",
  "☁️",
  "🦄",
  "🌟",
  "💗",
  "🏵️",
  "🎪",
  "🍭",
  "🎈",
  "🌻",
  "💎",
  "🎯",
  "🔮",
] as const;

export const PAGE_STEPS: Screen[] = ["welcome", "mode", "payment", "consent", "template", "camera", "editor", "result"];

export const FRAME_LAYOUTS: Array<{ id: FrameLayout; label: string; shots: number; description: string }> = [
  { id: "1x1", label: "1 x 1", shots: 1, description: "Satu foto utama" },
  { id: "1x2", label: "1 x 2", shots: 2, description: "Dua pose vertikal" },
  { id: "1x3", label: "1 x 3", shots: 3, description: "Tiga pose vertikal" },
  { id: "1x4", label: "1 x 4", shots: 4, description: "Empat pose klasik" },
];

export const SESSION_DURATION_MS = 6 * 60 * 1000;

export const DEFAULT_EDITOR_STATE: EditorState = {
  filterId: "none",
  stickers: [],
  caption: "",
  adjustments: {
    brightness: 100,
    contrast: 100,
    saturation: 100,
  },
};

export function getCaptureCount(layout: FrameLayout): number {
  return FRAME_LAYOUTS.find((item) => item.id === layout)?.shots || 1;
}

export function getFilterCss(filterId: string, filters: FilterOption[] = FILTERS): string {
  return filters.find((filter) => filter.id === filterId)?.css || "";
}
