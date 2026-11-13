"use client";

import AIBranches, {
  type BranchMessage,
} from "@/components/kokonutui/ai-branches";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const AFTER_SPACE = /(?<= )/;

const MESSAGES: BranchMessage[] = [
  {
    id: "u1",
    role: "user",
    text: "Name ideas for a budgeting app for students.",
  },
  {
    id: "a1",
    role: "assistant",
    parent: "u1",
    text: "Pocket, Tally, Ramen Fund, Semester and Allowance.",
  },
];

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

export default function AIBranchesStream() {
  const { play, run, key } = useScript([0]);

  // Stands in for your model's `textStream`.
  async function* reply(
    prompt: string,
    _: BranchMessage[],
    signal: AbortSignal
  ) {
    await wait(700, signal);
    if (run === "error") {
      throw new Error("Rate limited. Wait a few seconds and send it again.");
    }
    const text = `For “${prompt}”: Penny, Stash, Next Loan and Halfway.`;
    for (const word of text.split(AFTER_SPACE)) {
      await wait(60, signal);
      yield word;
    }
  }

  return (
    <StreamPlate
      label="Replies from a stream. Edit the question."
      play={play}
      run={run}
    >
      <AIBranches
        key={key}
        messages={MESSAGES}
        reply={reply}
        title="App names"
      />
    </StreamPlate>
  );
}
