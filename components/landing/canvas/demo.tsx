"use client";

import { Suspense } from "react";
import { LIVE, LiveFallback } from "@/components/landing/home/live";
import type { Part } from "@/components/landing/home/parts";
import { LazyDemo } from "@/components/mdx/lazy-demo";

/**
 * Any component, live: the homepage's tuned entry when it has one, otherwise
 * the component as `shadcn add` delivers it, with its own demo data.
 * Backgrounds get a box to fill, since they size to their parent.
 */
export function PartDemo({
  part,
  fill = false,
}: {
  part: Part;
  /** Fill the parent instead of a fixed box, for a background. */
  fill?: boolean;
}) {
  const entry = LIVE[part.name];
  if (fill) {
    return (
      <LazyDemo
        className="absolute inset-0 h-full min-h-0 w-full"
        demo={`kokonutui/${part.name}`}
      />
    );
  }
  if (entry) {
    const Demo = entry.Component;
    return (
      <Suspense fallback={<LiveFallback />}>
        <Demo />
      </Suspense>
    );
  }
  if (part.categorySlug === "backgrounds") {
    return (
      <div className="relative h-[360px] w-[560px] overflow-hidden">
        <LazyDemo
          className="absolute inset-0 h-full min-h-0 w-full"
          demo={`kokonutui/${part.name}`}
        />
      </div>
    );
  }
  return <LazyDemo demo={`kokonutui/${part.name}`} />;
}

/** Look parts up by name, in the order given, skipping any that are gone. */
export function pickParts(parts: Part[], names: string[]) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  return names.flatMap((name) => byName.get(name) ?? []);
}
