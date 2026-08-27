import { useMemo } from "react";
import { motion } from "motion/react";

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 72 }, (_, index) => ({
        id: index,
        x: `${(index * 1.39) % 100}%`,
        color: ["#FD8EC4", "#C4B5FD", "#BAE6FD", "#FDE68A", "#A7F3D0", "#FECBA1", "#F9A8D4", "#DDD6FE"][
          index % 8
        ],
        width: 5 + (index % 5) * 2,
        height: 4 + (index % 4) * 3,
        duration: 1.4 + (index % 5) * 0.3,
        delay: (index % 24) * 0.08,
        round: index % 3 === 0,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          className={piece.round ? "absolute rounded-full" : "absolute rounded-sm"}
          style={{
            left: piece.x,
            top: -20,
            width: piece.width,
            height: piece.height,
            backgroundColor: piece.color,
          }}
          initial={{ y: 0, rotate: 0, x: 0 }}
          animate={{
            y: "108vh",
            rotate: 360 * (piece.id % 2 === 0 ? 1 : -1),
            x: (piece.id % 2 === 0 ? 1 : -1) * 40 * Math.sin(piece.id * 0.8),
          }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: "linear" }}
        />
      ))}
    </div>
  );
}
