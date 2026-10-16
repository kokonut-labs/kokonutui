import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getParts } from "@/components/landing/home/parts";
import { CoverFrame, type Theme } from "@/components/og/frames";

export const metadata: Metadata = { robots: "noindex, nofollow" };

const THEMES: Theme[] = ["light", "dark"];
/** The part on the cover, as on the homepage. */
const FEATURED = "apple-activity-card";

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
  const parts = getParts();
  const featured = parts.find((p) => p.name === FEATURED);
  if (!(featured && THEMES.includes(theme as Theme))) {
    notFound();
  }
  return (
    <CoverFrame
      count={parts.length}
      featured={{
        code: featured.code,
        name: featured.name,
        title: featured.title,
        category: featured.category,
        dependencies: featured.dependencies,
      }}
      theme={theme as Theme}
    />
  );
}
