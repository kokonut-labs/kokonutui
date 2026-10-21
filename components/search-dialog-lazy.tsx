"use client";

import type { SharedProps } from "fumadocs-ui/contexts/search";
import { lazy, Suspense } from "react";

// The search client and its index reader load after the page hydrates, so
// they stay out of every page's first download.
const StaticSearchDialog = lazy(() => import("@/components/search-dialog"));

export default function LazySearchDialog(props: SharedProps) {
  return (
    <Suspense fallback={null}>
      <StaticSearchDialog {...props} />
    </Suspense>
  );
}
