// Kept apart from the "use client" proposals so the route's
// generateStaticParams, a server function, can read them.
export const PROPOSALS = [
  { id: "a", label: "Try it first" },
  { id: "b", label: "Find a component" },
  { id: "c", label: "Compared" },
] as const;

export type ProposalId = (typeof PROPOSALS)[number]["id"];
