"use client";

import AIInlineEdit from "@/components/kokonutui/ai-inline-edit";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const PARAGRAPHS = [
  "In order to make exports faster, we have basically rewritten the way that reports are generated on the server.",
  "Due to the fact that large files are now split up into parts, you might really notice that downloads start a lot sooner than before.",
];

const AFTER_SPACE = /(?<= )/;

/** Stands in for the model: a few plain-English fixes. */
const FIXES: [RegExp, string][] = [
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\b(basically|really|a lot) /gi, ""],
  [/\bthe way that\b/gi, "how"],
  [/\bsplit up into\b/gi, "split into"],
];

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

/** Keeps a capital at the start when the selection had one. */
const caseLike = (text: string, like: string) =>
  like.charAt(0) === like.charAt(0).toUpperCase()
    ? text.charAt(0).toUpperCase() + text.slice(1)
    : text;

export default function AIInlineEditStream() {
  const { play, run, key } = useScript([0]);

  // Like the AI SDK's `textStream`: deltas, a word at a time.
  async function* rewrite(
    text: string,
    _: string,
    __: number,
    signal: AbortSignal
  ) {
    await wait(700, signal);
    if (run === "error") {
      throw new Error("The model is busy right now. Try again in a moment.");
    }
    const out = caseLike(
      FIXES.reduce((acc, [from, to]) => acc.replace(from, to), text),
      text
    );
    for (const word of out.split(AFTER_SPACE)) {
      await wait(30, signal);
      yield word;
    }
  }

  return (
    <StreamPlate
      label="Rewritten by a stream. Select a sentence."
      play={play}
      run={run}
    >
      <AIInlineEdit
        key={key}
        paragraphs={PARAGRAPHS}
        rewrite={rewrite}
        title="Release notes"
      />
    </StreamPlate>
  );
}
