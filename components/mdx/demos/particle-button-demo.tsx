"use client";

import { useRef } from "react";
import ParticleButton from "@/components/kokonutui/particle-button";

/**
 * Docs demo only: saving pretends to take a moment, and every third try
 * fails so the error state shows too.
 */
export default function ParticleButtonDemo() {
  const attempts = useRef(0);

  const save = () => {
    attempts.current += 1;
    const fails = attempts.current % 3 === 0;
    return new Promise<void>((resolve, reject) => {
      setTimeout(
        () => (fails ? reject(new Error("Network error")) : resolve()),
        1100
      );
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ParticleButton onClick={save} />
      <ParticleButton
        onClick={save}
        pendingLabel="Publishing"
        successLabel="Published"
        variant="outline"
      >
        Publish
      </ParticleButton>
    </div>
  );
}
