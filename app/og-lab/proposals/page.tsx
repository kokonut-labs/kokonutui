import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { META } from "@/components/landing/home/styles";
import { PROPOSALS } from "@/components/og/proposal-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Link preview proposals",
  robots: "noindex, nofollow",
};

const BOX =
  "relative h-[315px] w-[600px] overflow-hidden border border-black/10 dark:border-white/10";

/** New directions for the homepage's link preview, light and dark, at half size. */
export default function OgProposals() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-[40px] tracking-[-0.04em]">
          Link preview proposals
        </h1>
        <p className={cn(META, "text-[13px]")}>
          Each frame is 1200 by 630, shown at half size. Open one for full size.
          To ship one: OG_PATH=/og-lab/proposals/&lt;id&gt;/light bun run og.
          The current image is at /og-lab.
        </p>
      </header>
      {PROPOSALS.map((proposal) => (
        <section className="flex flex-col gap-3" key={proposal.id}>
          <div className="flex items-baseline gap-3">
            <h2 className="font-medium text-[20px] tracking-[-0.02em]">
              {proposal.label}
            </h2>
            <p className={cn(META, "text-[13px]")}>{proposal.note}</p>
          </div>
          <div className="flex flex-wrap gap-4">
            {(["light", "dark"] as const).map((theme) => {
              const src = `/og-lab/proposals/${proposal.id}/${theme}`;
              return (
                <a className={BOX} href={src} key={theme}>
                  <iframe
                    className="pointer-events-none absolute top-0 left-0 h-[630px] w-[1200px] origin-top-left scale-50"
                    src={src}
                    tabIndex={-1}
                    title={`${proposal.label}, ${theme}`}
                  />
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
