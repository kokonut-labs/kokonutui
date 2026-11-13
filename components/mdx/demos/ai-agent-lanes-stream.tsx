"use client";

import AIAgentLanes, {
  type AgentLane,
} from "@/components/kokonutui/ai-agent-lanes";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

/** The run as it will have happened; each frame shows it up to a moment. */
const RUN: AgentLane[] = [
  {
    id: "lead",
    name: "Lead",
    steps: [
      { tool: "think", label: "Split the question", start: 0, end: 1.2 },
      { tool: "write", label: "Write the answer", start: 6.4, end: 8.4 },
    ],
  },
  {
    id: "docs",
    name: "Docs",
    summary: "Rate limits are per key",
    steps: [
      { tool: "search", label: "rate limit docs", start: 1.3, end: 2.6 },
      { tool: "read", label: "limits.md", start: 2.6, end: 4.4 },
    ],
  },
  {
    id: "code",
    name: "Code",
    summary: "Retries ignore Retry-After",
    steps: [
      { tool: "search", label: "429 handling", start: 1.4, end: 2.2 },
      { tool: "read", label: "client/retry.ts", start: 2.2, end: 5.1 },
      { tool: "think", label: "Find the bug", start: 5.1, end: 6.2 },
    ],
  },
];

const ANSWER =
  "Your client retries a 429 straight away instead of waiting for Retry-After, so one burst burns the whole per-key limit. Read the header in client/retry.ts and back off for that long.";

const STEP_S = 0.2;
const LAST = 8.6;

/** What an app would hold at second `t`: open steps have no end yet. */
function at(t: number) {
  const lanes = RUN.map((lane) => ({
    ...lane,
    summary: (lane.steps.at(-1)?.end ?? 0) <= t ? lane.summary : undefined,
    steps: lane.steps
      .filter((step) => step.start <= t)
      .map((step) => ({
        ...step,
        end: (step.end ?? 0) <= t ? step.end : undefined,
      })),
  }));
  const writing = RUN[0].steps[1];
  const share = Math.min(
    1,
    Math.max(0, (t - writing.start) / ((writing.end ?? 0) - writing.start))
  );
  return {
    elapsed: t,
    lanes,
    answer: ANSWER.slice(0, Math.round(ANSWER.length * share)),
  };
}

const FRAMES = Array.from({ length: Math.round(LAST / STEP_S) + 1 }, (_, i) =>
  at(i * STEP_S)
);

export default function AIAgentLanesStream() {
  const { frame, play, run, key } = useScript(FRAMES, STEP_S * 1000);

  return (
    <StreamPlate
      label="Driven live: elapsed, steps and answer from props"
      play={play}
      run={run}
      withError={false}
    >
      <AIAgentLanes
        answer={frame.answer}
        elapsed={frame.elapsed}
        key={key}
        lanes={frame.lanes}
        task="Why do we hit the API rate limit every morning?"
      />
    </StreamPlate>
  );
}
