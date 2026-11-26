/** The landing proposals under review, kept out of the "use client" views so
 * the page can list them in generateStaticParams. */
export const PROPOSAL_IDS = ["ask", "canvas"] as const;
export type ProposalId = (typeof PROPOSAL_IDS)[number];
