"use client";

import AISend, { type DraftEmail } from "@/components/kokonutui/ai-send";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const DRAFT: DraftEmail = {
  from: "jo@fieldnotes.app",
  toName: "Ines Duarte",
  toEmail: "ines@printhaus.eu",
  subject: "Proofs for issue 12",
  body: "Hi Ines,\n\nThe proofs look great. One fix: page 14 should use the new cover photo. Could we have the revised set by Wednesday?\n\nThanks,\nJo",
};

/** The draft as a `draft_email` tool's input streams in, a few words a frame. */
const WORDS = DRAFT.body.split(" ");
const FRAMES = Array.from({ length: Math.ceil(WORDS.length / 3) + 1 }, (_, i) =>
  WORDS.slice(0, i * 3).join(" ")
);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AISendStream() {
  const { frame, play, run, key } = useScript(FRAMES, 90);
  const writing = frame !== DRAFT.body;

  // Your mail API; a throw brings the draft back with the reason.
  const send = async () => {
    await wait(1200);
    if (run === "error") {
      throw new Error("The mail server didn’t accept it. Nothing was sent.");
    }
  };

  return (
    <StreamPlate
      label="Draft streamed from a tool call. Press Send."
      play={play}
      run={run}
    >
      <AISend
        draft={{ ...DRAFT, body: frame }}
        key={key}
        message="Here’s the note to the printer."
        onSend={send}
        undoSeconds={3}
        writing={writing}
      />
    </StreamPlate>
  );
}
