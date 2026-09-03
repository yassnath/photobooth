import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { BACKGROUND_PRESETS, getCaptureCount } from "../../data/photobooth";
import type {
  AdminAuditLog,
  BoothEvent,
  BoothMonitor,
  BoothThemeSettings,
  FilterPreset,
  OrderRecord,
  PhotoSession,
  TemplateOption,
  Voucher,
} from "../../types/photobooth";
import { detectGreenscreenSlotsFromCanvas, slotRectToFrameSlotRect } from "../../utils/greenscreenDetector";
import {
  type FilterBuilder,
  defaultBuilder,
  defaultFilterDraft,
  formatDate,
  formatOptionalDate,
  makeId,
} from "./DashboardUtils";
import type { ActionResultModalState, ConfirmModalState, EditVoucherModalState } from "./DashboardModals";
import { useDashboardCalculations } from "./useDashboardCalculations";

export type DashboardTab = "overview" | "orders" | "theme" | "gallery" | "vouchers" | "filters" | "frames" | "admins" | "monitoring";

export interface UseDashboardStateProps {
  filters: FilterPreset[];
  frames: TemplateOption[];
  sessions: PhotoSession[];
  orders?: OrderRecord[];
  vouchers?: Voucher[];
  admins?: any[];
  showLoginSuccess?: boolean;
  onCloseLoginSuccess?: () => void;
  onUpdateTheme: Dispatch<SetStateAction<BoothThemeSettings>>;
  onUpdateFilters: Dispatch<SetStateAction<FilterPreset[]>>;
  onUpdateFrames: Dispatch<SetStateAction<TemplateOption[]>>;
  onCreateVoucher: (v: Partial<Voucher>) => Promise<void>;
  onCreateAdmin: (a: { username: string; displayName: string; password: string }) => Promise<void>;
  onRefresh: () => void;
}

