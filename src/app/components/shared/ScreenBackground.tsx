import type { ReactNode } from "react";

import { FloatingParticles } from "./FloatingParticles";

interface ScreenBackgroundProps {
  children: ReactNode;
  particles?: number;
  className?: string;
}

export function ScreenBackground({ children, particles = 0, className = "" }: ScreenBackgroundProps) {
  return (
    <div className={`relative min-h-[100dvh] overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-fuchsia-50 to-violet-50 dark:from-pink-950 dark:via-fuchsia-950 dark:to-violet-950" />
      {particles > 0 && <FloatingParticles count={particles} />}
      {children}
    </div>
  );
}
