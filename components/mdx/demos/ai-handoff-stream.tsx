"use client";

import AIHandoff, {
  type AIHandoffProps,
} from "@/components/kokonutui/ai-handoff";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

type Frame = Pick<AIHandoffProps, "status" | "position" | "reply">;

const REPLY =
  "Hi, Nora here. I can see the duplicate and I’ve refunded $24.00. It’ll be back on your card in 3 to 5 days.";

/** What a support queue would report, one update per step. */
const FRAMES: Frame[] = [
  { status: "waiting", position: 3 },
  { status: "waiting", position: 3 },
  { status: "waiting", position: 2 },
  { status: "waiting", position: 1 },
  { status: "joined", position: 1 },
  { status: "joined", position: 1 },
  { status: "joined", position: 1 },
  { status: "joined", position: 1, reply: REPLY },
];

export default function AIHandoffStream() {
  const { frame, play, run, key } = useScript(FRAMES, 1100);

  return (
    <StreamPlate
      label="Driven by a support queue"
      play={play}
      run={run}
      withError={false}
    >
      <AIHandoff
        key={key}
        message="Refunds need someone on the billing team, so I’m handing you over with the details."
        position={frame.position}
        reply={frame.reply}
        status={frame.status}
      />
    </StreamPlate>
  );
}
