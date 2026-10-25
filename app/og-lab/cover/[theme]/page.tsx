import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getParts } from "@/components/landing/home/parts";
import { CoverFrame, type Theme } from "@/components/og/frames";

export const metadata: Metadata = { robots: "noindex, nofollow" };

const THEMES: Theme[] = ["light", "dark"];
/** The parts on the cover: one or two from each of several shelves. */
const FEATURED = [
  "pull-cord",
  "apple-activity-card",
  "wheel-picker",
  "detent-dial",
  "bell-button",
  "liquid-gauge",
];
/** The part the install line names. */
const INSTALL = "slide-to-confirm";

export function generateStaticParams() {
  return THEMES.map((theme) => ({ theme }));
}

export default async function CoverImage({
  params,
}: {
  params: Promise<{ theme: string }>;
}) {
  // A bench for drawing the link preview (bun run og), not a page for visitors.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const { theme } = await params;
  if (!THEMES.includes(theme as Theme)) {
    notFound();
  }
  const parts = getParts();
  const featured = FEATURED.flatMap((name) => {
    const part = parts.find((p) => p.name === name);
    return part
      ? [
          {
            code: part.code,
            name: part.name,
            title: part.title,
            category: part.category,
            dependencies: part.dependencies,
          },
        ]
      : [];
  });
  return (
    <CoverFrame
      categories={new Set(parts.map((p) => p.categorySlug)).size}
      count={parts.length}
      install={INSTALL}
      parts={featured}
      theme={theme as Theme}
    />
  );
}
