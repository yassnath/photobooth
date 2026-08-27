import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, X, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CustomDateTimePickerProps {
  value: string; // ISO string format 'YYYY-MM-DDTHH:mm' or empty string
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function CustomDateTimePicker({
  value,
  onChange,
  placeholder = "Tanpa batas waktu",
  className = "",
}: CustomDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const applyPreset = (daysAhead: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    // Format to YYYY-MM-DDTHH:mm for datetime-local
    const pad = (num: number) => String(num).padStart(2, "0");
    const formatted = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
    onChange(formatted);
  };

  const formattedDisplay = formatDisplayDate(value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
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
            <span className="rounded-full bg-pink-100 p-1 text-pink-600 hover:bg-pink-200 dark:bg-pink-900/50 dark:text-pink-300">
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
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 z-50 overflow-hidden rounded-2xl border border-white/40 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/95"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon size={14} className="text-primary" /> Pengaturan Waktu
                </span>
                {value && (
                  <button
                    type="button"
                    onClick={() => onChange("")}
                    className="text-[11px] font-bold text-rose-500 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              <input
                type="datetime-local"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-pink-200 bg-pink-50/50 px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-pink-900/40 dark:bg-pink-950/40"
              />

              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase text-muted-foreground">Pintas Tanggal</p>
                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
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

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 py-2 text-xs font-black text-white shadow-md transition-transform hover:scale-[1.02]"
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
