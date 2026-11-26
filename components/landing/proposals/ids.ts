/** The landing proposals under review, kept out of the "use client" views so
 * the page can list them in generateStaticParams. */
export const PROPOSAL_IDS = ["assembled", "contents", "compare"] as const;
export type ProposalId = (typeof PROPOSAL_IDS)[number];
