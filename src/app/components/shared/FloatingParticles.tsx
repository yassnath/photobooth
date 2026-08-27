import { useMemo } from "react";
import { motion } from "motion/react";

import { FLOAT_EMOJIS } from "../../data/photobooth";

interface FloatingParticlesProps {
  count?: number;
}

export function FloatingParticles({ count = 12 }: FloatingParticlesProps) {
  const points = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        emoji: FLOAT_EMOJIS[index % FLOAT_EMOJIS.length],
        left: `${((index * 7.3) % 88) + 6}%`,
        top: `${((index * 6.1) % 84) + 8}%`,
        duration: 2.8 + ((index * 0.41) % 3.2),
        delay: (index * 0.28) % 2.5,
        size: 16 + (index % 3) * 6,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {points.map((point) => (
        <motion.span
          key={point.id}
          className="absolute select-none"
          style={{ left: point.left, top: point.top, fontSize: point.size }}
          animate={{ y: [-14, 14, -14], rotate: [-8, 8, -8], opacity: [0.45, 0.9, 0.45] }}
          transition={{
            duration: point.duration,
            repeat: Infinity,
            delay: point.delay,
            ease: "easeInOut",
          }}
        >
          {point.emoji}
        </motion.span>
      ))}
    </div>
  );
}
