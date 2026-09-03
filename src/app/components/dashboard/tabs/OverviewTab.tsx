import { Calendar } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BoothThemeSettings, FilterPreset, PhotoSession } from "../../../types/photobooth";

export type TimeRangeOption = "7d" | "14d" | "30d" | "monthly" | "all";

interface OverviewTabProps {
  timeRange: TimeRangeOption;
  setTimeRange: (range: TimeRangeOption) => void;
  todaySessions: PhotoSession[];
  sessions: PhotoSession[];
  allPhotos: string[];
  totalRevenue: number;
  filters: FilterPreset[];
  frames: unknown[];
  chartData: Array<{ label: string; sessions: number; revenue: number }>;
  layoutDistributionData: Array<{ name: string; value: number }>;
  formatDistributionData: Array<{ name: string; value: number }>;
  hourlyTrafficData: Array<{ hour: string; sessions: number }>;
  uiTheme: BoothThemeSettings;
  onClearSessions: () => void;
  onSelectPhoto: (photo: string) => void;
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-xl font-black leading-tight text-foreground sm:text-3xl">{value}</p>
    </div>
  );
}

export function OverviewTab({
  timeRange,
  setTimeRange,
  todaySessions,
  sessions,
  allPhotos,
  totalRevenue,
  filters,
  frames,
  chartData,
  layoutDistributionData,
  formatDistributionData,
  hourlyTrafficData,
  uiTheme,
  onClearSessions,
  onSelectPhoto,
}: OverviewTabProps) {
  const rangeLabelMap: Record<TimeRangeOption, string> = {
    "7d": "7 Hari Terakhir",
    "14d": "14 Hari Terakhir",
    "30d": "30 Hari Terakhir",
    monthly: "12 Bulan Terakhir",
    all: "Semua Data",
  };

  const rangeText = rangeLabelMap[timeRange] || "Semua Data";

  return (
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
        <MetricCard label="Foto hari ini" value={todaySessions.length} />
        <MetricCard label="Total session" value={sessions.length} />
        <MetricCard label="Total hasil" value={allPhotos.length} />
        <MetricCard label="Total Omset" value={`Rp${totalRevenue.toLocaleString("id-ID")}`} />
        <MetricCard label="Filter aktif" value={filters.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
          <h2 className="mb-4 text-lg font-black text-foreground">
            Traffic Pengguna ({rangeText})
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
            Pendapatan ({rangeText})
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
    </section>
  );
}
