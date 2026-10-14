"use client";

import DynamicText from "@/components/kokonutui/dynamic-text";

/** Docs demo: rotating words that morph into each other. */
export default function DynamicTextDemo() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center p-6">
      <DynamicText className="font-semibold text-5xl text-zinc-900 tracking-tight dark:text-zinc-100" />
    </div>
  );
}
