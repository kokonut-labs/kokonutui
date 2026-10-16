import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { META } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Link previews",
  robots: "noindex, nofollow",
};

const SITE = [
  { id: "cover", label: "A. Cover", note: "The homepage's first screen" },
  { id: "plates", label: "B. Plates", note: "The headline beside four parts" },
  { id: "index", label: "C. Index", note: "The wordmark over the catalog" },
];
const DOC_STILLS = [
  "apple-activity-card",
  "detent-dial",
  "ai-prompt",
  "tear-button",
];
const DOC_PAGES = [
  "cards/apple-activity-card",
  "ai/ai-prompt",
  "buttons/tear-button",
  "changelog",
  "agents",
  "",
];

/** Every frame at half size, light beside dark, for choosing between them. */
function Frame({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative h-[315px] w-[600px] overflow-hidden border border-black/10 dark:border-white/10">
      <iframe
        className="pointer-events-none absolute top-0 left-0 h-[630px] w-[1200px] origin-top-left scale-50"
        src={src}
        tabIndex={-1}
        title={title}
      />
    </div>
  );
}

function Pair({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-[15px]">{label}</h2>
      <div className="flex flex-wrap gap-4">{children}</div>
    </section>
  );
}

export default function OgLab() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-[40px] tracking-[-0.04em]">
          Link previews
        </h1>
        <p className={cn(META, "text-[13px]")}>
          Frames are drawn at 1200 by 630 and shown here at half size. Open one
          on its own, or run `bun run og` to screenshot them into .og-out/.
        </p>
      </header>

      <h2 className="border-t pt-6 font-semibold text-[24px] tracking-[-0.03em]">
        Homepage image (screenshot)
      </h2>
      {SITE.map((frame) => (
        <Pair key={frame.id} label={`${frame.label}: ${frame.note}`}>
          {(["light", "dark"] as const).map((theme) => (
            <a href={`/og-lab/${frame.id}/${theme}`} key={theme}>
              <Frame
                src={`/og-lab/${frame.id}/${theme}`}
                title={`${frame.label} ${theme}`}
              />
            </a>
          ))}
        </Pair>
      ))}

      <h2 className="border-t pt-6 font-semibold text-[24px] tracking-[-0.03em]">
        Docs pages, type only (next/og, every page)
      </h2>
      {(["light", "dark"] as const).map((theme) => (
        <Pair key={theme} label={theme === "light" ? "Light" : "Dark"}>
          {DOC_PAGES.map((page) => {
            const src = `/og-lab/docs-type/${theme}/${page ? `${page}/` : ""}image.png`;
            return (
              <a href={src} key={page}>
                {/* biome-ignore lint/performance/noImgElement: generated PNGs at their own size */}
                <img
                  alt={`Preview for /docs/${page}`}
                  className="h-[315px] w-[600px] border border-black/10 dark:border-white/10"
                  height={315}
                  src={src}
                  width={600}
                />
              </a>
            );
          })}
        </Pair>
      ))}

      <h2 className="border-t pt-6 font-semibold text-[24px] tracking-[-0.03em]">
        Component pages, with the part (screenshot)
      </h2>
      {DOC_STILLS.map((name) => (
        <Pair key={name} label={name}>
          {(["light", "dark"] as const).map((theme) => (
            <a href={`/og-lab/doc/${name}/${theme}`} key={theme}>
              <Frame
                src={`/og-lab/doc/${name}/${theme}`}
                title={`${name} ${theme}`}
              />
            </a>
          ))}
        </Pair>
      ))}
    </main>
  );
}
