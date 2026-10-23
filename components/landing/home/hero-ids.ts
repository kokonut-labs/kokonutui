/** The hero prototypes, in their own module so server pages can list them. */
export const HERO_IDS = ["a", "b", "c", "d"] as const;
export type HeroId = (typeof HERO_IDS)[number];
