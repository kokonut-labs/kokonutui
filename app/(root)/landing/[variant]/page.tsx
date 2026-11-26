import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getParts } from "@/components/landing/home/parts";
import { Assembled } from "@/components/landing/proposals/assembled";
import { Compare } from "@/components/landing/proposals/compare";
import { Contents } from "@/components/landing/proposals/contents";
import {
  PROPOSAL_IDS,
  type ProposalId,
} from "@/components/landing/proposals/ids";
import { ProposalNav } from "@/components/landing/proposals/nav";
import "@/components/landing/home/home.css";

// Homepage proposals, for review before one replaces the cover. Not indexed.
export const metadata: Metadata = {
  title: "Landing proposals",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return PROPOSAL_IDS.map((variant) => ({ variant }));
}

const VIEWS = { assembled: Assembled, contents: Contents, compare: Compare };

export default async function LandingProposal({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!PROPOSAL_IDS.includes(variant as ProposalId)) {
    notFound();
  }
  const View = VIEWS[variant as ProposalId];
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-32 sm:px-6 md:pt-8">
      <ProposalNav current={`/landing/${variant}`} />
      <View parts={getParts()} />
    </div>
  );
}
