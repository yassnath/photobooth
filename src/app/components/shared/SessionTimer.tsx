import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

interface SessionTimerProps {
  endsAt: number;
  compact?: boolean;
}

function getRemainingSeconds(endsAt: number) {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function SessionTimer({ endsAt, compact = false }: SessionTimerProps) {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(endsAt));

  useEffect(() => {
    setRemaining(getRemainingSeconds(endsAt));
    const timer = window.setInterval(() => setRemaining(getRemainingSeconds(endsAt)), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const urgent = remaining <= 60;

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-black tabular-nums backdrop-blur-sm ${
        urgent ? "border-red-300 bg-red-500/90 text-white" : "border-white/30 bg-black/35 text-white"
      } ${compact ? "text-[11px]" : "text-xs"}`}
      aria-label={`Sisa waktu sesi ${minutes} menit ${seconds} detik`}
    >
      <Clock3 size={compact ? 13 : 14} />
      <span>{minutes}:{seconds.toString().padStart(2, "0")}</span>
    </div>
  );
}
