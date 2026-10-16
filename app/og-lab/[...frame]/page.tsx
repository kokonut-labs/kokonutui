import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getParts, type Part } from "@/components/landing/home/parts";
import {
  CoverFrame,
  DocFrame,
  type FramePart,
  IndexFrame,
  PlatesFrame,
  type Theme,
} from "@/components/og/frames";

export const metadata: Metadata = { robots: "noindex, nofollow" };

const THEMES: Theme[] = ["light", "dark"];
const FEATURED = "apple-activity-card";
const PLATES = [
  "apple-activity-card",
  "liquid-gauge",
  "detent-dial",
  "tear-button",
];
/** Component pages to try the with-part docs image on. */
export const DOC_SAMPLES = [
  "apple-activity-card",
  "detent-dial",
  "ai-prompt",
  "tear-button",
];

export function generateStaticParams() {
  return [
    ...["cover", "plates", "index"].flatMap((frame) =>
      THEMES.map((theme) => ({ frame: [frame, theme] }))
    ),
    ...DOC_SAMPLES.flatMap((name) =>
      THEMES.map((theme) => ({ frame: ["doc", name, theme] }))
    ),
  ];
}

const toFrame = (p: Part): FramePart => ({
  code: p.code,
  name: p.name,
  title: p.title,
  category: p.category,
  description: p.description,
  dependencies: p.dependencies,
});

export default async function OgLabFrame({
  params,
}: {
  params: Promise<{ frame: string[] }>;
}) {
  // A design bench for link-preview images, not a page for visitors.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const { frame } = await params;
  const theme = frame.at(-1) as Theme;
  if (!THEMES.includes(theme)) {
    notFound();
  }
  const parts = getParts().map(toFrame);
  const byName = new Map(parts.map((p) => [p.name, p]));
  const pick = (name: string) => {
    const part = byName.get(name);
    if (!part) {
      notFound();
    }
    return part;
  };

  switch (frame[0]) {
    case "cover":
      return (
        <CoverFrame
          count={parts.length}
          featured={pick(FEATURED)}
          theme={theme}
        />
      );
    case "plates":
      return (
        <PlatesFrame
          count={parts.length}
          plates={PLATES.map(pick)}
          theme={theme}
        />
      );
    case "index":
      return <IndexFrame count={parts.length} parts={parts} theme={theme} />;
    case "doc":
      return <DocFrame part={pick(frame[1] ?? "")} theme={theme} />;
    default:
      notFound();
  }
}
