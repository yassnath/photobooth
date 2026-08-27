import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih opsi...",
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/80 bg-white/85 px-3 py-2.5 text-xs font-bold text-foreground shadow-sm transition-all hover:bg-white focus:border-primary focus:outline-none dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
      >
        <div className="flex min-w-0 items-center gap-2">
          {selectedOption?.icon && <span className="shrink-0 text-primary">{selectedOption.icon}</span>}
          {selectedOption?.badge && (
            <span className="shrink-0 rounded-md bg-pink-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-pink-600 dark:bg-pink-950/60 dark:text-pink-300">
              {selectedOption.badge}
            </span>
          )}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 z-50 overflow-hidden rounded-2xl border border-white/40 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/95"
          >
            <div className="max-h-56 space-y-1 overflow-y-auto scrollbar-hide">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                      isSelected
                        ? "bg-gradient-to-r from-pink-500/15 to-violet-500/15 text-primary dark:from-pink-500/25 dark:to-violet-500/25"
                        : "text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {option.icon && <span className={isSelected ? "text-primary" : "text-muted-foreground"}>{option.icon}</span>}
                      {option.badge && (
                        <span className="shrink-0 rounded-md bg-pink-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-pink-600 dark:bg-pink-950/60 dark:text-pink-300">
                          {option.badge}
                        </span>
                      )}
                      <span className="truncate">{option.label}</span>
                    </div>
                    {isSelected && <Check size={14} className="shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
