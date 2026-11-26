"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AGENT_RULES } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { AgentIcon } from "./client";
import { CLIENT_MARKS, CopyLine } from "./controls";
import type { McpClient } from "./data";
import type { Part } from "./parts";
import {
  CELL,
  EASE_COLORS,
  enter,
  FOCUS_INSET,
  GRID,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
  SOFT,
} from "./styles";

export type AgentId = McpClient | "any";

export interface Agent {
  id: AgentId;
  label: string;
  Mark: (props: { className?: string }) => ReactNode;
  /** The mark's own color, shown once the agent is picked. */
  color: string;
  /** How a prompt reaches it from a terminal; none when it lives in an IDE. */
  cli?: string;
  /** The instructions file it loads. */
  rules: string;
}

export const AGENTS: Agent[] = [
  {
    id: "claude",
    label: "Claude Code",
    ...CLIENT_MARKS.claude,
    cli: "claude",
    rules: AGENT_RULES.claude.file,
  },
  {
    id: "codex",
    label: "Codex",
    ...CLIENT_MARKS.codex,
    cli: "codex",
    rules: AGENT_RULES.codex.file,
  },
  {
    id: "cursor",
    label: "Cursor",
    ...CLIENT_MARKS.cursor,
    cli: "cursor-agent",
    rules: ".cursor/rules",
  },
  {
    id: "vscode",
    label: "VS Code",
    ...CLIENT_MARKS.vscode,
    rules: "copilot-instructions.md",
  },
  {
    id: "any",
    label: "Any agent",
    Mark: AgentIcon,
    color: "text-[#15852A] dark:text-[#3BB44B]",
    rules: "AGENTS.md",
  },
];

/** The agents you run from a terminal, plus any other. */
const TERMINAL_AGENTS = AGENTS.filter((a) => a.id !== "vscode");

/** The prompt as you'd send it: through the agent's CLI when it has one. */
export function runPrompt(agent: Agent, prompt: string) {
  return agent.cli ? `${agent.cli} "${prompt}"` : prompt;
}

/**
 * Pick an agent. Agents get compared back and forth, so the selection swaps
 * instantly; only the colors ease.
 */
export function AgentTabs({
  value,
  onChange,
  agents = AGENTS,
  className,
  itemClassName,
}: {
  value: AgentId;
  onChange: (id: AgentId) => void;
  agents?: Agent[];
  className?: string;
  itemClassName?: string;
}) {
  return (
    <fieldset className={cn("m-0 min-w-0 border-0 p-0", className)}>
      <legend className="sr-only">Your agent</legend>
      {agents.map(({ id, label, Mark, color }) => {
        const selected = id === value;
        return (
          <button
            aria-pressed={selected}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-[13px]",
              CELL,
              selected
                ? "bg-[#f4f4f4] text-black dark:bg-[#161616] dark:text-white"
                : "text-black/55 hover:text-black/80 dark:text-white/55 dark:hover:text-white/80",
              EASE_COLORS,
              FOCUS_INSET,
              itemClassName
            )}
            key={id}
            onClick={() => onChange(id)}
            type="button"
          >
            <Mark
              className={cn(
                "size-3.5 shrink-0 transition-colors duration-150 ease-out",
                selected && color
              )}
            />
            {label}
          </button>
        );
      })}
    </fieldset>
  );
}

/**
 * Beside the pitch: what happens when you ask your agent for the order
 * flow. Pick the agent, copy the exact command, read the steps it takes
 * (packages and files come from the registry entries); the parts it
 * installs run live in the row below.
 */
export function AgentSession({
  parts,
  className,
}: {
  parts: Part[];
  className?: string;
}) {
  const [id, setId] = useState<AgentId>("claude");
  const agent = TERMINAL_AGENTS.find((a) => a.id === id) ?? TERMINAL_AGENTS[0];
  const names = parts.map((p) => `@kokonutui/${p.name}`);
  const prompt = `Add ${names.join(", ")} to the order page`;
  const deps = [...new Set(parts.flatMap((p) => p.dependencies))];
  const files = parts.flatMap((p) => p.files);
  const steps = [
    id === "any"
      ? `Read kokonutui.com/llms.txt and found all ${parts.length}`
      : `Found all ${parts.length} in @kokonutui over the shadcn MCP server`,
    `Ran npx shadcn@latest add ${names.join(" ")}`,
    ...(deps.length ? [`Installed ${deps.join(", ")}`] : []),
    `Wrote ${files.join(", ")}`,
  ];

  return (
    <figure
      className={cn("home-enter flex flex-col", CELL, className)}
      style={enter(1)}
    >
      <AgentTabs
        agents={TERMINAL_AGENTS}
        className={cn("grid grid-cols-2 border-b sm:grid-cols-4", GRID, LINE)}
        itemClassName="h-10 justify-center px-2 text-[12.5px]"
        onChange={setId}
        value={id}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <CopyLine
          className={cn("text-[13px]", INK)}
          label="prompt"
          prefix={agent.cli ? "$" : "›"}
          value={runPrompt(agent, prompt)}
        />
        <ol className="flex flex-col gap-1.5 pl-[18px]">
          {steps.map((step, i) => (
            <li
              className={cn(
                MONO,
                "home-enter flex items-baseline gap-2 text-[12px] leading-[1.5]",
                SOFT
              )}
              key={step}
              style={enter(i + 2)}
            >
              <span aria-hidden className={LEAF}>
                ✓
              </span>
              <span className="wrap-anywhere min-w-0">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption
        className={cn(
          "flex items-baseline justify-between gap-4 border-t px-4 py-3",
          LINE
        )}
      >
        <span className={META}>
          {parts.map((p) => p.code).join(" + ")} are live below
        </span>
        <span aria-hidden className={cn(META, "text-[13px]")}>
          ↓
        </span>
      </figcaption>
    </figure>
  );
}
