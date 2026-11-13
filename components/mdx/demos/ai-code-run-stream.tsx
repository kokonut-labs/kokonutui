"use client";

import AICodeRun, {
  type AICodeRunProps,
  type CodeRunStatus,
} from "@/components/kokonutui/ai-code-run";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const CODE = `import pandas as pd

df = pd.read_csv("orders.csv")
monthly = df.groupby("month").total.sum().tail(4)

print(f"{monthly.iloc[-1]:,.0f} in Oct")
monthly.plot.bar()`;

const LINES = CODE.split("\n");
const BARS = [
  { label: "Jul", value: 41_200 },
  { label: "Aug", value: 38_900 },
  { label: "Sep", value: 45_100 },
  { label: "Oct", value: 52_300 },
];

type Frame = Pick<
  AICodeRunProps,
  "code" | "stdout" | "bars" | "answer" | "activeLine" | "duration"
> & { status: CodeRunStatus };

/** The code as a model writes it, a line at a time. */
const writing: Frame[] = LINES.map((_, i) => ({
  status: "writing",
  code: LINES.slice(0, i + 1).join("\n"),
}));

/** Each line that runs, in order; blank ones are skipped. */
const runnable = LINES.flatMap((line, i) => (line.trim() ? [i + 1] : []));

const running = (upTo: number): Frame[] =>
  runnable
    .filter((line) => line <= upTo)
    .map((line) => ({
      status: "running",
      code: CODE,
      activeLine: line,
      stdout: line > 6 ? "52,300 in Oct" : undefined,
    }));

const SCRIPTS: Record<"ok" | "error", Frame[]> = {
  ok: [
    ...writing,
    ...running(7),
    {
      status: "done",
      code: CODE,
      stdout: "52,300 in Oct",
      bars: BARS,
      duration: 2.4,
      answer: "October was your best month yet: $52.3k, up 16% on September.",
    },
  ],
  error: [
    ...writing,
    ...running(4),
    {
      status: "error",
      code: CODE,
      activeLine: 4,
      stdout: "KeyError: 'month'. The columns are date, total, region.",
      answer:
        "The export has no month column. I'll group by date instead and run it again.",
    },
  ],
};

export default function AICodeRunStream() {
  const { frame, play, run, key } = useScript(SCRIPTS, 260);

  return (
    <StreamPlate play={play} run={run}>
      <AICodeRun
        filename="revenue.py"
        key={key}
        onRunAgain={() => play(run)}
        {...frame}
      />
    </StreamPlate>
  );
}
