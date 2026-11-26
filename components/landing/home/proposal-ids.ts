// Kept out of the "use client" proposals module so the server page can build
// its static params from it.
export const PROPOSAL_IDS = ["a", "b", "c"] as const;
export type ProposalId = (typeof PROPOSAL_IDS)[number];
