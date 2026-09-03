import type {
  AdminSession,
  AdminAccount,
  AdminAuditLog,
  BoothMonitor,
  BoothEvent,
  BoothRuntimeConfig,
  BoothThemeSettings,
  FilterPreset,
  OrderRecord,
  PaymentRecord,
  PhotoSession,
  TemplateOption,
  Voucher,
} from "../../app/types/photobooth";
import { SAMPLE_BOOTHS, SAMPLE_SESSIONS, SAMPLE_VOUCHERS } from "../../app/data/photobooth";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Static fallback for deployments where the Vercel API is unavailable.
 * NOTE: Login is intentionally NOT handled here — credentials must be
 * verified by the live API/database. No hardcoded passwords.
 */
function handleStaticFallback<T>(path: string, init: RequestInit = {}): T | undefined {
  const method = (init.method || "GET").toUpperCase();

  // Auth: no static fallback — must hit the real API
  if (path === "/api/auth/login" && method === "POST") {
    return undefined;
  }

  if (path === "/api/auth/session") {
    const saved = localStorage.getItem("pixie_static_admin_session");
    if (saved) {
      try {
        const admin = JSON.parse(saved) as AdminSession;
        return { admin } as T;
      } catch {
        localStorage.removeItem("pixie_static_admin_session");
      }
    }
    throw new ApiError("Belum login.", 401);
  }

  if (path === "/api/auth/logout") {
    localStorage.removeItem("pixie_static_admin_session");
    return null as T;
  }

  if (path === "/api/admin/bootstrap") {
    const saved = localStorage.getItem("pixie_static_admin_session");
    const admin: AdminSession = saved
      ? JSON.parse(saved)
      : { id: "static-admin-1", username: "admin", displayName: "Booth Admin", loggedInAt: new Date().toISOString() };
    return {
      admin,
      config: { theme: null, filters: null, frames: null, sessionPrice: 25000 },
      sessions: SAMPLE_SESSIONS,
      orders: SAMPLE_SESSIONS.filter((session) => session.payment).map((session) => ({
        id: session.payment!.id,
        orderId: session.payment!.orderId || session.payment!.id,
        provider: session.payment!.provider || "mock",
        method: session.payment!.method,
        status: session.payment!.status || "paid",
        baseAmount: session.payment!.baseAmount || session.payment!.amount,
        discountAmount: session.payment!.discountAmount || 0,
        amount: session.payment!.amount,
        voucherCode: session.payment!.voucherCode,
        sessionId: session.id,
        resultFormat: session.resultFormat || "photo",
        frameLayout: session.frameLayout || null,
        createdAt: session.createdAt,
        updatedAt: session.createdAt,
        expiresAt: session.payment!.expiresAt || null,
        paidAt: session.payment!.paidAt || null,
      })),
      vouchers: SAMPLE_VOUCHERS,
      booths: SAMPLE_BOOTHS,
      admins: [],
      auditLogs: [],
      boothEvents: [],
    } as T;
  }

  if (path === "/api/admin/vouchers" && method === "POST") {
    let body: any = {};
    try {
      body = JSON.parse((init.body as string) || "{}");
    } catch {}
    const newVoucher: Voucher = {
      id: "v-" + Date.now(),
      code: String(body.code || "VOUCHER").trim().toUpperCase(),
      discountType: body.discountType || "fixed",
      discountValue: Number(body.discountValue) || 10000,
      maxUses: body.maxUses ?? null,
      usedCount: 0,
      active: true,
      startsAt: body.startsAt || null,
      expiresAt: body.expiresAt || null,
      createdAt: new Date().toISOString(),
    };
    return { voucher: newVoucher } as T;
  }

  if (path.startsWith("/api/admin/vouchers/") && method === "PATCH") {
    const id = decodeURIComponent(path.replace("/api/admin/vouchers/", ""));
    let body: any = {};
    try {
      body = JSON.parse((init.body as string) || "{}");
    } catch {}
    const updatedVoucher: Voucher = {
      id,
      code: String(body.code || "VOUCHER").trim().toUpperCase(),
      discountType: body.discountType || "fixed",
      discountValue: Number(body.discountValue) || 10000,
      maxUses: body.maxUses ?? null,
      usedCount: 0,
      active: body.active ?? true,
      startsAt: body.startsAt || null,
      expiresAt: body.expiresAt || null,
      createdAt: new Date().toISOString(),
    };
    return { voucher: updatedVoucher } as T;
  }

  if (path.startsWith("/api/admin/vouchers/") && method === "DELETE") {
    return null as T;
  }

  if (path.startsWith("/api/admin/")) {
    return { ok: true } as T;
  }

  return undefined;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retries = 1): Promise<T> {
  const targetUrl = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(targetUrl, requestInit);
      const payload = response.status === 204 ? null : await response.json().catch(() => null);

      if (!response.ok) {
        const apiErr = new ApiError(
          payload?.error || payload?.reason || `Request gagal dengan HTTP ${response.status}.`,
          response.status,
        );
        // Don't retry client errors (4xx) or fallback-able server errors
        if (response.status >= 400 && response.status < 500) throw apiErr;
        if (response.status === 405 || response.status === 404 || response.status === 502 || response.status === 503) {
          const fallback = handleStaticFallback<T>(path, init);
          if (fallback !== undefined) return fallback;
        }
        if (attempt < retries) {
          await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw apiErr;
      }
      return payload as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Network / timeout error
      if (attempt < retries) {
        await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
        continue;
      }
      const fallback = handleStaticFallback<T>(path, init);
      if (fallback !== undefined) return fallback;
      throw err;
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new ApiError("Request gagal.", 0);
}

export interface PaymentApiRecord extends PaymentRecord {
  orderId: string;
  provider: string;
  status: "pending" | "paid" | "expired" | "failed";
  baseAmount: number;
  discountAmount: number;
  expiresAt: string;
  qrString?: string;
  qrImageUrl?: string;
}

export interface VoucherQuote {
  valid: boolean;
  reason: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucher?: Voucher;
}

export interface AdminBootstrap {
  admin: AdminSession;
  config: {
    theme: BoothThemeSettings | null;
    filters: FilterPreset[] | null;
    frames: TemplateOption[] | null;
    sessionPrice: number;
  };
  sessions: PhotoSession[];
  orders: OrderRecord[];
  vouchers: Voucher[];
  booths: BoothMonitor[];
  admins: AdminAccount[];
  auditLogs: AdminAuditLog[];
  boothEvents: BoothEvent[];
}

export const photoboothApi = {
  getConfig: () => apiRequest<BoothRuntimeConfig>("/api/config"),
  login: (username: string, password: string) =>
    apiRequest<{ admin: AdminSession }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getAdminSession: () => apiRequest<{ admin: AdminSession }>("/api/auth/session"),
  logout: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),
  getAdminBootstrap: () => apiRequest<AdminBootstrap>("/api/admin/bootstrap"),
  updateConfig: (config: { theme?: BoothThemeSettings; filters?: FilterPreset[]; frames?: TemplateOption[] }) =>
    apiRequest<{ ok: true }>("/api/admin/config", { method: "PUT", body: JSON.stringify(config) }),
  createAdmin: (admin: { username: string; displayName: string; password: string }) =>
    apiRequest<{ admin: AdminAccount }>("/api/admin/admins", { method: "POST", body: JSON.stringify(admin) }),
  updateAdmin: (id: string, patch: { displayName?: string; password?: string; active?: boolean }) =>
    apiRequest<{ admin: AdminAccount }>(`/api/admin/admins/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deactivateAdmin: (id: string) => apiRequest<void>(`/api/admin/admins/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createVoucher: (voucher: {
    code: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    maxUses: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
  }) => apiRequest<{ voucher: Voucher }>("/api/admin/vouchers", { method: "POST", body: JSON.stringify(voucher) }),
  setVoucherActive: (id: string, active: boolean) =>
    apiRequest<{ voucher: Voucher }>(`/api/admin/vouchers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),
  updateVoucher: (id: string, patch: {
    discountType?: "fixed" | "percent";
    discountValue?: number;
    maxUses?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    active?: boolean;
  }) =>
    apiRequest<{ voucher: Voucher }>(`/api/admin/vouchers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteVoucher: (id: string) => apiRequest<void>(`/api/admin/vouchers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  clearSessions: () => apiRequest<void>("/api/admin/sessions", { method: "DELETE" }),
  quoteVoucher: (voucherCode: string) =>
    apiRequest<VoucherQuote>("/api/payments/quote", {
      method: "POST",
      body: JSON.stringify({ voucherCode }),
    }),
  createPayment: (voucherCode?: string) =>
    apiRequest<{ payment: PaymentApiRecord }>("/api/payments", {
      method: "POST",
      body: JSON.stringify({ voucherCode }),
    }),
  getPayment: (id: string) => apiRequest<{ payment: PaymentApiRecord }>(`/api/payments/${encodeURIComponent(id)}`),
  simulatePayment: (id: string) =>
    apiRequest<{ payment: PaymentApiRecord }>(`/api/payments/${encodeURIComponent(id)}/simulate`, { method: "POST" }),
  savePhotoSession: (session: PhotoSession) =>
    apiRequest<{ id: string; expiresAt: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(session),
    }),
};
