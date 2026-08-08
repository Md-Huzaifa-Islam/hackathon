import { useReducedMotion, type Variants } from "motion/react";

export const animationTokens = {
  durations: {
    fast: 0.12,
    base: 0.22,
    slow: 0.4,
  },
  easings: {
    snappy: "easeOut",
    smooth: "easeInOut",
  },
  variants: {
    fadeInUp: {
      hidden: { opacity: 0, y: 12 },
      visible: { opacity: 1, y: 0 },
    } satisfies Variants,
    scaleIn: {
      hidden: { opacity: 0, scale: 0.97 },
      visible: { opacity: 1, scale: 1 },
    } satisfies Variants,
    staggerContainer: {
      hidden: { opacity: 1 },
      visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
    } satisfies Variants,
  },
} as const;

export function useAnimationTokens() {
  const prefersReducedMotion = useReducedMotion();

  return {
    durations: animationTokens.durations,
    easings: animationTokens.easings,
    variants: {
      fadeInUp: prefersReducedMotion
        ? ({ hidden: { opacity: 0 }, visible: { opacity: 1 } } satisfies Variants)
        : animationTokens.variants.fadeInUp,
      scaleIn: prefersReducedMotion
        ? ({ hidden: { opacity: 0 }, visible: { opacity: 1 } } satisfies Variants)
        : animationTokens.variants.scaleIn,
      staggerContainer: prefersReducedMotion
        ? ({ hidden: { opacity: 1 }, visible: { opacity: 1 } } satisfies Variants)
        : animationTokens.variants.staggerContainer,
    },
  };
}
