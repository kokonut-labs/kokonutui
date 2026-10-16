import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { META } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Link previews",
  robots: "noindex, nofollow",
};

const DOC_PAGES = [
  "cards/apple-activity-card",
  "ai/ai-prompt",
  "buttons/tear-button",
  "changelog",
  "agents",
  "",
];

const BOX = "h-[315px] w-[600px] border border-black/10 dark:border-white/10";

/** The link previews at half size: the homepage's, then a few docs pages'. */
export default function OgLab() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-[40px] tracking-[-0.04em]">
          Link previews
        </h1>
        <p className={cn(META, "text-[13px]")}>
          The homepage image is a screenshot of the cover frame: run `bun run
          og` after changing it. Docs images are drawn per page by /docs-og.
        </p>
      </header>
      <section className="flex flex-wrap gap-4">
        {(["light", "dark"] as const).map((theme) => (
          <a
            className={cn(BOX, "relative overflow-hidden")}
            href={`/og-lab/cover/${theme}`}
            key={theme}
          >
            <iframe
              className="pointer-events-none absolute top-0 left-0 h-[630px] w-[1200px] origin-top-left scale-50"
              src={`/og-lab/cover/${theme}`}
              tabIndex={-1}
              title={`Homepage preview, ${theme}`}
            />
          </a>
        ))}
      </section>
      <section className="flex flex-wrap gap-4">
        {DOC_PAGES.map((page) => {
          const src = `/docs-og/${page ? `${page}/` : ""}image.png`;
          return (
            <a href={src} key={page}>
              {/* biome-ignore lint/performance/noImgElement: generated PNGs at their own size */}
              <img
                alt={`Preview for /docs/${page}`}
                className={BOX}
                height={315}
                src={src}
                width={600}
              />
            </a>
          );
        })}
      </section>
    </main>
  );
}
