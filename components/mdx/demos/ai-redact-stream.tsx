"use client";

import AIRedact from "@/components/kokonutui/ai-redact";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const AFTER_SPACE = /(?<= )/;
const PERSON = /PERSON_\d+/;
const EMAIL = /EMAIL_\d+/;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

export default function AIRedactStream() {
  const { play, run, key } = useScript([0]);

  // Stands in for your model: it only ever sees the placeholders.
  async function* respond(masked: string, signal: AbortSignal) {
    await wait(600, signal);
    if (run === "error") {
      throw new Error("The model didn’t answer in time. Your message is safe.");
    }
    const person = masked.match(PERSON)?.[0] ?? "there";
    const email = masked.match(EMAIL)?.[0];
    const reply = `Hi ${person}, thanks for flagging the duplicate invoice. I’ve voided the second one${
      email ? ` and sent the corrected copy to ${email}` : ""
    }. Nothing else is due this month.`;
    for (const word of reply.split(AFTER_SPACE)) {
      await wait(45, signal);
      yield word;
    }
  }

  return (
    <StreamPlate
      label="Answered by a stream. Press send."
      play={play}
      run={run}
    >
      <AIRedact
        defaultValue="Reply to Tomás Reyes (tomas@lumen.io): he was invoiced twice for March and wants the extra one voided."
        key={key}
        names={["Tomás Reyes"]}
        respond={respond}
        title="Billing assistant"
      />
    </StreamPlate>
  );
}
