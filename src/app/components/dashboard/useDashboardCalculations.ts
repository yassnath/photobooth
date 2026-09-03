import { useMemo, useState } from "react";
import type { AdminAccount, OrderRecord, PhotoSession, Voucher } from "../../types/photobooth";
import { isToday, toTimestamp } from "./DashboardUtils";

export type TimeRangeOption = "7d" | "14d" | "30d" | "monthly" | "all";

interface UseDashboardCalculationsParams {
  sessions: PhotoSession[];
  orders?: OrderRecord[];
  vouchers?: Voucher[];
  admins?: AdminAccount[];
}

export function useDashboardCalculations({
  sessions,
  orders,
  vouchers,
  admins,
}: UseDashboardCalculationsParams) {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("14d");

  const todaySessions = useMemo(
    () => sessions.filter((session) => isToday(session.createdAt)),
    [sessions],
  );

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

  const safeOrders = useMemo<OrderRecord[]>(() => {
    const map = new Map<string, OrderRecord>();
    (orders || []).forEach((order) => {
      if (!order?.id || !order.orderId) return;
      map.set(order.id, order);
    });
    sessions.forEach((session) => {
      if (!session.payment?.id || map.has(session.payment.id)) return;
      map.set(session.payment.id, {
        id: session.payment.id,
        orderId: session.payment.orderId || session.payment.id,
        provider: session.payment.provider || "local",
        method: session.payment.method,
        status: session.payment.status || "paid",
        baseAmount: session.payment.baseAmount || session.payment.amount,
        discountAmount: session.payment.discountAmount || 0,
        amount: session.payment.amount,
        voucherCode: session.payment.voucherCode,
        sessionId: session.id,
        resultFormat: session.resultFormat || "photo",
        frameLayout: session.frameLayout || null,
        createdAt: session.createdAt,
        updatedAt: session.createdAt,
        expiresAt: session.payment.expiresAt || null,
        paidAt: session.payment.paidAt || null,
      });
    });
    return [...map.values()].sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));
  }, [orders, sessions]);

  const todayOrders = useMemo(
    () => safeOrders.filter((order) => Boolean(order.createdAt && isToday(order.createdAt))),
    [safeOrders],
  );

  const pendingOrderCount = safeOrders.filter((order) => order.status === "pending").length;
  const paidOrderRevenue = safeOrders.reduce((sum, order) => sum + (order.status === "paid" ? order.amount : 0), 0);

  const safeVouchers = useMemo(
    () => (vouchers || []).filter((v): v is Voucher => Boolean(v && v.code)),
    [vouchers],
  );

  const safeAdmins = useMemo(
    () => (admins || []).filter((admin): admin is AdminAccount => Boolean(admin && admin.username)),
    [admins],
  );

  const activeAdminCount = useMemo(
    () => safeAdmins.filter((admin) => admin.active).length,
    [safeAdmins],
  );

  return {
    timeRange,
    setTimeRange,
    todaySessions,
    allPhotos,
    filteredSessions,
    chartData,
    layoutDistributionData,
    hourlyTrafficData,
    totalRevenue,
    safeOrders,
    todayOrders,
    pendingOrderCount,
    paidOrderRevenue,
    safeVouchers,
    safeAdmins,
    activeAdminCount,
  };
}
