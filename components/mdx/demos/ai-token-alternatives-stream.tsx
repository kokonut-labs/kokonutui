"use client";

import AITokenAlternatives, {
  fromLogprobs,
  type LogprobToken,
} from "@/components/kokonutui/ai-token-alternatives";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

/** A token as a model's logprobs list has it. */
const tok = (
  token: string,
  p: number,
  alternatives: [string, number][] = []
): LogprobToken => ({
  token,
  logprob: Math.log(p),
  top_logprobs: alternatives.map(([t, q]) => ({
    token: t,
    logprob: Math.log(q),
  })),
});

/** What the model writes after the day, depending on which day it is. */
const REST: Record<string, LogprobToken[]> = {
  Thursday: [
    tok(" at", 0.97),
    tok(" 2pm", 0.46, [
      [" 10am", 0.33],
      [" noon", 0.12],
    ]),
    tok(" works", 0.9),
    tok(".", 0.95),
    tok(" I'll", 0.8),
    tok(" send", 0.9),
    tok(" the", 0.96),
    tok(" invite", 0.88),
    tok(".", 0.97),
  ],
  Friday: [
    tok(" morning", 0.52, [[" afternoon", 0.31]]),
    tok(" is", 0.9),
    tok(" safer", 0.62),
    tok(",", 0.9),
    tok(" the", 0.94),
    tok(" build", 0.8),
    tok(" lands", 0.7),
    tok(" Thursday", 0.88),
    tok(" night", 0.91),
    tok(".", 0.97),
  ],
};

/** The model's first take stays first in the slot; the rest follows the pick. */
const answerFor = (day: string) =>
  fromLogprobs([
    tok("Sure", 0.71, [["Yes", 0.18]]),
    tok(",", 0.93),
    tok(" Thursday", 0.44, [
      [" Friday", 0.35],
      [" Monday", 0.12],
    ]),
    ...(REST[day] ?? REST.Thursday),
  ]);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AITokenAlternativesStream() {
  const { play, run, key } = useScript([0]);

  // Your model, asked again from the picked word with logprobs on.
  const compose = async (choice: Record<string, string>) => {
    const day = choice.t2 ?? "Thursday";
    await wait(day === "Thursday" ? 300 : 1100);
    if (run === "error" && day !== "Thursday") {
      throw new Error("The model timed out. Pick the word again to retry.");
    }
    return answerFor(day);
  };

  return (
    <StreamPlate
      label="From a model's logprobs. Click a dotted word."
      play={play}
      run={run}
    >
      <AITokenAlternatives
        compose={compose}
        key={key}
        prompt="Can we move the launch review?"
        slots={answerFor("Thursday").slots}
      />
    </StreamPlate>
  );
}
