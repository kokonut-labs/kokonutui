"use client";

import { type ReactNode, useState } from "react";
import {
  AGENTS,
  type AgentId,
  runPrompt,
} from "@/components/landing/home/agents";
import { CopyLine } from "@/components/landing/home/controls";
import { installCommand } from "@/components/landing/home/data";
import { EASE_COLORS, FOCUS_INSET } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

export type Way = "cli" | AgentId;

/** The shadcn mark: two strokes. */
function ShadcnMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 256 256"
    >
      <path
        d="M208 128 128 208M192 40 40 192"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="28"
      />
    </svg>
  );
}

const WAYS: {
  id: Way;
  label: string;
  Mark: (props: { className?: string }) => ReactNode;
  /** The mark's own color, kept on every tab. */
  color: string;
}[] = [
  {
    id: "cli",
    label: "shadcn",
    Mark: ShadcnMark,
    color: "text-black dark:text-white",
  },
  ...AGENTS.filter((a) => a.id !== "vscode").map((a) => ({
    id: a.id,
    label: a.label,
    Mark: a.Mark,
    color: a.color,
  })),
];

/** How to get these parts: the CLI line, or the prompt for your agent. */
export function installLine(way: Way, names: string[]) {
  if (way === "cli") {
    return names.map((n) => installCommand(n)).join(" && ");
  }
  const agent = AGENTS.find((a) => a.id === way) ?? AGENTS[0];
  const list = names.map((n) => `@kokonutui/${n}`).join(", ");
  return runPrompt(agent, `Add ${list} to this project`);
}

/**
 * One row of tabs (shadcn, Claude Code, Codex, Cursor, any agent) over the
 * line to copy. Switching is instant: people flip between these to compare.
 */
export function InstallBar({
  names,
  defaultWay = "cli",
  className,
}: {
  names: string[];
  defaultWay?: Way;
  className?: string;
}) {
  const [way, setWay] = useState<Way>(defaultWay);
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <fieldset className="m-0 flex min-w-0 flex-wrap gap-1 border-0 p-0">
        <legend className="sr-only">Install with</legend>
        {WAYS.map((w) => (
          <button
            aria-pressed={way === w.id}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium text-[12px]",
              way === w.id
                ? "bg-black/[0.07] text-black dark:bg-white/[0.12] dark:text-white"
                : "text-black/55 hover:bg-black/[0.04] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white",
              EASE_COLORS,
              FOCUS_INSET
            )}
            key={w.id}
            onClick={() => setWay(w.id)}
            type="button"
          >
            <w.Mark className={cn("size-3.5 shrink-0", w.color)} />
            {w.label}
          </button>
        ))}
      </fieldset>
      <CopyLine
        className="text-[12.5px] text-black dark:text-white"
        label={way === "cli" ? "install command" : "prompt"}
        prefix={way === "any" ? "›" : "$"}
        value={installLine(way, names)}
      />
    </div>
  );
}
