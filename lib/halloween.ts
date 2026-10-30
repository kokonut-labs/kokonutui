"use client";

import { useEffect, useState } from "react";

/**
 * Halloween touches for the homepage. Each one turns itself on for October 31
 * in the visitor's own time zone and is gone on November 1, so nothing needs
 * to be reverted on the day.
 *
 * Preview any day with `?halloween=fright`, `?halloween=spider,ghost` or
 * `?halloween=all`; `?halloween=off` turns them off on the day.
 */
export type HalloweenIdea = "fright" | "spider" | "ghost";

const IDEAS: HalloweenIdea[] = ["fright", "spider", "ghost"];
/** What runs on October 31 itself. */
const ON_THE_DAY: HalloweenIdea[] = IDEAS;

function activeIdeas(): HalloweenIdea[] {
  const param = new URLSearchParams(window.location.search).get("halloween");
  if (param) {
    return param === "all"
      ? IDEAS
      : IDEAS.filter((idea) => param.split(",").includes(idea));
  }
  const now = new Date();
  return now.getMonth() === 9 && now.getDate() === 31 ? ON_THE_DAY : [];
}

/**
 * True once mounted on Halloween (or in a preview). It starts false on the
 * server and the first client render, so the page hydrates as it always does
 * and the touches arrive after.
 */
export function useHalloween(idea: HalloweenIdea) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(activeIdeas().includes(idea));
  }, [idea]);
  return on;
}
