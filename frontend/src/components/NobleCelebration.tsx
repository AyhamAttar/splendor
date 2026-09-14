"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { NobleDef } from "@splendor/engine";
import { NobleTile } from "./NobleTile";

const GOLD = ["#ecd9a0", "#d9b45b", "#c19a3f", "#fff4d6"];

// Deterministic pseudo-random in [0, 1) from a seed — pure (unlike Math.random),
// so it can run during render, yet varied enough to keep the burst organic.
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The grandest reward in the game: a noble pledging to a player. This takes
 * over the screen with a dimmed backdrop, rotating god-rays, an impact flash,
 * expanding shockwaves, and a radial shower of gold particles, all orchestrated
 * with Motion spring physics. Falls back to a calm fade when the player has
 * requested reduced motion.
 */
export function NobleCelebration({
  noble,
  heading,
  reward,
}: {
  noble: NobleDef;
  heading: string;
  reward: string;
}) {
  const reduce = useReducedMotion();

  // Radial burst of gold motes. Angles are jittered so the ring never looks
  // mechanical; distance/size/timing vary to give the shower depth.
  const particles = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const angle = (i / 34) * Math.PI * 2 + (hash(i) - 0.5) * 0.4;
        const distance = 150 + hash(i + 1) * 260;
        return {
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: 4 + hash(i + 2) * 9,
          color: GOLD[i % GOLD.length],
          delay: hash(i + 3) * 0.14,
          duration: 0.9 + hash(i + 4) * 0.8,
          drift: 40 + hash(i + 5) * 60,
        };
      }),
    [],
  );

  // A handful of thin light shards that streak outward for extra energy.
  const shards = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        angle: (i / 10) * 360 + (hash(i + 20) - 0.5) * 18,
        length: 120 + hash(i + 21) * 120,
        delay: hash(i + 22) * 0.12,
      })),
    [],
  );

  const tileGlow = (
    <motion.div
      className="relative"
      initial={{ scale: 0.2, rotate: -14, opacity: 0 }}
      animate={{
        scale: reduce ? 1 : [0.2, 1.32, 1.42, 1.36],
        rotate: reduce ? 0 : [-14, 5, -2, 0],
        opacity: 1,
      }}
      exit={{ scale: 1.5, y: -40, opacity: 0 }}
      transition={
        reduce
          ? { duration: 0.4 }
          : {
              duration: 1.1,
              times: [0, 0.55, 0.78, 1],
              ease: [0.16, 1, 0.3, 1],
            }
      }
      style={{ willChange: "transform" }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(236,217,160,0.55), rgba(217,180,91,0.18) 55%, transparent 72%)",
          filter: "blur(6px)",
        }}
        animate={
          reduce
            ? { opacity: 0.6 }
            : { opacity: [0.4, 0.95, 0.7], scale: [0.8, 1.15, 1] }
        }
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
      <div className="relative drop-shadow-[0_18px_40px_rgba(3,7,18,0.7)]">
        <NobleTile noble={noble} />
      </div>
    </motion.div>
  );

  if (reduce) {
    return (
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="absolute inset-0 bg-navy-900/55" />
        <span className="ornament-label relative text-lg text-gold-300 drop-shadow-[0_1px_3px_rgba(3,7,18,0.85)]">
          {heading}
        </span>
        {tileGlow}
        <span className="relative font-display text-2xl font-bold text-gold-300 drop-shadow-[0_1px_3px_rgba(3,7,18,0.85)]">
          {reward}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Dimmed, warmly-lit backdrop that focuses the eye on the tile. */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(217,180,91,0.28), rgba(3,7,18,0.72) 60%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />

      {/* Slowly rotating god-rays behind everything. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax]"
        style={{
          translateX: "-50%",
          translateY: "-50%",
          background:
            "repeating-conic-gradient(from 0deg, rgba(236,217,160,0.16) 0deg 5deg, transparent 5deg 16deg)",
          filter: "blur(2px)",
          maskImage:
            "radial-gradient(circle, black 0%, black 22%, transparent 55%)",
          WebkitMaskImage:
            "radial-gradient(circle, black 0%, black 22%, transparent 55%)",
          willChange: "transform, opacity",
        }}
        initial={{ opacity: 0, rotate: 0, scale: 0.9 }}
        animate={{ opacity: [0, 0.9, 0.7], rotate: 34, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 3.4, ease: "easeOut" }}
      />

      {/* Impact flash at the moment of arrival. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 rounded-full"
        style={{
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle, rgba(255,244,214,0.95), rgba(236,217,160,0.4) 45%, transparent 70%)",
          willChange: "transform, opacity",
        }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 3.2], opacity: [0.95, 0] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* Expanding shockwave rings. */}
      {[0, 0.18, 0.36].map((delay, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 rounded-full"
          style={{
            translateX: "-50%",
            translateY: "-50%",
            border: "2px solid rgba(236,217,160,0.7)",
            boxShadow: "0 0 30px rgba(217,180,91,0.5)",
            willChange: "transform, opacity",
          }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 2.6], opacity: [0.8, 0] }}
          transition={{ duration: 1.4, delay, ease: "easeOut" }}
        />
      ))}

      {/* Light shards streaking outward. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
        {shards.map((s) => (
          <motion.span
            key={s.id}
            aria-hidden
            className="absolute left-0 top-0 origin-left"
            style={{
              rotate: `${s.angle}deg`,
              width: s.length,
              height: 2,
              background:
                "linear-gradient(90deg, rgba(255,244,214,0.9), transparent)",
              willChange: "transform, opacity",
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 0.6], opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.9, delay: s.delay, ease: "easeOut" }}
          />
        ))}
      </div>

      {/* Radial gold particle shower. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            aria-hidden
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              background: p.color,
              boxShadow: `0 0 ${p.size}px ${p.color}`,
              willChange: "transform, opacity",
            }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
            animate={{
              x: p.x,
              y: [0, p.y - p.drift, p.y],
              scale: [0, 1, 0.9, 0],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Heading eyebrow. */}
      <motion.span
        className="ornament-label relative text-lg text-gold-300 drop-shadow-[0_1px_3px_rgba(3,7,18,0.85)]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {heading}
      </motion.span>

      {tileGlow}

      {/* Reward line with a sweeping gold shimmer. */}
      <motion.span
        className="noble-reward-shimmer relative bg-clip-text font-display text-3xl font-black tracking-wide text-transparent drop-shadow-[0_2px_6px_rgba(3,7,18,0.9)]"
        initial={{ opacity: 0, y: 18, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 18,
          delay: 0.45,
        }}
      >
        {reward}
      </motion.span>
    </motion.div>
  );
}
