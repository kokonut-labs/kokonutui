export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_EXPO_OUT = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
  marketing: 0.4,
} as const;

export const STAGGER = {
  tight: 0.05,
  base: 0.06,
  relaxed: 0.08,
} as const;

export const ANIMATION = {
  entrance: {
    duration: DURATION.marketing,
    ease: EASE_OUT,
  },
  onScreen: {
    duration: DURATION.slow,
    ease: EASE_IN_OUT,
  },
  ambient: {
    duration: 10,
    ease: "linear" as const,
    repeat: Number.POSITIVE_INFINITY,
  },
  spring: {
    snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
    gentle: { type: "spring" as const, stiffness: 200, damping: 20 },
    bouncy: { type: "spring" as const, stiffness: 300, damping: 15 },
  },
  stagger: {
    fast: STAGGER.tight,
    normal: STAGGER.base,
    slow: STAGGER.relaxed,
  },
} as const;
