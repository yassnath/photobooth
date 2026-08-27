import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, X, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CustomDateTimePickerProps {
  value: string; // Format 'YYYY-MM-DDTHH:mm' or ''
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function CustomDateTimePicker({
  value,
  onChange,
  placeholder = "Tanpa batas waktu",
  className = "",
}: CustomDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popDirection, setPopDirection] = useState<"up" | "down">("down");
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 370 && rect.top > 370) {
        setPopDirection("up");
      } else {
        setPopDirection("down");
      }
    }
    setIsOpen(!isOpen);
  };

  // Parse initial date or default to now
  const parsedDate = value ? new Date(value) : null;
  const validDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : new Date();

  const [viewYear, setViewYear] = useState<number>(validDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(validDate.getMonth()); // 0 - 11

  // Time state
  const [selectedHour, setSelectedHour] = useState<string>(
    parsedDate ? String(validDate.getHours()).padStart(2, "0") : "12"
  );
  const [selectedMinute, setSelectedMinute] = useState<string>(
    parsedDate ? String(validDate.getMinutes()).padStart(2, "0") : "00"
  );

  // Sync internal state when popover opens or value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
        setSelectedHour(String(d.getHours()).padStart(2, "0"));
        setSelectedMinute(String(d.getMinutes()).padStart(2, "0"));
      }
    }
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDisplayDate = (val: string) => {
    if (!val) return null;
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) return val;
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return val;
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  const selectDay = (dayNum: number) => {
    const monthStr = pad(viewMonth + 1);
    const dayStr = pad(dayNum);
    const isoString = `${viewYear}-${monthStr}-${dayStr}T${selectedHour}:${selectedMinute}`;
    onChange(isoString);
  };

  const updateTime = (hour: string, minute: string) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const yearStr = d.getFullYear();
        const monthStr = pad(d.getMonth() + 1);
        const dayStr = pad(d.getDate());
        onChange(`${yearStr}-${monthStr}-${dayStr}T${hour}:${minute}`);
      }
    }
  };

  const applyPreset = (daysAhead: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    const formatted = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${selectedHour}:${selectedMinute}`;
    onChange(formatted);
  };

  // Calendar Days Grid Logic
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const today = new Date();
  const isToday = (day: number) =>
    today.getDate() === day &&
    today.getMonth() === viewMonth &&
    today.getFullYear() === viewYear;

  const isSelected = (day: number) => {
    if (!value) return false;
    const d = new Date(value);
    return (
      !isNaN(d.getTime()) &&
      d.getDate() === day &&
      d.getMonth() === viewMonth &&
      d.getFullYear() === viewYear
    );
  };

  const formattedDisplay = formatDisplayDate(value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleOpen}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all outline-none ${
            value
              ? "border-primary/50 bg-pink-50/70 text-foreground shadow-sm dark:border-pink-500/30 dark:bg-pink-950/30"
              : "border-white/80 bg-white/85 text-muted-foreground hover:bg-white dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <CalendarIcon size={14} className={value ? "text-primary" : "text-muted-foreground"} />
            <span className="truncate">{formattedDisplay || placeholder}</span>
          </div>
          {value ? (
            <span className="rounded-full bg-pink-100 p-1 text-pink-600 dark:bg-pink-900/50 dark:text-pink-300">
              <Clock size={12} />
            </span>
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground">Pilih</span>
          )}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/60 bg-white/80 text-muted-foreground hover:bg-rose-50 hover:text-rose-500 dark:border-white/10 dark:bg-white/10"
            title="Hapus tanggal"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: popDirection === "up" ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: popDirection === "up" ? -4 : 4, scale: 1 }}
            exit={{ opacity: 0, y: popDirection === "up" ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute left-0 z-50 w-72 sm:w-80 max-h-[75vh] overflow-y-auto rounded-3xl border border-white/40 bg-gradient-to-b from-white via-pink-50/95 to-white p-4 shadow-2xl backdrop-blur-xl dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 ${
              popDirection === "up" ? "bottom-full mb-2" : "top-full mt-1"
            }`}
          >
            {/* Header: Month / Year Navigation */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="grid h-8 w-8 place-items-center rounded-xl border border-white/60 bg-white/70 text-foreground hover:bg-white dark:border-white/10 dark:bg-white/10"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center font-black">
                <span className="text-sm text-foreground">{MONTH_NAMES[viewMonth]}</span>
                <span className="ml-1.5 text-xs text-primary">{viewYear}</span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="grid h-8 w-8 place-items-center rounded-xl border border-white/60 bg-white/70 text-foreground hover:bg-white dark:border-white/10 dark:bg-white/10"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day Names Header */}
            <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-black uppercase text-muted-foreground">
              {DAY_NAMES.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="mt-1.5 grid grid-cols-7 gap-1 text-center text-xs font-bold">
              {/* Prev Month Padding Days */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
                const prevDay = daysInPrevMonth - firstDayOfWeek + idx + 1;
                return (
                  <span key={`prev-${idx}`} className="py-2 text-[11px] font-medium text-muted-foreground/30">
                    {prevDay}
                  </span>
                );
              })}

              {/* Current Month Days */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const active = isSelected(dayNum);
                const todayCurrent = isToday(dayNum);
                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    onClick={() => selectDay(dayNum)}
                    className={`relative grid h-8 w-full place-items-center rounded-xl text-xs transition-all ${
                      active
                        ? "bg-gradient-to-tr from-pink-500 to-violet-600 font-black text-white shadow-md scale-105"
                        : todayCurrent
                        ? "border border-pink-400 bg-pink-100/70 font-black text-pink-700 dark:bg-pink-950/60 dark:text-pink-300"
                        : "text-foreground hover:bg-pink-100/60 hover:text-pink-600 dark:hover:bg-white/10"
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Time Picker Section */}
            <div className="mt-3 border-t border-border/50 pt-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-foreground">
                  <Clock size={13} className="text-primary" /> Jam & Menit
                </span>
                <div className="flex items-center gap-1">
                  <select
                    value={selectedHour}
                    onChange={(e) => updateTime(e.target.value, selectedMinute)}
                    className="rounded-lg border border-pink-200 bg-white px-2 py-1 text-xs font-mono font-black text-foreground outline-none focus:border-primary dark:border-pink-900/40 dark:bg-gray-800"
                  >
                    {Array.from({ length: 24 }).map((_, h) => {
                      const hStr = pad(h);
                      return (
                        <option key={hStr} value={hStr}>
                          {hStr}
                        </option>
                      );
                    })}
                  </select>
                  <span className="font-bold text-foreground">:</span>
                  <select
                    value={selectedMinute}
                    onChange={(e) => updateTime(selectedHour, e.target.value)}
                    className="rounded-lg border border-pink-200 bg-white px-2 py-1 text-xs font-mono font-black text-foreground outline-none focus:border-primary dark:border-pink-900/40 dark:bg-gray-800"
                  >
                    {["00", "15", "30", "45", "59"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Time Presets */}
              <div className="mt-2 flex flex-wrap gap-1">
                {["00:00", "09:00", "12:00", "18:00", "23:59"].map((tStr) => {
                  const [h, m] = tStr.split(":");
                  const isCurTime = selectedHour === h && selectedMinute === m;
                  return (
                    <button
                      key={tStr}
                      type="button"
                      onClick={() => updateTime(h, m)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold transition-colors ${
                        isCurTime
                          ? "bg-primary text-white"
                          : "bg-black/5 text-muted-foreground hover:bg-black/10 dark:bg-white/10"
                      }`}
                    >
                      {tStr}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Presets Shortcuts */}
            <div className="mt-3 border-t border-border/50 pt-2.5">
              <p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Pintas Tambah Waktu</p>
              <div className="grid grid-cols-3 gap-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => applyPreset(1)}
                  className="rounded-lg border border-pink-100 bg-pink-50/80 px-2 py-1.5 text-pink-700 hover:bg-pink-100 dark:border-pink-900/40 dark:bg-pink-950/40 dark:text-pink-300"
                >
                  +1 Hari
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(7)}
                  className="rounded-lg border border-purple-100 bg-purple-50/80 px-2 py-1.5 text-purple-700 hover:bg-purple-100 dark:border-purple-900/40 dark:bg-purple-950/40 dark:text-purple-300"
                >
                  +7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(30)}
                  className="rounded-lg border border-violet-100 bg-violet-50/80 px-2 py-1.5 text-violet-700 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-300"
                >
                  +30 Hari
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
              {value && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="flex-1 rounded-xl border border-rose-200 bg-rose-50/60 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400"
                >
                  Hapus
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 py-2 text-xs font-black text-white shadow-md transition-transform hover:scale-[1.02]"
              >
                Selesai
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