export function useDashboardState(props: UseDashboardStateProps) {
  const {
    filters, frames, sessions, orders, vouchers, admins,
    showLoginSuccess, onCloseLoginSuccess,
    onUpdateTheme, onUpdateFilters, onUpdateFrames,
    onCreateVoucher, onCreateAdmin, onRefresh,
  } = props;

  const [tab, setTab] = useState<DashboardTab>("overview");
  const [notice, setNotice] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const frameFormRef = useRef<HTMLDivElement>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [actionResultModal, setActionResultModal] = useState<ActionResultModalState | null>(null);
  const [editVoucherModal, setEditVoucherModal] = useState<EditVoucherModalState | null>(null);

  const [filterDraft, setFilterDraft] = useState<FilterPreset>(defaultFilterDraft);
  const [filterBuilder, setFilterBuilder] = useState<FilterBuilder>(defaultBuilder);

  const [voucherSaving, setVoucherSaving] = useState(false);
  const [voucherDraft, setVoucherDraft] = useState({
    code: "",
    discountType: "fixed" as "fixed" | "percent",
    discountValue: 5000,
    maxUses: 10 as number | null,
    startsAt: "",
    expiresAt: "",
  });

  const [adminSaving, setAdminSaving] = useState(false);
  const [adminDraft, setAdminDraft] = useState({ username: "", displayName: "", password: "" });

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

  const calculations = useDashboardCalculations({ sessions, orders, vouchers, admins });

  const allPhotoUrls = calculations.allPhotos.map((item) => item.photo);
  const asyncRefresh = async () => onRefresh();

  const showActionResult = (type: "success" | "error" | "info", title: string, message: string) => {
    setActionResultModal({ type, title, message });
  };

  useEffect(() => {
    if (!actionResultModal) return undefined;
    const timer = window.setTimeout(() => setActionResultModal(null), 3000);
    return () => window.clearTimeout(timer);
  }, [actionResultModal]);

  useEffect(() => {
    if (!showLoginSuccess) return undefined;
    const timer = window.setTimeout(() => onCloseLoginSuccess?.(), 3000);
    return () => window.clearTimeout(timer);
  }, [showLoginSuccess, onCloseLoginSuccess]);

  const saveNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const updateTheme = (patch: Partial<BoothThemeSettings>) => onUpdateTheme((c) => ({ ...c, ...patch }));

  const applyBackgroundPreset = (presetId: string) => {
    const preset = BACKGROUND_PRESETS.find((p) => p.id === presetId) || BACKGROUND_PRESETS[0];
    updateTheme({ backgroundPresetId: preset.id, background: preset });
  };

  const saveFilter = () => {
    const now = new Date().toISOString();
    const next: FilterPreset = {
      ...filterDraft,
      id: filterDraft.id.trim() || makeId("filter"),
      label: filterDraft.label.trim() || "Untitled Filter",
      css: filterDraft.css.trim(),
      source: filterDraft.source?.trim() || "Dashboard",
      createdAt: filterDraft.createdAt || now,
    };
    if (!next.css) {
      showActionResult("error", "CSS Filter Kosong ⚠️", "Masukkan sintaks CSS filter yang valid.");
      return;
    }
    onUpdateFilters((c) => {
      const e = c.some((f) => f.id === next.id);
      return e ? c.map((f) => (f.id === next.id ? next : f)) : [...c, next];
    });
    showActionResult("success", "Preset Filter Disimpan! ✨", `Filter "${next.label}" berhasil disimpan.`);
  };

  const saveFrame = () => {
    const next: TemplateOption = {
      ...frameDraft,
      id: frameDraft.id.trim() || makeId("frame"),
      label: frameDraft.label.trim() || "Untitled Frame",
      color: frameDraft.color || "#FCE7F3",
      accent: frameDraft.accent || "#EC4899",
      emoji: frameDraft.emoji || "✨",
      layout: frameDraft.layout || "all",
      chromaKeyGreen: frameDraft.chromaKeyGreen !== false,
      slots: frameDraft.slots?.length ? frameDraft.slots : undefined,
    };
    onUpdateFrames((c) => {
      const e = c.some((f) => f.id === next.id);
      return e ? c.map((f) => (f.id === next.id ? next : f)) : [...c, next];
    });
    showActionResult("success", "Template Frame Disimpan! 🖼️", `Frame "${next.label}" disimpan dengan ${next.slots?.length || 0} slot.`);
  };

  const scanAndLockSlots = (overlaySrc?: string) => {
    const src = overlaySrc || frameDraft.overlayImage;
    if (!src) {
      showActionResult("info", "Belum Ada Overlay ⚠️", "Unggah overlay PNG terlebih dahulu.");
      return;
    }
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const detected = detectGreenscreenSlotsFromCanvas(
        img,
        getCaptureCount(frameDraft.layout && frameDraft.layout !== "all" ? frameDraft.layout : "1x4"),
      );
      const locked = detected.map(slotRectToFrameSlotRect);
      setFrameDraft((c) => ({ ...c, slots: locked }));
      showActionResult("success", "Slot Greenscreen Terkunci! 🎯", `${locked.length} slot berhasil dideteksi.`);
    };
    img.onerror = () => showActionResult("error", "Gagal Memindai Gambar ❌", "Tidak dapat membaca gambar overlay.");
    img.src = src;
  };

  const loadFrameOverlay = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
      setFrameDraft((c) => ({ ...c, overlayImage: dataUrl }));
      if (dataUrl) scanAndLockSlots(dataUrl);
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
      setVoucherDraft((c) => ({ ...c, code: "" }));
      showActionResult("success", "Voucher Berhasil Ditambahkan! 🎉", `Kode voucher ${code} disimpan.`);
    } catch (e) {
      showActionResult("error", "Gagal Menambah Voucher ❌", e instanceof Error ? e.message : "Gagal.");
    } finally {
      setVoucherSaving(false);
    }
  };

  const saveAdmin = async () => {
    setAdminSaving(true);
    try {
      await onCreateAdmin({
        username: adminDraft.username.trim().toLowerCase(),
        displayName: adminDraft.displayName.trim(),
        password: adminDraft.password,
      });
      setAdminDraft({ username: "", displayName: "", password: "" });
      showActionResult("success", "Admin Berhasil Ditambahkan", "Akun admin baru sudah aktif.");
    } catch (e) {
      showActionResult("error", "Gagal Menambah Admin", e instanceof Error ? e.message : "Gagal.");
    } finally {
      setAdminSaving(false);
    }
  };

  const exportVouchersCsv = () => {
    const headers = ["Kode Voucher", "Tipe Diskon", "Nilai Diskon", "Penggunaan", "Mulai Berlaku", "Kedaluwarsa", "Status"];
    const rows = calculations.safeVouchers.map((v) => [
      v.code,
      v.discountType === "fixed" ? "Nominal (Rp)" : "Persentase (%)",
      v.discountType === "fixed" ? `Rp${v.discountValue}` : `${v.discountValue}%`,
      `${v.usedCount}/${v.maxUses ?? "Unlim"}`,
      v.startsAt ? formatDate(v.startsAt) : "Sekarang",
      v.expiresAt ? formatDate(v.expiresAt) : "Tanpa Batas",
      v.active ? "Aktif" : "Nonaktif",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
      download: `pixiebooth-voucher-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportOrdersCsv = () => {
    const headers = ["Order", "Status", "Metode", "Provider", "Harga", "Diskon", "Total", "Voucher", "Sesi", "Dibuat", "Dibayar", "Expired"];
    const statusLabel: Record<string, string> = { pending: "Menunggu", paid: "Lunas", expired: "Expired", failed: "Gagal" };
    const rows = calculations.safeOrders.map((o) => [
      o.orderId,
      statusLabel[o.status] || o.status,
      o.method.toUpperCase(),
      o.provider,
      String(o.baseAmount),
      String(o.discountAmount),
      String(o.amount),
      o.voucherCode || "-",
      o.sessionId || "-",
      formatOptionalDate(o.createdAt),
      formatOptionalDate(o.paidAt),
      formatOptionalDate(o.expiresAt),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
      download: `pixiebooth-orders-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return {
    tab, setTab,
    notice, saveNotice,
    selectedPhoto, setSelectedPhoto,
    frameFormRef,
    confirmModal, setConfirmModal,
    actionResultModal, setActionResultModal,
    editVoucherModal, setEditVoucherModal,
    filterDraft, setFilterDraft,
    filterBuilder, setFilterBuilder,
    voucherSaving, voucherDraft, setVoucherDraft,
    adminSaving, adminDraft, setAdminDraft,
    frameDraft, setFrameDraft,
    allPhotoUrls, asyncRefresh,
    showActionResult,
    updateTheme, applyBackgroundPreset,
    saveFilter, saveFrame, scanAndLockSlots, loadFrameOverlay,
    saveVoucher, saveAdmin,
    exportVouchersCsv, exportOrdersCsv,
    calculations,
  };
}
