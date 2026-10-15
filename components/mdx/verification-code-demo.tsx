"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import VerificationCode from "@/components/kokonutui/verification-code";

/**
 * Docs demo only: the component on a sign-in step, with a way to start over
 * once the code is accepted.
 */
export default function VerificationCodeDemo() {
  const [run, setRun] = useState(0);
  const [verified, setVerified] = useState(false);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <div className="flex flex-col gap-1">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          Check your email
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          We sent a code to maya@studio.com. Try 123456.
        </p>
      </div>
      <VerificationCode key={run} onSuccess={() => setVerified(true)} />
      <button
        className="flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-zinc-500 outline-none transition-[opacity,color] duration-200 ease-out hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-0 dark:text-zinc-400 dark:hover:text-zinc-100"
        disabled={!verified}
        onClick={() => {
          setVerified(false);
          setRun((n) => n + 1);
        }}
        type="button"
      >
        <RotateCcw className="size-3.5" />
        Start over
      </button>
    </div>
  );
}
