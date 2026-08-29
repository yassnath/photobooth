import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calendar, Download, Image, LogOut, MonitorCog, Palette, Pencil, Plus, Power, RefreshCcw, ShieldCheck, Sliders, TicketPercent, Trash2, Upload, Wand2, Wifi, WifiOff, X, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BACKGROUND_PRESETS, DEFAULT_UI_THEME, FILTERS, SAMPLE_PHOTOS, TEMPLATE_CATEGORIES, TEMPLATES, getCaptureCount } from "../data/photobooth";
import type { BoothMonitor, BoothThemeSettings, FilterPreset, FrameLayout, FrameSlotRect, PhotoSession, TemplateCategory, TemplateOption, Voucher } from "../types/photobooth";
import { CustomSelect } from "../components/shared/CustomSelect";
import { CustomDateTimePicker } from "../components/shared/CustomDateTimePicker";
import { defaultEqualSlots, detectGreenscreenSlotsFromCanvas, slotRectToFrameSlotRect } from "../utils/greenscreenDetector";

type DashboardTab = "overview" | "theme" | "gallery" | "vouchers" | "filters" | "frames" | "monitoring";
type TimeRangeOption = "7d" | "14d" | "30d" | "monthly" | "all";
type FrameCategory = Exclude<TemplateCategory, "All">;

interface FilterBuilder {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  grayscale: number;
  hue: number;
  blur: number;
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

interface DashboardScreenProps {
  adminName: string;
  uiTheme: BoothThemeSettings;
  filters: FilterPreset[];
  frames: TemplateOption[];
  sessions: PhotoSession[];
  vouchers: Voucher[];
  booths: BoothMonitor[];
  sessionPrice: number;
  showLoginSuccess?: boolean;
  onCloseLoginSuccess?: () => void;
  onBack: () => void;
  onLogout: () => void;
  onClearSessions: () => void;
  onUpdateTheme: Dispatch<SetStateAction<BoothThemeSettings>>;
  onUpdateFilters: Dispatch<SetStateAction<FilterPreset[]>>;
  onUpdateFrames: Dispatch<SetStateAction<TemplateOption[]>>;
  onCreateVoucher: (voucher: {
    code: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    maxUses: number | null;
    startsAt: string | null;
    expiresAt: string | null;
  }) => Promise<void>;
  onUpdateVoucher: (id: string, patch: {
    discountType?: "fixed" | "percent";
    discountValue?: number;
    maxUses?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    active?: boolean;
  }) => Promise<void>;
  onToggleVoucher: (id: string, active: boolean) => Promise<void>;
  onDeleteVoucher: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const dashboardTabs: Array<{ id: DashboardTab; label: string; icon: JSX.Element }> = [
  { id: "overview", label: "Overview", icon: <Palette size={16} /> },
  { id: "theme", label: "Theme", icon: <Wand2 size={16} /> },
  { id: "gallery", label: "Photos", icon: <Image size={16} /> },
  { id: "vouchers", label: "Vouchers", icon: <TicketPercent size={16} /> },
  { id: "filters", label: "Filters", icon: <Sliders size={16} /> },
  { id: "frames", label: "Frames", icon: <Upload size={16} /> },
  { id: "monitoring", label: "Booths", icon: <MonitorCog size={16} /> },
];

const defaultBuilder: FilterBuilder = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sepia: 0,
  grayscale: 0,
  hue: 0,
  blur: 0,
};

const defaultFilterDraft: FilterPreset = {
  id: "custom-filter",
  label: "Custom Filter",
  css: "brightness(105%) contrast(108%) saturate(118%)",
  source: "Dashboard",
};

const frameCategories = TEMPLATE_CATEGORIES.filter((category): category is FrameCategory => category !== "All");

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
}

