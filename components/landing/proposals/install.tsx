"use client";

import { useState } from "react";
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

const WAYS: { id: Way; label: string }[] = [
  { id: "cli", label: "shadcn" },
  ...AGENTS.filter((a) => a.id !== "vscode").map((a) => ({
    id: a.id,
    label: a.label,
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
              "h-7 rounded-full px-2.5 font-medium text-[12px]",
              way === w.id
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-black/55 hover:bg-black/[0.05] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white",
              EASE_COLORS,
              FOCUS_INSET
            )}
            key={w.id}
            onClick={() => setWay(w.id)}
            type="button"
          >
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
