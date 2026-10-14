"use client";

import { useEffect, useState } from "react";
import GlitchText from "@/components/kokonutui/glitch-text";

const STATUSES = ["Connecting", "Online", "Syncing", "Degraded", "Offline"];

export default function GlitchTextDemo() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % STATUSES.length),
      2400
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="@container flex w-full flex-col items-center gap-10 py-8">
      <GlitchText
        as="h2"
        className="font-semibold @lg:text-7xl text-5xl tracking-tight"
        text="Signal Text"
      />
      <div className="flex items-baseline gap-3 font-mono text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">status</span>
        <GlitchText
          className="font-medium text-2xl"
          intensity="strong"
          text={STATUSES[index]}
          trigger="change"
        />
      </div>
    </div>
  );
}
