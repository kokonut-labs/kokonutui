import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Theme } from "@/components/og/frames";
import { PROPOSALS, type ProposalId } from "@/components/og/proposal-list";
import { ProposalFrame } from "@/components/og/proposals";
import { getProposalData } from "../../data";

export const metadata: Metadata = { robots: "noindex, nofollow" };

const THEMES: Theme[] = ["light", "dark"];

export function generateStaticParams() {
  return PROPOSALS.flatMap(({ id }) => THEMES.map((theme) => ({ id, theme })));
}

export default async function ProposalImage({
  params,
}: {
  params: Promise<{ id: string; theme: string }>;
}) {
  // A bench for new link-preview directions, not a page for visitors.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const { id, theme } = await params;
  if (
    !(PROPOSALS.some((p) => p.id === id) && THEMES.includes(theme as Theme))
  ) {
    notFound();
  }
  return (
    <ProposalFrame
      data={getProposalData()}
      id={id as ProposalId}
      theme={theme as Theme}
    />
  );
}
