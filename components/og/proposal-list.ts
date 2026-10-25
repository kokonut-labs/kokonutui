/** Link-preview directions on the bench at /og-lab/proposals. */
export const PROPOSALS = [
  {
    id: "index",
    label: "B. Index",
    note: "Type only. The tagline beside the catalog's table of contents.",
  },
  {
    id: "ai",
    label: "C. AI",
    note: "Leads with the AI shelf, with an agent running its steps.",
  },
] as const;

export type ProposalId = (typeof PROPOSALS)[number]["id"];

/** The part the AI direction features. */
export const AI_PART = "ai-loading";

/** AI parts the AI direction names under its headline. */
export const AI_HIGHLIGHTS = [
  "ai-tool-approval",
  "ai-diff-review",
  "ai-context-meter",
  "ai-citations",
  "ai-model-selector",
  "ai-voice",
];
