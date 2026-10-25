import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getParts } from "@/components/landing/home/parts";
import { PROPOSALS } from "@/components/landing/proposals/ids";
import { ProposalA } from "@/components/landing/proposals/proposal-a";
import { ProposalB } from "@/components/landing/proposals/proposal-b";
import { ProposalC } from "@/components/landing/proposals/proposal-c";
import { cn } from "@/lib/utils";
import "@/components/landing/home/home.css";

// Homepage proposals, reviewed side by side before one replaces the Catalog.
export const metadata: Metadata = { robots: "noindex, nofollow" };

export function generateStaticParams() {
  return PROPOSALS.map((p) => ({ variant: p.id }));
}

const PAGES = { a: ProposalA, b: ProposalB, c: ProposalC };

export default async function LandingProposal({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  const Page = PAGES[variant as keyof typeof PAGES];
  if (!Page) {
    notFound();
  }
  return (
    <>
      <Page parts={getParts()} />
      <nav
        aria-label="Proposals"
        className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit border border-black/[0.13] bg-white text-sm dark:border-white/[0.14] dark:bg-black"
      >
        {PROPOSALS.map((p) => (
          <Link
            aria-current={p.id === variant ? "page" : undefined}
            className={cn(
              "px-3 py-2",
              p.id === variant
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            )}
            href={`/landing/${p.id}`}
            key={p.id}
          >
            {p.id.toUpperCase()}{" "}
            <span className="hidden sm:inline">{p.label}</span>
          </Link>
        ))}
        <Link
          className="border-black/[0.13] border-l px-3 py-2 text-black/60 hover:text-black dark:border-white/[0.14] dark:text-white/60 dark:hover:text-white"
          href="/"
        >
          Current
        </Link>
      </nav>
    </>
  );
}
