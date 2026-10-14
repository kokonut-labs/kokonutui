"use client";

import { useState } from "react";
import DynamicText from "@/components/kokonutui/dynamic-text";
import { cn } from "@/lib/utils";

const BILLING = [
  { id: "monthly", label: "Monthly", price: "$24", note: "billed monthly" },
  { id: "yearly", label: "Yearly", price: "$19", note: "billed yearly" },
] as const;

/** Docs demo: rotating words on top, a billing toggle with rolling digits. */
export default function DynamicTextDemo() {
  const [billing, setBilling] = useState<(typeof BILLING)[number]>(BILLING[0]);

  return (
    <div className="flex min-h-[320px] w-full flex-col items-center justify-center gap-14 p-6">
      <DynamicText className="font-semibold text-5xl text-zinc-900 tracking-tight dark:text-zinc-100" />

      <div className="flex flex-col items-center gap-4">
        <div className="flex rounded-full border border-zinc-200 p-0.5 dark:border-zinc-800">
          {BILLING.map((option) => (
            <button
              aria-pressed={billing.id === option.id}
              className={cn(
                "rounded-full px-3 py-1 font-medium text-[13px] text-zinc-500 transition-colors duration-150 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-400 focus-visible:outline-offset-2 dark:hover:text-zinc-100",
                billing.id === option.id &&
                  "bg-zinc-900 text-white hover:text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:text-zinc-900"
              )}
              key={option.id}
              onClick={() => setBilling(option)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="flex items-baseline gap-1 text-zinc-900 dark:text-zinc-100">
          <DynamicText
            className="font-semibold text-4xl tracking-tight"
            text={billing.price}
          />
          <span className="text-sm text-zinc-500">/mo</span>
        </p>
        <DynamicText className="text-sm text-zinc-500" text={billing.note} />
      </div>
    </div>
  );
}
