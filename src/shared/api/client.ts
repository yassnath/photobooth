import type {
  AdminSession,
  BoothMonitor,
  BoothRuntimeConfig,
  BoothThemeSettings,
  FilterPreset,
  PaymentRecord,
  PhotoSession,
  TemplateOption,
  Voucher,
} from "../../app/types/photobooth";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.error || payload?.reason || `Request gagal dengan HTTP ${response.status}.`, response.status);
  }
  return payload as T;
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
  vouchers: Voucher[];
  booths: BoothMonitor[];
}

export const photoboothApi = {
  getConfig: () => apiRequest<BoothRuntimeConfig>("/api/config"),
  login: (username: string, password: string) => apiRequest<{ admin: AdminSession }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  }),
  getAdminSession: () => apiRequest<{ admin: AdminSession }>("/api/auth/session"),
  logout: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),
  getAdminBootstrap: () => apiRequest<AdminBootstrap>("/api/admin/bootstrap"),
  updateConfig: (config: { theme?: BoothThemeSettings; filters?: FilterPreset[]; frames?: TemplateOption[] }) =>
    apiRequest<{ ok: true }>("/api/admin/config", { method: "PUT", body: JSON.stringify(config) }),
  createVoucher: (voucher: {
    code: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    maxUses: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
  }) => apiRequest<{ voucher: Voucher }>("/api/admin/vouchers", { method: "POST", body: JSON.stringify(voucher) }),
  setVoucherActive: (id: string, active: boolean) => apiRequest<{ voucher: Voucher }>(`/api/admin/vouchers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  }),
  deleteVoucher: (id: string) => apiRequest<void>(`/api/admin/vouchers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  clearSessions: () => apiRequest<void>("/api/admin/sessions", { method: "DELETE" }),
  quoteVoucher: (voucherCode: string) => apiRequest<VoucherQuote>("/api/payments/quote", {
    method: "POST",
    body: JSON.stringify({ voucherCode }),
  }),
  createPayment: (voucherCode?: string) => apiRequest<{ payment: PaymentApiRecord }>("/api/payments", {
    method: "POST",
    body: JSON.stringify({ voucherCode }),
  }),
  getPayment: (id: string) => apiRequest<{ payment: PaymentApiRecord }>(`/api/payments/${encodeURIComponent(id)}`),
  simulatePayment: (id: string) => apiRequest<{ payment: PaymentApiRecord }>(`/api/payments/${encodeURIComponent(id)}/simulate`, { method: "POST" }),
  savePhotoSession: (session: PhotoSession) => apiRequest<{ id: string; expiresAt: string }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(session),
  }),
};
