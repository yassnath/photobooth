export type Screen =
  | "welcome"
  | "mode"
  | "payment"
  | "consent"
  | "template"
  | "camera"
  | "editor"
  | "result"
  | "share"
  | "gallery"
  | "print"
  | "goodbye";

export type CaptureMode = "photo" | "strip" | "gif" | "boomerang" | "live" | "video";

export type FrameLayout = "1x1" | "1x2" | "1x3" | "1x4";

export type ResultFormat = "photo" | "live" | "gif";

export type PaymentMethod = "qris" | "voucher";

export type TemplateCategory =
  | "All"
  | "Korean"
  | "Y2K"
  | "Pink"
  | "Cute"
  | "Vintage"
  | "Minimal"
  | "Seasonal"
  | "Couple"
  | "Friends"
  | "Custom";

export type EditorTab = "filters" | "stickers" | "text" | "adjust";

export type CameraStatus = "idle" | "requesting" | "ready" | "blocked" | "unsupported";

export type FacingMode = "user" | "environment";

export interface ModeOption {
  id: CaptureMode;
  label: string;
  emoji: string;
  description: string;
  gradient: string;
}

export interface TemplateOption {
  id: string;
  label: string;
  category: Exclude<TemplateCategory, "All">;
  color: string;
  accent: string;
  emoji: string;
  overlayImage?: string;
}

export interface FilterOption {
  id: string;
  label: string;
  css: string;
}

export interface FilterPreset extends FilterOption {
  source?: string;
  createdAt?: string;
}

export interface PhotoAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface EditorState {
  filterId: string;
  stickers: string[];
  caption: string;
  adjustments: PhotoAdjustments;
}

export interface CameraDevice {
  deviceId: string;
  groupId: string;
  label: string;
}

export interface BoothBackgroundPreset {
  id: string;
  label: string;
  start: string;
  middle: string;
  end: string;
}

export interface BoothThemeSettings {
  brandName: string;
  tagline: string;
  logoEmoji: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundPresetId: string;
  background: BoothBackgroundPreset;
}

export interface AdminSession {
  id: string;
  username: string;
  displayName: string;
  loggedInAt?: string;
  expiresAt?: string;
}

export interface PaymentRecord {
  id: string;
  orderId?: string;
  provider?: "mock" | "midtrans" | "voucher" | string;
  status?: "pending" | "paid" | "expired" | "failed";
  method: PaymentMethod;
  amount: number;
  baseAmount?: number;
  discountAmount?: number;
  paidAt?: string;
  expiresAt?: string;
  voucherCode?: string;
}

export interface Voucher {
  id: string;
  code: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface BoothMonitor {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: string | null;
  version?: string | null;
  status: {
    platform?: string;
    printer?: { available?: boolean; name?: string; error?: string };
    queueLength?: number;
    kioskScreen?: string;
    uptimeSeconds?: number;
    [key: string]: unknown;
  };
}

export interface BoothRuntimeConfig {
  theme: BoothThemeSettings | null;
  filters: FilterPreset[] | null;
  frames: TemplateOption[] | null;
  sessionPrice: number;
  paymentProvider: string;
  resultRetentionHours: number;
}

export interface ConsentSettings {
  captureAccepted: boolean;
  privacyAccepted: boolean;
  gallerySharingAllowed: boolean;
  acceptedAt: string;
}

export interface PhotoSession {
  id: string;
  createdAt: string;
  mode: CaptureMode;
  templateId: string;
  frameLayout?: FrameLayout;
  resultFormat?: ResultFormat;
  payment?: PaymentRecord;
  consent?: ConsentSettings;
  photos: string[];
  editor: EditorState;
}
