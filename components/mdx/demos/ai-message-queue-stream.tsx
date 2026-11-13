"use client";

import AIMessageQueue, {
  type AgentUpdate,
} from "@/components/kokonutui/ai-message-queue";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const AFTER_SPACE = /(?<= )/;

const RUNS: Record<string, { steps: string[]; reply: string }> = {
  "Bump the API rate limit to 200": {
    steps: ["Reading config/limits.ts", "Editing the limit", "Running tests"],
    reply: "The limit is 200 a minute now. Tests pass.",
  },
  "Note it in the changelog": {
    steps: ["Opening CHANGELOG.md", "Adding the entry"],
    reply: "Added under 2.4.0, “Higher API rate limit”.",
  },
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

export default function AIMessageQueueStream() {
  const { play, run, key } = useScript([0]);

  // Like reading the AI SDK's `fullStream`: a step per tool call, then text.
  async function* respond(
    text: string,
    signal: AbortSignal
  ): AsyncIterable<AgentUpdate> {
    const plan = RUNS[text] ?? { steps: ["Working on it"], reply: "Done." };
    for (const [i, step] of plan.steps.entries()) {
      yield { step };
      await wait(1100, signal);
      if (run === "error" && i === 1) {
        throw new Error("Tests failed: limits.test.ts, 2 failing");
      }
    }
    for (const word of plan.reply.split(AFTER_SPACE)) {
      await wait(50, signal);
      yield { text: word };
    }
  }

  return (
    <StreamPlate label="Runs from a stream of steps" play={play} run={run}>
      <AIMessageQueue
        initialPrompt="Bump the API rate limit to 200"
        initialQueue={["Note it in the changelog"]}
        key={key}
        respond={respond}
        title="API limits"
      />
    </StreamPlate>
  );
}