function buildFilterCss(builder: FilterBuilder) {
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

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseFilterPayload(payload: string): FilterPreset[] {
  const parsed = JSON.parse(payload) as unknown;
  const filters = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed && "filters" in parsed ? (parsed as { filters: unknown }).filters : [];

  if (!Array.isArray(filters)) {
    return [];
  }

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

function parseFramePayload(payload: string): TemplateOption[] {
  const parsed = JSON.parse(payload) as unknown;
  const frames = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed && "frames" in parsed ? (parsed as { frames: unknown }).frames : [];

  if (!Array.isArray(frames)) {
    return [];
  }

  return frames
    .filter((frame): frame is TemplateOption => {
      return typeof frame === "object" && frame !== null && "label" in frame && "color" in frame && "accent" in frame;
    })
    .map((frame) => ({
      id: typeof frame.id === "string" ? frame.id : makeId("frame"),
      label: String(frame.label),
      category: frameCategories.includes(frame.category as FrameCategory) ? (frame.category as FrameCategory) : "Custom",
      color: String(frame.color),
      accent: String(frame.accent),
      emoji: typeof frame.emoji === "string" ? frame.emoji : "✨",
      overlayImage: typeof frame.overlayImage === "string" ? frame.overlayImage : undefined,
    }));
}

function isToday(dateValue: string) {
  return new Date(dateValue).toDateString() === new Date().toDateString();
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

export function DashboardScreen({
  adminName,
  uiTheme,
  filters,
  frames,
  sessions,
  vouchers,
  booths,
  sessionPrice,
  showLoginSuccess,
  onCloseLoginSuccess,
  onBack,
  onLogout,
  onClearSessions,
  onUpdateTheme,
  onUpdateFilters,
  onUpdateFrames,
  onCreateVoucher,
  onUpdateVoucher,
  onToggleVoucher,
  onDeleteVoucher,
  onRefresh,
}: DashboardScreenProps) {
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [notice, setNotice] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const frameFormRef = useRef<HTMLDivElement>(null);
  const [confirmModal, setConfirmModal] = useState<{
    type: "logout" | "clear_sessions" | "delete_voucher" | "delete_frame" | "delete_filter";
    voucherId?: string;
    voucherCode?: string;
    frameId?: string;
    frameLabel?: string;
    filterId?: string;
    filterLabel?: string;
    onConfirm?: () => void;
  } | null>(null);
  const [actionResultModal, setActionResultModal] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
  } | null>(null);
  const [editVoucherModal, setEditVoucherModal] = useState<{
    id: string;
    code: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    maxUses: number | null;
    startsAt: string;
    expiresAt: string;
    saving: boolean;
  } | null>(null);

  const showActionResult = (type: "success" | "error" | "info", title: string, message: string) => {
    setActionResultModal({ type, title, message });
  };

  useEffect(() => {
    if (!actionResultModal) return undefined;
    const timer = window.setTimeout(() => {
      setActionResultModal(null);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [actionResultModal]);

  const [filterDraft, setFilterDraft] = useState<FilterPreset>(defaultFilterDraft);
  const [filterBuilder, setFilterBuilder] = useState<FilterBuilder>(defaultBuilder);
  const [filterImport, setFilterImport] = useState("");
  const [frameImport, setFrameImport] = useState("");
  const [voucherSaving, setVoucherSaving] = useState(false);
  const [voucherDraft, setVoucherDraft] = useState({
    code: "",
    discountType: "fixed" as "fixed" | "percent",
    discountValue: 5000,
    maxUses: 10 as number | null,
    startsAt: "",
    expiresAt: "",
  });
  const [frameDraft, setFrameDraft] = useState<TemplateOption>({
    id: "custom-frame",
    label: "Custom Frame",
    category: "Cute",
    color: "#FCE7F3",
    accent: "#EC4899",
    emoji: "✨",
    layout: "all",
    chromaKeyGreen: true,
  });
  const todaySessions = useMemo(() => sessions.filter((session) => isToday(session.createdAt)), [sessions]);
  const allPhotos = useMemo(
    () =>
      sessions.flatMap((session) =>
        session.photos.map((photo, index) => ({
          id: `${session.id}-${index}`,
          photo,
          session,
        })),
      ),
    [sessions],
  );

  const [timeRange, setTimeRange] = useState<TimeRangeOption>("14d");

  const filteredSessions = useMemo(() => {
    if (timeRange === "all") return sessions;
    const now = Date.now();
    let cutoff = 0;
    if (timeRange === "7d") cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (timeRange === "14d") cutoff = now - 14 * 24 * 60 * 60 * 1000;
    else if (timeRange === "30d") cutoff = now - 30 * 24 * 60 * 60 * 1000;
    else if (timeRange === "monthly") cutoff = now - 365 * 24 * 60 * 60 * 1000;

    return sessions.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
  }, [sessions, timeRange]);

  const chartData = useMemo(() => {
    const data: Array<{ key: string; label: string; revenue: number; sessions: number }> = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (timeRange === "monthly") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        const label = new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(d);
        data.push({ key, label, revenue: 0, sessions: 0 });
      }

      sessions.forEach((s) => {
        const d = new Date(s.createdAt);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        const point = data.find((item) => item.key === key);
        if (point) {
          point.sessions += 1;
          if (s.payment?.amount) point.revenue += s.payment.amount;
        }
      });
    } else if (timeRange === "all") {
      const map = new Map<string, { label: string; revenue: number; sessions: number }>();
      sessions.forEach((s) => {
        const d = new Date(s.createdAt);
        const key = d.toISOString().split("T")[0];
        const label = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
        if (!map.has(key)) {
          map.set(key, { label, revenue: 0, sessions: 0 });
        }
        const item = map.get(key)!;
        item.sessions += 1;
        if (s.payment?.amount) item.revenue += s.payment.amount;
      });

      const sortedKeys = Array.from(map.keys()).sort();
      sortedKeys.forEach((key) => {
        const item = map.get(key)!;
        data.push({ key, label: item.label, revenue: item.revenue, sessions: item.sessions });
      });

      if (data.length === 0) {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const key = d.toISOString().split("T")[0];
          data.push({
            key,
            label: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d),
            revenue: 0,
            sessions: 0,
          });
        }
      }
    } else {
      const numDays = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 14;
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split("T")[0];
        data.push({
          key,
          label: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d),
          revenue: 0,
          sessions: 0,
        });
      }

      filteredSessions.forEach((s) => {
        const key = new Date(s.createdAt).toISOString().split("T")[0];
        const point = data.find((item) => item.key === key);
        if (point) {
          point.sessions += 1;
          if (s.payment?.amount) point.revenue += s.payment.amount;
        }
      });
    }

    return data;
  }, [sessions, filteredSessions, timeRange]);

  const layoutDistributionData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSessions.forEach((s) => {
      const layout = s.frameLayout || (s.mode === "strip" ? "1x4" : "1x1");
      const label = layout === "1x4" ? "Strip (1x4)" : layout === "1x1" ? "Single (1x1)" : layout === "1x2" ? "Duo (1x2)" : layout === "1x3" ? "Trio (1x3)" : layout;
      map.set(label, (map.get(label) || 0) + 1);
    });
    if (map.size === 0) {
      return [
        { name: "Strip (1x4)", value: 0 },
        { name: "Single (1x1)", value: 0 },
      ];
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredSessions]);

  const hourlyTrafficData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      sessions: 0,
    }));
    filteredSessions.forEach((s) => {
      const h = new Date(s.createdAt).getHours();
      if (hours[h]) {
        hours[h].sessions += 1;
      }
    });
    return hours.filter((_, idx) => idx >= 8 && idx <= 23);
  }, [filteredSessions]);

  const totalRevenue = useMemo(() => {
    return filteredSessions.reduce((acc, s) => acc + (s.payment?.amount || 0), 0);
  }, [filteredSessions]);

  useEffect(() => {
    if (!showLoginSuccess) return undefined;
    const timer = window.setTimeout(() => {
      onCloseLoginSuccess?.();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [showLoginSuccess, onCloseLoginSuccess]);

  const saveNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const updateTheme = (patch: Partial<BoothThemeSettings>) => {
    onUpdateTheme((current) => ({
      ...current,
      ...patch,
    }));
  };

  const applyBackgroundPreset = (presetId: string) => {
    const preset = BACKGROUND_PRESETS.find((item) => item.id === presetId) || BACKGROUND_PRESETS[0];
    updateTheme({ backgroundPresetId: preset.id, background: preset });
  };

  const applyFilterBuilder = () => {
    setFilterDraft((current) => ({
      ...current,
      css: buildFilterCss(filterBuilder),
    }));
  };

  const saveFilter = () => {
    const now = new Date().toISOString();
    const nextFilter: FilterPreset = {
      ...filterDraft,
      id: filterDraft.id.trim() || makeId("filter"),
      label: filterDraft.label.trim() || "Untitled Filter",
      css: filterDraft.css.trim(),
      source: filterDraft.source?.trim() || "Dashboard",
      createdAt: filterDraft.createdAt || now,
    };

    if (!nextFilter.css) {
      showActionResult("error", "CSS Filter Kosong ⚠️", "Masukkan sintaks CSS filter yang valid.");
      return;
    }

    onUpdateFilters((current) => {
      const exists = current.some((filter) => filter.id === nextFilter.id);
      return exists ? current.map((filter) => (filter.id === nextFilter.id ? nextFilter : filter)) : [...current, nextFilter];
    });
    showActionResult("success", "Preset Filter Disimpan! ✨", `Filter "${nextFilter.label}" berhasil disimpan.`);
  };

  const importFilters = () => {
    try {
      const importedFilters = parseFilterPayload(filterImport);
      if (importedFilters.length === 0) {
        showActionResult("error", "Impor Gagal ⚠️", "Tidak ada filter valid yang ditemukan dalam JSON.");
        return;
      }

      onUpdateFilters((current) => {
        const map = new Map(current.map((filter) => [filter.id, filter]));
        importedFilters.forEach((filter) => map.set(filter.id, filter));
        return [...map.values()];
      });
      setFilterImport("");
      showActionResult("success", "Filter Berhasil Diimpor! 📦", `${importedFilters.length} preset filter baru berhasil ditambahkan.`);
    } catch {
      showActionResult("error", "Format JSON Salah ❌", "Format JSON payload filter tidak valid.");
    }
  };

  const saveFrame = () => {
    const nextFrame: TemplateOption = {
      ...frameDraft,
      id: frameDraft.id.trim() || makeId("frame"),
      label: frameDraft.label.trim() || "Untitled Frame",
      category: frameDraft.category,
      color: frameDraft.color || "#FCE7F3",
      accent: frameDraft.accent || "#EC4899",
      emoji: frameDraft.emoji || "✨",
      layout: frameDraft.layout || "all",
      chromaKeyGreen: frameDraft.chromaKeyGreen !== false,
      slots: frameDraft.slots && frameDraft.slots.length > 0 ? frameDraft.slots : undefined,
    };

    onUpdateFrames((current) => {
      const exists = current.some((frame) => frame.id === nextFrame.id);
      return exists ? current.map((frame) => (frame.id === nextFrame.id ? nextFrame : frame)) : [...current, nextFrame];
    });
    showActionResult("success", "Template Frame Disimpan! 🖼️", `Frame "${nextFrame.label}" berhasil disimpan dengan ${nextFrame.slots?.length || 0} slot terkunci.`);
  };

  const scanAndLockSlots = (overlaySrc?: string) => {
    const src = overlaySrc || frameDraft.overlayImage;
    if (!src) {
      showActionResult("info", "Belum Ada Overlay ⚠️", "Unggah gambar overlay PNG terlebih dahulu untuk memindai greenscreen.");
      return;
    }
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const shotCount = getCaptureCount(frameDraft.layout && frameDraft.layout !== "all" ? frameDraft.layout : "1x4");
      const detected = detectGreenscreenSlotsFromCanvas(img, shotCount);
      const lockedSlots = detected.map(slotRectToFrameSlotRect);
      setFrameDraft((current) => ({ ...current, slots: lockedSlots }));
      showActionResult("success", "Slot Greenscreen Terkunci! 🎯", `${lockedSlots.length} slot koordinat greenscreen berhasil dideteksi & dikunci.`);
    };
    img.onerror = () => {
      showActionResult("error", "Gagal Memindai Gambar ❌", "Tidak dapat membaca gambar overlay PNG.");
    };
    img.src = src;
  };

  const importFrames = () => {
    try {
      const importedFrames = parseFramePayload(frameImport);
      if (importedFrames.length === 0) {
        showActionResult("error", "Impor Gagal ⚠️", "Tidak ada frame valid yang ditemukan dalam JSON.");
        return;
      }

      onUpdateFrames((current) => {
        const map = new Map(current.map((frame) => [frame.id, frame]));
        importedFrames.forEach((frame) => map.set(frame.id, frame));
        return [...map.values()];
      });
      setFrameImport("");
      showActionResult("success", "Frame Berhasil Diimpor! 📦", `${importedFrames.length} template frame baru berhasil ditambahkan.`);
    } catch {
      showActionResult("error", "Format JSON Salah ❌", "Format JSON payload frame tidak valid.");
    }
  };

  const loadFrameOverlay = (file: File | undefined) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
      setFrameDraft((current) => ({
        ...current,
        overlayImage: dataUrl,
      }));
      if (dataUrl) {
        scanAndLockSlots(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveVoucher = async () => {
    setVoucherSaving(true);
    try {
      const code = voucherDraft.code.trim().toUpperCase();
      await onCreateVoucher({
        ...voucherDraft,
        code,
        startsAt: voucherDraft.startsAt ? new Date(voucherDraft.startsAt).toISOString() : null,
        expiresAt: voucherDraft.expiresAt ? new Date(voucherDraft.expiresAt).toISOString() : null,
      });
      setVoucherDraft((current) => ({ ...current, code: "" }));
      showActionResult("success", "Voucher Berhasil Ditambahkan! 🎉", `Kode voucher ${code} telah disimpan ke database.`);
    } catch (error) {
      showActionResult("error", "Gagal Menambah Voucher ❌", error instanceof Error ? error.message : "Voucher gagal disimpan.");
    } finally {
      setVoucherSaving(false);
    }
  };

  const formatVoucherValue = (voucher: Voucher) => voucher.discountType === "percent"
    ? `${voucher.discountValue}%`
    : `Rp${voucher.discountValue.toLocaleString("id-ID")}`;

  const safeVouchers = (vouchers || []).filter((v): v is Voucher => Boolean(v && v.code));

  const exportVouchersCsv = () => {
    const headers = ["Kode Voucher", "Tipe Diskon", "Nilai Diskon", "Penggunaan", "Mulai Berlaku", "Kedaluwarsa", "Status"];
    const rows = safeVouchers.map((v) => [
      v.code,
      v.discountType === "fixed" ? "Nominal (Rp)" : "Persentase (%)",
      v.discountType === "fixed" ? `Rp${v.discountValue}` : `${v.discountValue}%`,
      `${v.usedCount}/${v.maxUses ?? "Unlim"}`,
      v.startsAt ? formatDate(v.startsAt) : "Sekarang",
      v.expiresAt ? formatDate(v.expiresAt) : "Tanpa Batas",
      v.active ? "Aktif" : "Nonaktif",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pixiebooth-laporan-voucher-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMetric = (label: string, value: number | string) => (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-black text-foreground">{value}</p>
    </div>
  );

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.35 }}
    >
      <div className="booth-bg absolute inset-0" />
      <div className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-[96rem] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-full border border-white/60 bg-white/70 p-2.5 shadow-sm transition-transform hover:scale-110 dark:bg-white/10"
            aria-label="Back to app"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black text-foreground sm:text-3xl" style={{ fontFamily: "Pacifico, cursive" }}>
              {uiTheme.logoEmoji} {uiTheme.brandName} Dashboard
            </h1>
            <p className="truncate text-xs font-semibold text-muted-foreground sm:text-sm">Booth operations, payments, media, and design manager</p>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {notice && <span className="hidden rounded-full bg-white/70 px-4 py-2 text-xs font-black text-primary shadow-sm sm:block">{notice}</span>}
            <div className="hidden min-w-0 items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-black text-foreground shadow-sm dark:border-white/10 dark:bg-white/10 md:flex">
              <ShieldCheck size={15} className="shrink-0 text-primary" />
              <span className="max-w-[9rem] truncate">{adminName}</span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmModal({ type: "logout" })}
              className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-black text-rose-500 shadow-sm transition-transform hover:scale-105 dark:border-white/10 dark:bg-white/10"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <div className="mb-4 flex shrink-0 gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
          {dashboardTabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-colors ${tab === item.id ? "bg-primary text-primary-foreground shadow-md" : "border border-white/60 bg-white/70 text-muted-foreground dark:bg-white/10"
                }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden min-h-0 rounded-3xl border border-white/60 bg-white/55 p-3 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-white/10 lg:block">
            <div className="space-y-2">
              {dashboardTabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition-colors ${tab === item.id ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-white/70 dark:hover:bg-white/10"
                    }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto rounded-3xl border border-white/60 bg-white/45 p-4 shadow-xl backdrop-blur-sm scrollbar-hide dark:border-white/10 dark:bg-white/10 sm:p-5 lg:p-6">
            {tab === "overview" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                  <div className="flex items-center gap-2 text-sm font-black text-foreground">
                    <Calendar size={18} className="text-primary" />
                    <span>Filter Laporan Analytics</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: "7d", label: "7 Hari" },
                        { id: "14d", label: "14 Hari" },
                        { id: "30d", label: "30 Hari" },
                        { id: "monthly", label: "12 Bulan" },
                        { id: "all", label: "Semua (All)" },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTimeRange(item.id)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${timeRange === item.id
                          ? "bg-primary text-primary-foreground shadow-sm scale-105"
                          : "bg-white/70 text-muted-foreground hover:bg-white hover:text-foreground dark:bg-white/10"
                          }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {renderMetric("Foto hari ini", todaySessions.length)}
                  {renderMetric("Total session", sessions.length)}
                  {renderMetric("Total hasil", allPhotos.length)}
                  {renderMetric("Total Omset", `Rp${totalRevenue.toLocaleString("id-ID")}`)}
                  {renderMetric("Filter aktif", filters.length)}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                    <h2 className="mb-4 text-lg font-black text-foreground">
                      Traffic Pengguna ({timeRange === "7d" ? "7 Hari Terakhir" : timeRange === "14d" ? "14 Hari Terakhir" : timeRange === "30d" ? "30 Hari Terakhir" : timeRange === "monthly" ? "12 Bulan Terakhir" : "Semua Data"})
                    </h2>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontWeight: "bold" }}
                            labelStyle={{ color: "#4b5563", marginBottom: "4px" }}
                          />
                          <Bar dataKey="sessions" name="Sesi Foto" fill={uiTheme.primaryColor} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                    <h2 className="mb-4 text-lg font-black text-foreground">
                      Pendapatan ({timeRange === "7d" ? "7 Hari Terakhir" : timeRange === "14d" ? "14 Hari Terakhir" : timeRange === "30d" ? "30 Hari Terakhir" : timeRange === "monthly" ? "12 Bulan Terakhir" : "Semua Data"})
                    </h2>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={uiTheme.secondaryColor} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={uiTheme.secondaryColor} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(val) => `Rp${val / 1000}k`} />
                          <Tooltip
                            formatter={(value: number) => [`Rp ${value.toLocaleString("id-ID")}`, "Pendapatan"]}
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontWeight: "bold" }}
                            labelStyle={{ color: "#4b5563", marginBottom: "4px" }}
                          />
                          <Area type="monotone" dataKey="revenue" stroke={uiTheme.secondaryColor} strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                    <h2 className="mb-4 text-lg font-black text-foreground">Distribusi Layout Frame</h2>
                    <div className="flex h-64 w-full items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={layoutDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {layoutDistributionData.map((_, index) => {
                              const COLORS = [uiTheme.primaryColor, uiTheme.secondaryColor, "#EC4899", "#3B82F6", "#10B981"];
                              return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                            })}
                          </Pie>
                          <Tooltip
                            formatter={(val: number) => [`${val} sesi`, "Jumlah"]}
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontWeight: "bold" }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: "bold" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                    <h2 className="mb-4 text-lg font-black text-foreground">Jam Ramai Pengguna (Peak Hours)</h2>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyTrafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} dy={5} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} allowDecimals={false} />
                          <Tooltip
                            formatter={(val: number) => [`${val} sesi`, "Jumlah Sesi"]}
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontWeight: "bold" }}
                          />
                          <Bar dataKey="sessions" name="Sesi Foto" fill={uiTheme.secondaryColor} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-lg font-black text-foreground">Recent Sessions</h2>
                      <button
                        onClick={() => setConfirmModal({ type: "clear_sessions" })}
                        className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-xs font-black text-rose-500 transition-colors hover:bg-white dark:bg-white/10"
                      >
                        <Trash2 size={13} /> Clear
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {(sessions.length > 0 ? sessions.slice(0, 6) : []).map((session) => (
                        <button
                          key={session.id}
                          onClick={() => setSelectedPhoto(session.photos[0] || null)}
                          className="overflow-hidden rounded-2xl border border-white/70 bg-white text-left shadow-sm transition-transform hover:scale-[1.02] dark:border-white/10 dark:bg-white/10"
                        >
                          <img src={session.photos[0] || SAMPLE_PHOTOS[0]} alt="Session preview" className="h-36 w-full object-cover" />
                          <div className="p-3">
                            <p className="text-sm font-black text-foreground">{session.frameLayout || (session.mode === "strip" ? "1x4" : "1x1")} · {session.resultFormat || "photo"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDate(session.createdAt)}</p>
                          </div>
                        </button>
                      ))}
                      {sessions.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-pink-300 bg-white/55 p-6 text-sm font-bold text-muted-foreground">
                          Belum ada session foto. Setelah user selesai edit, hasilnya akan masuk ke dashboard otomatis.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10">
                    <h2 className="text-lg font-black text-foreground">Booth Status</h2>
                    <div className="mt-4 space-y-3 text-sm font-semibold text-muted-foreground">
                      <p>Brand: {uiTheme.brandName}</p>
                      <p>Background: {uiTheme.background.label}</p>
                      <p>Frame designs: {frames.length}</p>
                      <p>Filter presets: {filters.length}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "theme" && (
              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm font-black text-foreground">
                      Brand Name
                      <input
                        value={uiTheme.brandName}
                        onChange={(event) => updateTheme({ brandName: event.target.value })}
                        className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-black text-foreground">
                      Logo
                      <input
                        value={uiTheme.logoEmoji}
                        onChange={(event) => updateTheme({ logoEmoji: event.target.value.slice(0, 4) })}
                        className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                      />
                    </label>
                  </div>

                  <label className="space-y-1 text-sm font-black text-foreground">
                    Tagline
                    <input
                      value={uiTheme.tagline}
                      onChange={(event) => updateTheme({ tagline: event.target.value })}
                      className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm font-black text-foreground">
                      Primary Color
                      <input
                        type="color"
                        value={uiTheme.primaryColor}
                        onChange={(event) => updateTheme({ primaryColor: event.target.value })}
                        className="h-12 w-full rounded-2xl border border-white/70 bg-white/80 p-1 dark:border-white/10 dark:bg-white/10"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-black text-foreground">
                      Secondary Color
                      <input
                        type="color"
                        value={uiTheme.secondaryColor}
                        onChange={(event) => updateTheme({ secondaryColor: event.target.value })}
                        className="h-12 w-full rounded-2xl border border-white/70 bg-white/80 p-1 dark:border-white/10 dark:bg-white/10"
                      />
                    </label>
                  </div>

                  <div>
                    <h2 className="mb-3 text-lg font-black text-foreground">Background Preset</h2>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {BACKGROUND_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => applyBackgroundPreset(preset.id)}
                          className={`overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition-transform hover:scale-[1.02] ${uiTheme.backgroundPresetId === preset.id ? "border-primary" : "border-white/70 dark:border-white/10"
                            }`}
                        >
                          <div className="h-20" style={{ background: `linear-gradient(135deg, ${preset.start}, ${preset.middle}, ${preset.end})` }} />
                          <p className="p-3 text-sm font-black text-foreground">{preset.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => onUpdateTheme(DEFAULT_UI_THEME)}
                    className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm font-black text-muted-foreground transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10"
                  >
                    <RefreshCcw size={16} /> Reset Theme
                  </button>
                </div>

                <div className="booth-bg flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/70 p-6 text-center shadow-inner dark:border-white/10">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl shadow-2xl" style={{ background: `linear-gradient(135deg, ${uiTheme.primaryColor}, ${uiTheme.secondaryColor})` }}>
                    {uiTheme.logoEmoji}
                  </div>
                  <h3 className="mt-4 text-4xl font-black text-foreground" style={{ fontFamily: "Pacifico, cursive" }}>
                    {uiTheme.brandName}
                  </h3>
                  <p className="mt-2 max-w-xs text-sm font-bold text-muted-foreground">{uiTheme.tagline}</p>
                </div>
              </section>
            )}

            {tab === "gallery" && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-foreground">All Captured Results</h2>
                  <button
                    onClick={() => downloadJson("pixiebooth-sessions.json", { kind: "pixiebooth.sessions", version: 1, sessions })}
                    className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-md"
                  >
                    <Download size={16} /> Export Data
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {allPhotos.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedPhoto(item.photo)}
                      className="overflow-hidden rounded-2xl border border-white/70 bg-white text-left shadow-sm transition-transform hover:scale-[1.02] dark:border-white/10 dark:bg-white/10"
                    >
                      <img src={item.photo} alt="Captured result" className="h-48 w-full object-cover" />
                      <div className="p-3">
                        <p className="text-sm font-black text-foreground">{item.session.frameLayout || (item.session.mode === "strip" ? "1x4" : "1x1")} · {item.session.resultFormat || "photo"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.session.createdAt)}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {allPhotos.length === 0 && <p className="rounded-2xl bg-white/70 p-5 text-sm font-bold text-muted-foreground">Belum ada hasil foto.</p>}
              </section>
            )}

            {tab === "vouchers" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-foreground">Voucher & Discount</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">Diskon dihitung server sebelum QRIS dinamis dibuat.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={exportVouchersCsv}
                      className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/85 px-4 py-2.5 text-xs font-black text-foreground shadow-sm transition-all hover:bg-white dark:border-white/10 dark:bg-white/10"
                    >
                      <Download size={15} className="text-primary" /> Ekspor CSV
                    </button>
                    <div className="rounded-xl bg-white/75 px-4 py-2 text-right shadow-sm dark:bg-white/10">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Harga sesi</p>
                      <p className="text-lg font-black text-primary">Rp{sessionPrice.toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                  <div className="rounded-2xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10 sm:p-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Kode voucher
                        <input
                          value={voucherDraft.code}
                          onChange={(event) => setVoucherDraft((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))}
                          placeholder="EVENT25"
                          maxLength={32}
                          className="w-full rounded-xl border border-white bg-white/85 px-4 py-3 font-mono text-sm uppercase outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Tipe diskon
                        <CustomSelect
                          value={voucherDraft.discountType}
                          onChange={(val) => setVoucherDraft((current) => ({ ...current, discountType: val as "fixed" | "percent" }))}
                          options={[
                            { value: "fixed", label: "Nominal Rupiah (Rp)", badge: "Rp" },
                            { value: "percent", label: "Persentase (%)", badge: "%" },
                          ]}
                          className="mt-1"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Nilai diskon
                        <input
                          type="number"
                          min={1}
                          max={voucherDraft.discountType === "percent" ? 100 : sessionPrice}
                          value={voucherDraft.discountValue}
                          onChange={(event) => setVoucherDraft((current) => ({ ...current, discountValue: Math.max(1, Number(event.target.value) || 1) }))}
                          className="mt-1 w-full rounded-xl border border-white bg-white/85 px-4 py-2.5 text-sm font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Kuota penggunaan
                        <input
                          type="number"
                          min={1}
                          value={voucherDraft.maxUses ?? ""}
                          onChange={(event) => setVoucherDraft((current) => ({ ...current, maxUses: event.target.value ? Math.max(1, Number(event.target.value)) : null }))}
                          placeholder="Tanpa batas"
                          className="mt-1 w-full rounded-xl border border-white bg-white/85 px-4 py-2.5 text-sm font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Mulai berlaku
                        <CustomDateTimePicker
                          value={voucherDraft.startsAt}
                          onChange={(val) => setVoucherDraft((current) => ({ ...current, startsAt: val || "" }))}
                          placeholder="Mulai sekarang"
                          className="mt-1"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Kedaluwarsa
                        <CustomDateTimePicker
                          value={voucherDraft.expiresAt}
                          onChange={(val) => setVoucherDraft((current) => ({ ...current, expiresAt: val || "" }))}
                          placeholder="Tanpa kedaluwarsa"
                          className="mt-1"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={saveVoucher}
                      disabled={voucherSaving || voucherDraft.code.length < 3}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-md disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Plus size={17} /> {voucherSaving ? "Menyimpan..." : "Tambah Voucher"}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/10">
                    <p className="text-xs font-black uppercase text-muted-foreground">Preview perhitungan</p>
                    <div className="mt-4 space-y-3 text-sm font-bold">
                      <div className="flex justify-between gap-3"><span>Harga awal</span><span>Rp{sessionPrice.toLocaleString("id-ID")}</span></div>
                      <div className="flex justify-between gap-3 text-emerald-600">
                        <span>Diskon</span>
                        <span>-Rp{Math.min(sessionPrice, voucherDraft.discountType === "percent" ? Math.round(sessionPrice * voucherDraft.discountValue / 100) : voucherDraft.discountValue).toLocaleString("id-ID")}</span>
                      </div>
                      <div className="border-t border-border pt-3 text-lg font-black text-primary">
                        <div className="flex justify-between gap-3">
                          <span>Total QRIS</span>
                          <span>Rp{Math.max(0, sessionPrice - Math.min(sessionPrice, voucherDraft.discountType === "percent" ? Math.round(sessionPrice * voucherDraft.discountValue / 100) : voucherDraft.discountValue)).toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/70 dark:border-white/10 dark:bg-white/10">
                  <div className="grid min-w-[48rem] grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_6rem_7rem_6rem] gap-3 border-b border-border px-4 py-3 text-[11px] font-black uppercase text-muted-foreground">
                    <span>Kode</span><span>Diskon</span><span>Kuota</span><span>Status</span><span>Aksi</span>
                  </div>
                  {safeVouchers.map((voucher) => (
                    <div key={voucher.id} className="grid min-w-[48rem] grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_6rem_7rem_6rem] items-center gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0">
                      <div className="min-w-0">
                        <p className="truncate font-mono font-black text-foreground">{voucher.code}</p>
                        <p className="truncate text-[11px] font-semibold text-muted-foreground">{voucher.expiresAt ? `s.d. ${formatDate(voucher.expiresAt)}` : "Tanpa kedaluwarsa"}</p>
                      </div>
                      <span className="font-black text-primary">{formatVoucherValue(voucher)}</span>
                      <span className="font-bold text-foreground">{voucher.usedCount}/{voucher.maxUses ?? "∞"}</span>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-black">
                        <input
                          type="checkbox"
                          checked={voucher.active}
                          onChange={(event) => void onToggleVoucher(voucher.id, event.target.checked).catch((error) => saveNotice(error.message))}
                          className="h-4 w-4 accent-pink-500"
                        />
                        {voucher.active ? "Aktif" : "Nonaktif"}
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditVoucherModal({
                            id: voucher.id,
                            code: voucher.code,
                            discountType: voucher.discountType as "fixed" | "percent",
                            discountValue: voucher.discountValue,
                            maxUses: voucher.maxUses,
                            startsAt: voucher.startsAt ? new Date(voucher.startsAt).toISOString().slice(0, 16) : "",
                            expiresAt: voucher.expiresAt ? new Date(voucher.expiresAt).toISOString().slice(0, 16) : "",
                            saving: false,
                          })}
                          className="grid h-9 w-9 place-items-center rounded-lg text-fuchsia-500 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30"
                          aria-label={`Edit voucher ${voucher.code}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ type: "delete_voucher", voucherId: voucher.id, voucherCode: voucher.code })}
                          className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          aria-label={`Hapus voucher ${voucher.code}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {safeVouchers.length === 0 && <p className="p-5 text-sm font-bold text-muted-foreground">Belum ada voucher server-side.</p>}
                </div>
              </section>
            )}

            {tab === "monitoring" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-foreground">Booth Monitor</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">Heartbeat agent, printer, queue, dan layar aktif.</p>
                  </div>
                  <button type="button" onClick={() => void onRefresh()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/80 px-4 text-sm font-black text-primary shadow-sm dark:bg-white/10">
                    <RefreshCcw size={16} /> Refresh
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {booths.map((booth) => (
                    <article key={booth.id} className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-foreground">{booth.name}</p>
                          <p className="truncate font-mono text-[11px] font-bold text-muted-foreground">{booth.id}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${booth.online ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {booth.online ? <Wifi size={13} /> : <WifiOff size={13} />}{booth.online ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-bold">
                        <div><p className="text-muted-foreground">Layar</p><p className="mt-1 truncate text-foreground">{booth.status.kioskScreen || "-"}</p></div>
                        <div><p className="text-muted-foreground">Printer</p><p className="mt-1 truncate text-foreground">{booth.status.printer?.available ? booth.status.printer.name || "Ready" : "Unavailable"}</p></div>
                        <div><p className="text-muted-foreground">Queue</p><p className="mt-1 text-foreground">{Number(booth.status.queueLength || 0)} job</p></div>
                        <div><p className="text-muted-foreground">Version</p><p className="mt-1 truncate text-foreground">{booth.version || "-"}</p></div>
                      </div>
                      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] font-semibold text-muted-foreground">
                        <Power size={13} /> {booth.lastSeenAt ? `Heartbeat ${formatDate(booth.lastSeenAt)}` : "Belum pernah terhubung"}
                      </div>
                    </article>
                  ))}
                  {booths.length === 0 && <p className="rounded-2xl bg-white/70 p-5 text-sm font-bold text-muted-foreground">Belum ada booth terdaftar.</p>}
                </div>
              </section>
            )}

            {tab === "filters" && (
              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10">
                    <h2 className="text-lg font-black text-foreground">Filter Studio</h2>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Name
                        <input
                          value={filterDraft.label}
                          onChange={(event) => setFilterDraft((current) => ({ ...current, label: event.target.value }))}
                          className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Source
                        <input
                          value={filterDraft.source || ""}
                          onChange={(event) => setFilterDraft((current) => ({ ...current, source: event.target.value }))}
                          placeholder="Lightroom, VSCO, custom..."
                          className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block space-y-1 text-sm font-black text-foreground">
                      CSS Filter String
                      <textarea
                        value={filterDraft.css}
                        onChange={(event) => setFilterDraft((current) => ({ ...current, css: event.target.value }))}
                        rows={3}
                        className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 font-mono text-xs outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={saveFilter} className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-md">
                        <Plus size={16} /> Save Filter
                      </button>
                      <button
                        onClick={() => downloadJson("pixiebooth-filters.json", { kind: "pixiebooth.filters", version: 1, filters })}
                        className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-muted-foreground"
                      >
                        <Download size={16} /> Export
                      </button>
                      <button onClick={() => onUpdateFilters(FILTERS)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-muted-foreground">
                        <RefreshCcw size={16} /> Reset
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10">
                    <h2 className="text-lg font-black text-foreground">Visual Builder</h2>
                    <div className="mt-4 space-y-3">
                      {[
                        { label: "Brightness", key: "brightness" as const, min: 50, max: 150 },
                        { label: "Contrast", key: "contrast" as const, min: 50, max: 160 },
                        { label: "Saturation", key: "saturation" as const, min: 0, max: 220 },
                        { label: "Sepia", key: "sepia" as const, min: 0, max: 100 },
                        { label: "Grayscale", key: "grayscale" as const, min: 0, max: 100 },
                        { label: "Hue", key: "hue" as const, min: -180, max: 180 },
                        { label: "Blur", key: "blur" as const, min: 0, max: 8 },
                      ].map((item) => (
                        <div key={item.key} className="grid grid-cols-[6rem_minmax(0,1fr)_3rem] items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground">{item.label}</span>
                          <input
                            type="range"
                            min={item.min}
                            max={item.max}
                            value={filterBuilder[item.key]}
                            onChange={(event) => setFilterBuilder((current) => ({ ...current, [item.key]: Number(event.target.value) }))}
                            className="accent-pink-400"
                          />
                          <span className="text-right text-xs font-bold text-muted-foreground">{filterBuilder[item.key]}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={applyFilterBuilder} className="mt-4 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
                      Apply to CSS
                    </button>
                  </div>

                  <div className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10">
                    <h2 className="text-lg font-black text-foreground">Import Filter JSON</h2>
                    <textarea
                      value={filterImport}
                      onChange={(event) => setFilterImport(event.target.value)}
                      rows={4}
                      placeholder='{"filters":[{"label":"Warm","css":"brightness(110%) saturate(120%)"}]}'
                      className="mt-3 w-full rounded-2xl border border-white bg-white/85 px-4 py-3 font-mono text-xs outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                    />
                    <button onClick={importFilters} className="mt-3 flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
                      <Upload size={16} /> Import
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-xl dark:border-white/10 dark:bg-white/10">
                    <img src={SAMPLE_PHOTOS[0]} alt="Filter preview" className="h-72 w-full object-cover" style={{ filter: filterDraft.css }} />
                    <div className="p-4">
                      <p className="text-sm font-black text-foreground">{filterDraft.label}</p>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{filterDraft.css}</p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {filters.map((filter) => (
                      <div
                        key={filter.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 p-2 text-left transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10"
                      >
                        <img src={SAMPLE_PHOTOS[1]} alt="" className="h-14 w-14 rounded-xl object-cover" style={{ filter: filter.css }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-foreground">{filter.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{filter.source || "Built-in"}</span>
                        </span>
                        <button
                          onClick={() => setFilterDraft(filter)}
                          className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-muted-foreground hover:text-primary"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setConfirmModal({
                              type: "delete_filter",
                              filterId: filter.id,
                              filterLabel: filter.label,
                              onConfirm: () => {
                                onUpdateFilters((current) => current.filter((item) => item.id !== filter.id));
                                showActionResult("success", "Filter Dihapus! 🗑️", `Filter "${filter.label}" berhasil dihapus.`);
                              },
                            });
                          }}
                          className="rounded-full p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          aria-label={`Delete ${filter.label}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {tab === "frames" && (
              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="space-y-5">
                  <div ref={frameFormRef} className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10 scroll-mt-6">
                    <h2 className="text-lg font-black text-foreground">Frame Studio</h2>

                    {/* Dimension Guide Box */}
                    <div className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200">
                      <div className="font-black text-amber-950 dark:text-amber-100">📐 Panduan Ukuran & Format PNG Frame:</div>
                      <ul className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] font-bold">
                        <li>• <strong>1x1</strong>: 600 x 800 px (Rasio 3:4)</li>
                        <li>• <strong>1x2</strong>: 600 x 1200 px (Rasio 1:2)</li>
                        <li>• <strong>1x3 Strip</strong>: 600 x 1800 px (Rasio 1:3)</li>
                        <li>• <strong>1x4 Strip</strong>: 600 x 1800 px (Rasio 1:3)</li>
                      </ul>
                      <p className="mt-2 text-[10.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                        💡 <strong>Greenscreen Autocut:</strong> Isi slot tempat foto pada gambar PNG dengan warna hijau murni (<code className="rounded bg-green-200 px-1 font-mono font-bold text-green-900">#00FF00</code>). Sistem akan otomatis mendeteksi dan menghapus area hijau agar foto berada tepat di belakang frame!
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Frame Name
                        <input
                          value={frameDraft.label}
                          onChange={(event) => setFrameDraft((current) => ({ ...current, label: event.target.value }))}
                          className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Category
                        <select
                          value={frameDraft.category}
                          onChange={(event) => setFrameDraft((current) => ({ ...current, category: event.target.value as FrameCategory }))}
                          className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        >
                          {frameCategories.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Target Layout
                        <select
                          value={frameDraft.layout || "all"}
                          onChange={(event) => setFrameDraft((current) => ({ ...current, layout: event.target.value as FrameLayout | "all" }))}
                          className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        >
                          <option value="all">Semua Layout (Responsif)</option>
                          <option value="1x1">1x1 (Ratio 3:4 — 600 x 800 px)</option>
                          <option value="1x2">1x2 (Ratio 1:2 — 600 x 1200 px)</option>
                          <option value="1x3">1x3 Strip (Ratio 1:3 — 600 x 1800 px)</option>
                          <option value="1x4">1x4 Strip 4 Pose (Ratio 1:3 — 600 x 1800 px)</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Emoji
                        <input
                          value={frameDraft.emoji}
                          onChange={(event) => setFrameDraft((current) => ({ ...current, emoji: event.target.value.slice(0, 4) }))}
                          className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Overlay PNG
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) => loadFrameOverlay(event.target.files?.[0])}
                          className="w-full rounded-2xl border border-white bg-white/85 px-4 py-2 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground">
                        Background
                        <input
                          type="color"
                          value={frameDraft.color}
                          onChange={(event) => setFrameDraft((current) => ({ ...current, color: event.target.value }))}
                          className="h-12 w-full rounded-2xl border border-white bg-white/85 p-1 dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-black text-foreground md:col-span-2">
                        Border / Accent Color
                        <input
                          type="color"
                          value={frameDraft.accent}
                          onChange={(event) => setFrameDraft((current) => ({ ...current, accent: event.target.value }))}
                          className="h-12 w-full rounded-2xl border border-white bg-white/85 p-1 dark:border-white/10 dark:bg-white/10"
                        />
                      </label>
                      <div className="md:col-span-2 space-y-2 rounded-2xl border border-white/60 bg-white/50 p-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-black text-foreground block">🎯 Lock Koordinat Slot Greenscreen</span>
                            <span className="text-[11px] text-muted-foreground">Kunci posisi & ukuran area greenscreen agar foto ditempatkan dengan presisi 100%.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => scanAndLockSlots()}
                            className="rounded-xl bg-pink-500 hover:bg-pink-600 px-3 py-1.5 text-xs font-black text-white shadow-xs transition-colors shrink-0"
                          >
                            🎯 Scan & Lock Otomatis
                          </button>
                        </div>

                        {frameDraft.slots && frameDraft.slots.length > 0 ? (
                          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                            {frameDraft.slots.map((slot, idx) => (
                              <div key={idx} className="flex items-center gap-2 rounded-xl bg-white/80 p-2 text-[11px] font-mono font-bold dark:bg-white/10 border border-black/5">
                                <span className="w-14 text-pink-600 dark:text-pink-400 font-black">Slot #{idx + 1}</span>
                                <label className="flex items-center gap-1">
                                  <span>X:</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={slot.x}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setFrameDraft((curr) => {
                                        const newSlots = [...(curr.slots || [])];
                                        if (newSlots[idx]) newSlots[idx] = { ...newSlots[idx], x: val };
                                        return { ...curr, slots: newSlots };
                                      });
                                    }}
                                    className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs dark:border-white/20 dark:bg-black/30"
                                  />
                                  <span>%</span>
                                </label>
                                <label className="flex items-center gap-1">
                                  <span>Y:</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={slot.y}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setFrameDraft((curr) => {
                                        const newSlots = [...(curr.slots || [])];
                                        if (newSlots[idx]) newSlots[idx] = { ...newSlots[idx], y: val };
                                        return { ...curr, slots: newSlots };
                                      });
                                    }}
                                    className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs dark:border-white/20 dark:bg-black/30"
                                  />
                                  <span>%</span>
                                </label>
                                <label className="flex items-center gap-1">
                                  <span>W:</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={slot.w}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setFrameDraft((curr) => {
                                        const newSlots = [...(curr.slots || [])];
                                        if (newSlots[idx]) newSlots[idx] = { ...newSlots[idx], w: val };
                                        return { ...curr, slots: newSlots };
                                      });
                                    }}
                                    className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs dark:border-white/20 dark:bg-black/30"
                                  />
                                  <span>%</span>
                                </label>
                                <label className="flex items-center gap-1">
                                  <span>H:</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={slot.h}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setFrameDraft((curr) => {
                                        const newSlots = [...(curr.slots || [])];
                                        if (newSlots[idx]) newSlots[idx] = { ...newSlots[idx], h: val };
                                        return { ...curr, slots: newSlots };
                                      });
                                    }}
                                    className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs dark:border-white/20 dark:bg-black/30"
                                  />
                                  <span>%</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                            ⚠️ Belum ada slot terkunci. Klik "Scan & Lock Otomatis" atau unggah overlay PNG.
                          </p>
                        )}
                      </div>

                      <label className="flex items-center gap-2 text-xs font-black text-foreground md:col-span-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={frameDraft.chromaKeyGreen !== false}
                          onChange={(event) => setFrameDraft((current) => ({ ...current, chromaKeyGreen: event.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span>🟢 Deteksi Greenscreen Otomatis (Hapus warna hijau pada PNG agar foto kelihatan)</span>
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={saveFrame} className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-md">
                        <Plus size={16} /> Save Frame
                      </button>
                      <button
                        onClick={() => downloadJson("pixiebooth-frames.json", { kind: "pixiebooth.frames", version: 1, frames })}
                        className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-muted-foreground"
                      >
                        <Download size={16} /> Export
                      </button>
                      <button onClick={() => onUpdateFrames(TEMPLATES)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-muted-foreground">
                        <RefreshCcw size={16} /> Reset
                      </button>
                    </div>
                  </div>

                  {/*<div className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10">
                    <h2 className="text-lg font-black text-foreground">Import Frame JSON</h2>
                    <textarea
                      value={frameImport}
                      onChange={(event) => setFrameImport(event.target.value)}
                      rows={4}
                      placeholder='{"frames":[{"label":"Brand Frame","category":"Minimal","color":"#ffffff","accent":"#ec4899","emoji":"✨","layout":"1x1","chromaKeyGreen":true}]}'
                      className="mt-3 w-full rounded-2xl border border-white bg-white/85 px-4 py-3 font-mono text-xs outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                    />
                    <button onClick={importFrames} className="mt-3 flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
                      <Upload size={16} /> Import
                    </button>
                  </div>*/}
                </div>

                <div className="space-y-4">
                  <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/10">
                    <div className="text-center mb-2">
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Preview Frame Realtime</span>
                    </div>
                    {/* Real 100% Aspect Ratio & Full Height/Width Container */}
                    <div
                      className={`relative flex items-center justify-center overflow-hidden rounded-none text-5xl shadow-2xl transition-all border border-black/10 ${frameDraft.layout === "1x2"
                          ? "w-48 aspect-[1/2]"
                          : frameDraft.layout === "1x3" || frameDraft.layout === "1x4"
                            ? "w-40 aspect-[1/3]"
                            : "w-60 aspect-[3/4]"
                        }`}
                      style={{ backgroundColor: frameDraft.color }}
                    >
                      {frameDraft.slots && frameDraft.slots.length > 0 ? (
                        frameDraft.slots.map((slot, idx) => (
                          <div
                            key={idx}
                            className="absolute border-2 border-dashed border-pink-500 bg-pink-400/25 text-[9px] font-black text-pink-800 dark:text-pink-200 flex items-center justify-center pointer-events-none z-10 shadow-xs"
                            style={{
                              left: `${slot.x}%`,
                              top: `${slot.y}%`,
                              width: `${slot.w}%`,
                              height: `${slot.h}%`,
                            }}
                          >
                            Slot #{idx + 1}
                          </div>
                        ))
                      ) : (
                        <div className="absolute inset-[10%] flex flex-col gap-2">
                          <span className="min-h-0 flex-1 rounded-lg bg-white/80 border border-black/10 shadow-xs" />
                          <span className="min-h-0 flex-1 rounded-lg bg-white/80 border border-black/10 shadow-xs" />
                        </div>
                      )}
                      <span className="relative z-10 text-4xl">{frameDraft.emoji}</span>
                      {frameDraft.overlayImage && (
                        <ChromaImage src={frameDraft.overlayImage} alt="" className="absolute inset-0 h-full w-full object-fill z-20 pointer-events-none" />
                      )}
                    </div>
                    {frameDraft.slots && frameDraft.slots.length > 0 && (
                      <p className="mt-3 text-center text-xs font-black text-pink-600 dark:text-pink-400">
                        🎯 {frameDraft.slots.length} Slot Greenscreen Terkunci Presisi (100% Ratio)
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Comprehensive Frame Table Management */}
            {tab === "frames" && (
              <section className="mt-6 rounded-3xl border border-white/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-black text-foreground">Tabel Kelola Frame Template</h2>
                    <p className="text-xs text-muted-foreground">Ubah detail, resolusi ukuran, target layout, dan status greenscreen secara fleksibel.</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-black text-primary">
                    {frames.length} Frame Tersimpan
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/80 dark:border-white/10 shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/80 dark:bg-white/5 font-black text-muted-foreground uppercase text-[10.5px] border-b border-white/60 dark:border-white/10">
                      <tr>
                        <th className="px-4 py-3">Preview</th>
                        <th className="px-4 py-3">Nama Frame & Emoji</th>
                        <th className="px-4 py-3">Kategori</th>
                        <th className="px-4 py-3">Target Layout</th>
                        <th className="px-4 py-3">Rekomendasi Ukuran</th>
                        <th className="px-4 py-3">Greenscreen</th>
                        <th className="px-4 py-3 text-right">Aksi Edit / Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/60 dark:divide-white/10 font-bold text-foreground">
                      {frames.map((frame) => {
                        const resMap: Record<string, string> = {
                          "1x1": "600 x 800 px (3:4)",
                          "1x2": "600 x 1200 px (1:2)",
                          "1x3": "600 x 1800 px (1:3)",
                          "1x4": "600 x 1800 px (1:3)",
                          "all": "Responsif (600 x 1800)",
                        };
                        return (
                          <tr key={frame.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3">
                              <div
                                className="relative flex aspect-[3/4] w-11 items-center justify-center overflow-hidden rounded-md text-lg shadow-sm"
                                style={{ backgroundColor: frame.color, border: `2px solid ${frame.accent}` }}
                              >
                                <span>{frame.emoji}</span>
                                {frame.overlayImage && <ChromaImage src={frame.overlayImage} alt="" className="absolute inset-0 h-full w-full object-cover pointer-events-none" />}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-black text-sm block">{frame.label}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{frame.id}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 px-2.5 py-0.5 text-[11px] font-black">
                                {frame.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-black text-primary">
                              {frame.layout || "all"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-[11px]">
                              {resMap[frame.layout || "all"] || "600 x 1800 px"}
                            </td>
                            <td className="px-4 py-3">
                              {frame.chromaKeyGreen !== false ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[10.5px] font-black">
                                  🟢 Auto Cut
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/10 text-muted-foreground px-2.5 py-0.5 text-[10.5px] font-bold">
                                  ⚪ Overlay Plain
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setFrameDraft(frame);
                                  if (frameFormRef.current) {
                                    frameFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                                  } else {
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }
                                }}
                                className="rounded-xl bg-white dark:bg-white/10 px-3 py-1.5 text-xs font-black text-primary hover:bg-primary hover:text-white transition-all shadow-xs"
                              >
                                <Pencil size={13} className="inline mr-1" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    type: "delete_frame",
                                    frameId: frame.id,
                                    frameLabel: frame.label,
                                    onConfirm: () => {
                                      onUpdateFrames((current) => current.filter((item) => item.id !== frame.id));
                                      showActionResult("success", "Frame Dihapus! 🗑️", `Frame "${frame.label}" berhasil dihapus.`);
                                    },
                                  });
                                }}
                                className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                                aria-label={`Hapus ${frame.label}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {showLoginSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md"
            onClick={onCloseLoginSuccess}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-b from-white via-pink-50/90 to-purple-50/70 p-6 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-600 text-3xl text-white shadow-xl">
                ✨
              </div>
              <h3 className="mt-4 text-xl font-black text-foreground">Login Berhasil!</h3>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Selamat datang kembali di Dashboard Admin, <span className="font-bold text-primary">{adminName}</span> 🎉
              </p>
              <button
                type="button"
                onClick={onCloseLoginSuccess}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 py-3 text-xs font-black text-white shadow-lg transition-transform hover:scale-[1.02]"
              >
                Masuk ke Dashboard
              </button>
              <button
                onClick={onCloseLoginSuccess}
                className="absolute right-4 top-4 rounded-full bg-rose-100/90 p-1.5 text-rose-500 hover:bg-rose-200 hover:text-rose-700 shadow-sm transition-colors dark:bg-rose-950/60 dark:text-rose-400"
                aria-label="Tutup notifikasi"
              >
                <X size={16} />
              </button>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 2, ease: "linear" }}
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-pink-500 to-violet-500"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setConfirmModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-900/95 backdrop-blur-xl"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl shadow-xs ${confirmModal.type === "logout"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400"
                    : "bg-rose-100 text-rose-500 dark:bg-rose-950/70 dark:text-rose-400"
                    }`}
                >
                  {confirmModal.type === "logout" ? <LogOut size={22} /> : <Trash2 size={22} />}
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <h3 className="text-base font-black text-foreground">
                    {confirmModal.type === "logout" && "Konfirmasi Logout"}
                    {confirmModal.type === "clear_sessions" && "Hapus Semua Sesi Foto"}
                    {confirmModal.type === "delete_voucher" && `Hapus Voucher ${confirmModal.voucherCode}`}
                    {confirmModal.type === "delete_frame" && `Hapus Frame ${confirmModal.frameLabel}`}
                    {confirmModal.type === "delete_filter" && `Hapus Filter ${confirmModal.filterLabel}`}
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-purple-600 dark:text-purple-300">
                    {confirmModal.type === "logout" && "Apakah Anda yakin ingin keluar dari Dashboard Admin PixieBooth?"}
                    {confirmModal.type === "clear_sessions" && "Tindakan ini akan menghapus riwayat sesi foto secara permanen."}
                    {confirmModal.type === "delete_voucher" && `Voucher ${confirmModal.voucherCode} akan dihapus dari database.`}
                    {confirmModal.type === "delete_frame" && `Frame ${confirmModal.frameLabel} akan dihapus dari database.`}
                    {confirmModal.type === "delete_filter" && `Filter ${confirmModal.filterLabel} akan dihapus dari database.`}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="rounded-full border border-gray-200 bg-white px-5 py-2 text-xs font-black text-foreground shadow-xs transition-colors hover:bg-gray-100 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmModal.onConfirm) {
                      confirmModal.onConfirm();
                    } else {
                      if (confirmModal.type === "logout") onLogout();
                      if (confirmModal.type === "clear_sessions") {
                        onClearSessions();
                        showActionResult("success", "Sesi Foto Dibersihkan 🧹", "Riwayat sesi foto telah berhasil dibersihkan.");
                      }
                      if (confirmModal.type === "delete_voucher" && confirmModal.voucherId) {
                        const code = confirmModal.voucherCode || "";
                        void onDeleteVoucher(confirmModal.voucherId)
                          .then(() => showActionResult("success", "Voucher Dihapus! 🗑️", `Voucher ${code} telah dihapus dari database.`))
                          .catch((error) => showActionResult("error", "Gagal Menghapus ❌", error.message));
                      }
                    }
                    setConfirmModal(null);
                  }}
                  className={`rounded-full px-5 py-2 text-xs font-black text-white shadow-md transition-transform active:scale-95 ${confirmModal.type === "logout"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    : "bg-[#e11d48] hover:bg-[#be123c] shadow-rose-200 dark:shadow-none"
                    }`}
                >
                  {confirmModal.type === "logout" && "Ya, Logout"}
                  {confirmModal.type === "clear_sessions" && "Ya, Hapus Semua Sesi"}
                  {confirmModal.type === "delete_voucher" && "Ya, Hapus Voucher"}
                  {confirmModal.type === "delete_frame" && "Ya, Hapus Frame"}
                  {confirmModal.type === "delete_filter" && "Ya, Hapus Filter"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-rose-100/90 text-rose-500 shadow-xs transition-colors hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-400"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionResultModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md"
            onClick={() => setActionResultModal(null)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-b from-white via-pink-50/90 to-purple-50/70 p-6 text-center shadow-2xl"
            >
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg ${actionResultModal.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400' : actionResultModal.type === 'error' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400'
                }`}>
                {actionResultModal.type === 'success' && '✨'}
                {actionResultModal.type === 'error' && '❌'}
                {actionResultModal.type === 'info' && '⚡'}
              </div>

              <h3 className="mt-4 text-lg font-black text-foreground">
                {actionResultModal.title}
              </h3>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">
                {actionResultModal.message}
              </p>

              <button
                type="button"
                onClick={() => setActionResultModal(null)}
                className={`mt-5 w-full rounded-2xl py-3 text-xs font-black text-white shadow-lg transition-transform hover:scale-[1.02] ${actionResultModal.type === 'success' ? 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600' : actionResultModal.type === 'error' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'
                  }`}
              >
                Tutup
              </button>

              <button
                onClick={() => setActionResultModal(null)}
                className="absolute right-4 top-4 rounded-full bg-rose-100/90 p-1.5 text-rose-500 hover:bg-rose-200 hover:text-rose-700 shadow-sm transition-colors dark:bg-rose-950/60 dark:text-rose-400"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>

              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 2.2, ease: "linear" }}
                className={`absolute bottom-0 left-0 h-1 ${actionResultModal.type === 'success' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : actionResultModal.type === 'error' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'
                  }`}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editVoucherModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-4 backdrop-blur-md"
            onClick={() => setEditVoucherModal(null)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative my-auto w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl border border-white/80 bg-gradient-to-b from-white via-pink-50/90 to-purple-50/70 p-6 shadow-2xl"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-violet-600 text-white shadow-xl">
                <Pencil size={24} />
              </div>
              <h3 className="mt-4 text-center text-lg font-black text-foreground">Edit Voucher</h3>
              <p className="mt-1 text-center font-mono text-xs font-bold text-muted-foreground">{editVoucherModal.code}</p>

              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs font-black text-foreground">
                    Tipe Diskon
                    <CustomSelect
                      value={editVoucherModal.discountType}
                      onChange={(val) => setEditVoucherModal((curr) => curr ? { ...curr, discountType: val as "fixed" | "percent" } : null)}
                      options={[
                        { value: "fixed", label: "Nominal (Rp)", badge: "Rp" },
                        { value: "percent", label: "Persentase (%)", badge: "%" },
                      ]}
                      className="mt-1"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-black text-foreground">
                    Nilai Diskon
                    <input
                      type="number"
                      min={1}
                      value={editVoucherModal.discountValue}
                      onChange={(e) => setEditVoucherModal((curr) => curr ? { ...curr, discountValue: Math.max(1, Number(e.target.value) || 1) } : null)}
                      className="mt-1 w-full rounded-xl border border-white bg-white/85 px-3 py-2.5 text-xs font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                    />
                  </label>
                </div>
                <label className="space-y-1 text-xs font-black text-foreground">
                  Kuota Penggunaan
                  <input
                    type="number"
                    min={1}
                    value={editVoucherModal.maxUses ?? ""}
                    onChange={(e) => setEditVoucherModal((curr) => curr ? { ...curr, maxUses: e.target.value ? Math.max(1, Number(e.target.value)) : null } : null)}
                    placeholder="Tanpa batas"
                    className="mt-1 w-full rounded-xl border border-white bg-white/85 px-3 py-2.5 text-xs font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                  />
                </label>
                <div className="space-y-2">
                  <label className="space-y-1 text-xs font-black text-foreground">
                    Mulai Berlaku
                    <CustomDateTimePicker
                      value={editVoucherModal.startsAt}
                      onChange={(val) => setEditVoucherModal((curr) => curr ? { ...curr, startsAt: val } : null)}
                      placeholder="Mulai sekarang"
                      className="mt-1"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-black text-foreground">
                    Kedaluwarsa
                    <CustomDateTimePicker
                      value={editVoucherModal.expiresAt}
                      onChange={(val) => setEditVoucherModal((curr) => curr ? { ...curr, expiresAt: val } : null)}
                      placeholder="Tanpa kedaluwarsa"
                      className="mt-1"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditVoucherModal(null)}
                  className="flex-1 rounded-2xl border border-white/60 bg-white/70 py-3 text-xs font-black text-muted-foreground transition-all hover:bg-white dark:bg-white/10"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={editVoucherModal.saving}
                  onClick={async () => {
                    setEditVoucherModal((curr) => curr ? { ...curr, saving: true } : null);
                    try {
                      await onUpdateVoucher(editVoucherModal.id, {
                        discountType: editVoucherModal.discountType,
                        discountValue: editVoucherModal.discountValue,
                        maxUses: editVoucherModal.maxUses,
                        startsAt: editVoucherModal.startsAt ? new Date(editVoucherModal.startsAt).toISOString() : null,
                        expiresAt: editVoucherModal.expiresAt ? new Date(editVoucherModal.expiresAt).toISOString() : null,
                      });
                      setEditVoucherModal(null);
                      showActionResult("success", "Voucher Berhasil Diperbarui! ✨", `Voucher ${editVoucherModal.code} telah berhasil diperbarui.`);
                    } catch (error) {
                      setEditVoucherModal((curr) => curr ? { ...curr, saving: false } : null);
                      showActionResult("error", "Gagal Memperbarui Voucher ❌", error instanceof Error ? error.message : "Voucher gagal diperbarui.");
                    }
                  }}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3 text-xs font-black text-white shadow-lg transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editVoucherModal.saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>

              <button
                onClick={() => setEditVoucherModal(null)}
                className="absolute right-4 top-4 rounded-full bg-rose-100/90 p-1.5 text-rose-500 hover:bg-rose-200 hover:text-rose-700 shadow-sm transition-colors dark:bg-rose-950/60 dark:text-rose-400"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPhoto(null)}
          >
            <img src={selectedPhoto} alt="Selected captured result" className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
            <button
              className="absolute right-5 top-5 rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/35"
              onClick={() => setSelectedPhoto(null)}
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
