import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getParts } from "@/components/landing/home/parts";
import { Ask } from "@/components/landing/proposals/ask";
import { Canvas } from "@/components/landing/proposals/canvas";
import {
  PROPOSAL_IDS,
  type ProposalId,
} from "@/components/landing/proposals/ids";
import { ProposalNav } from "@/components/landing/proposals/nav";
import { Prompts } from "@/components/landing/proposals/prompts";
import "@/components/landing/home/home.css";
import "@/components/landing/proposals/proposals.css";

// Homepage proposals, for review before one replaces the homepage. Not indexed.
export const metadata: Metadata = {
  title: "Landing proposals",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return PROPOSAL_IDS.map((variant) => ({ variant }));
}

const VIEWS = { ask: Ask, canvas: Canvas, prompts: Prompts };

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
    <>
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <ProposalNav current={`/landing/${variant}`} />
      </div>
      <View parts={getParts()} />
    </>
  );
}
