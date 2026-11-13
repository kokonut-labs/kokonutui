"use client";

import AIAttachment, {
  type AIAttachmentProps,
  type AnswerPart,
} from "@/components/kokonutui/ai-attachment";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const FILE = { name: "lease-agreement.pdf", size: 2_600_000, pages: 8 };

const ANSWER: AnswerPart[] = [
  "You can leave early with two months' notice after the first year",
  { page: 4 },
  ". The deposit comes back within 30 days, minus any repairs",
  { page: 6 },
  ".",
];

type Frame = Omit<AIAttachmentProps, "file" | "className">;

const uploading: Frame[] = [0, 0.2, 0.45, 0.7, 0.9, 1].map((uploaded) => ({
  status: "uploading",
  uploaded,
}));

const reading = (upTo: number): Frame[] =>
  Array.from({ length: upTo + 1 }, (_, pagesRead) => ({
    status: "reading",
    pagesRead,
  }));

/** The answer as it streams in, a part at a time. */
const answering: Frame[] = ANSWER.map((_, i) => ({
  status: "done",
  duration: 2.1,
  answer: ANSWER.slice(0, i + 1),
}));

const SCRIPTS: Record<"ok" | "error", Frame[]> = {
  ok: [...uploading, ...reading(FILE.pages), ...answering],
  error: [
    ...uploading,
    ...reading(5),
    {
      status: "error",
      pagesRead: 5,
      error: "Page 6 is a scan with no text",
    },
  ],
};

export default function AIAttachmentStream() {
  const { frame, play, run, key } = useScript(SCRIPTS, 300);

  return (
    <StreamPlate play={play} run={run}>
      <AIAttachment file={FILE} key={key} {...frame} />
    </StreamPlate>
  );
}
