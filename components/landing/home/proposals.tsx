"use client";

import Link from "next/link";
import { type ReactNode, Suspense, useState } from "react";
import { HoverLink } from "@/components/hover-link";
import { AGENT_RULES, SETUP_PROMPT } from "@/lib/agents";
import { RELEASES } from "@/lib/changelog";
import { cn } from "@/lib/utils";
import {
  CornerPlate,
  FlowPlate,
  type FlowStep,
  HeroActions,
  Index,
  LatestRelease,
  Plate,
  PlateFoot,
  PromptLine,
  References,
  SectionHead,
  Supplement,
  VercelCell,
} from "./catalog";
import { AgentIcon } from "./client";
import { CopyLine } from "./controls";
import { type McpClient, mcpCommand } from "./data";
import { LIVE, LiveFallback } from "./live";
import { ClaudeMark, CursorMark, OpenAIMark, VSCodeMark } from "./logos";
import type { Part } from "./parts";
import {
  CELL,
  EASE_COLORS,
  enter,
  FOCUS,
  FOCUS_INSET,
  GRID,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
  SOFT,
} from "./styles";

/*
 * Two proposals for a homepage that shows the AI parts and the rest of the
 * app together, and says up front that any agent can install them.
 *
 * A. By screen: the cover's order story gains a printed receipt between the
 *    checkout and the courier, and the components are shown in rows per
 *    screen (a trip, money, work), each row mixing AI and UI parts.
 * B. Ask your agent: the cover is a list of prompts. Pick one, see the live
 *    component it installs, copy the command for Claude Code, Codex or
 *    Cursor. Below, one Components grid with a category filter.
 *
 * Both end with the same "Works with your agent" section in place of "How to
 * install".
 */

type Pick = (names: string[]) => Part[];

function usePick(parts: Part[]): Pick {
  const byName = new Map(parts.map((p) => [p.name, p]));
  return (names) =>
    names
      .map((name) => byName.get(name))
      .filter((p): p is Part => Boolean(p && LIVE[p.name]));
}

function latestParts(parts: Part[]) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  return (RELEASES[0]?.added ?? []).flatMap((e) => byName.get(e.name) ?? []);
}

/* Agents ---------------------------------------------------------------- */

type AgentId = McpClient | "any";

interface Agent {
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

const AGENTS: Agent[] = [
  {
    id: "claude",
    label: "Claude Code",
    Mark: ClaudeMark,
    color: "text-[#D57156]",
    cli: "claude",
    rules: AGENT_RULES.claude.file,
  },
  {
    id: "codex",
    label: "Codex",
    Mark: OpenAIMark,
    color: "text-black dark:text-white",
    cli: "codex",
    rules: AGENT_RULES.codex.file,
  },
  {
    id: "cursor",
    label: "Cursor",
    Mark: CursorMark,
    color: "text-black dark:text-white",
    cli: "cursor-agent",
    rules: ".cursor/rules",
  },
  {
    id: "vscode",
    label: "VS Code",
    Mark: VSCodeMark,
    color: "text-[#0078D4] dark:text-[#3EA2FF]",
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

/** The prompt as you'd send it: through the agent's CLI when it has one. */
function runPrompt(agent: Agent, prompt: string) {
  return agent.cli ? `${agent.cli} "${prompt}"` : prompt;
}

/** The marks in a row, quiet until hovered; for the cover's meta row. */
function AgentMarks({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {AGENTS.filter((a) => a.id !== "any").map(({ id, label, Mark }) => (
        <Mark
          aria-label={label}
          className="size-3.5 shrink-0 text-black/55 dark:text-white/55"
          key={id}
        />
      ))}
    </span>
  );
}

/**
 * Beside the cover's buttons: the agents that install from the registry,
 * each mark in its own color, linking to the agents guide.
 */
function AgentStrip() {
  return (
    <Link
      className={cn("home-enter group flex flex-col gap-2 rounded-sm", FOCUS)}
      href="/docs/agents"
      style={enter(2)}
    >
      <span className={META}>Install with your agent</span>
      <span className="grid w-fit grid-cols-2 gap-x-6 gap-y-2">
        {AGENTS.filter((a) => a.id !== "vscode").map(
          ({ id, label, Mark, color }) => (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium text-[14px] text-black/70 group-hover:text-black dark:text-white/70 dark:group-hover:text-white",
                EASE_COLORS
              )}
              key={id}
            >
              <Mark className={cn("size-4 shrink-0", color)} />
              {id === "any" ? "any agent" : label}
            </span>
          )
        )}
      </span>
    </Link>
  );
}

function AgentTabs({
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

/** What to ask once a project is set up: an AI part and a UI part together. */
const MIXED_PROMPT =
  "Add a chat input with a model picker and a slide-to-pay button from @kokonutui";

/** Files the site serves for agents, linked so people can read them too. */
const READS = [
  { path: "/setup.md", line: "Setup steps, written for an agent" },
  { path: "/llms.txt", line: "Every docs page, one line each" },
  { path: "/r/registry.json", line: "The registry the shadcn CLI reads" },
  {
    path: "/docs/ai/ai-checkout.md",
    line: "Any docs page as Markdown, source included",
  },
];

/**
 * Pick your agent, get its three lines: the setup prompt, the MCP server (or
 * the index, for agents without one) and a first thing to ask for.
 */
function Agents({ number }: { number: string }) {
  const [id, setId] = useState<AgentId>("claude");
  const agent = AGENTS.find((a) => a.id === id) ?? AGENTS[0];
  const steps = [
    {
      title: "Set it up with one prompt",
      note: "It reads the steps at /setup.md: registry, MCP server and rules.",
      line: (
        <CopyLine
          className={cn("text-[13px]", INK)}
          label="setup prompt"
          prefix="›"
          value={SETUP_PROMPT}
        />
      ),
    },
    id === "any"
      ? {
          title: "Or point it at the index",
          note: "Every page as Markdown, for agents without an MCP client.",
          line: (
            <CopyLine
              className={cn("text-[13px]", INK)}
              value="https://kokonutui.com/llms.txt"
            />
          ),
        }
      : {
          title: "Connect the shadcn MCP server",
          note: `So ${agent.label} can browse the registry and install from it.`,
          line: (
            <CopyLine
              className={cn("text-[13px]", INK)}
              prefix="$"
              value={mcpCommand(id)}
            />
          ),
        },
    {
      title: "Then ask in plain words",
      note: "AI parts and UI parts come from the same registry.",
      line: (
        <CopyLine
          className={cn("text-[13px]", INK)}
          label="prompt"
          prefix={agent.cli ? "$" : "›"}
          value={runPrompt(agent, MIXED_PROMPT)}
        />
      ),
    },
  ];

  return (
    <section aria-labelledby="agents" className="pt-24 md:pt-32">
      <SectionHead
        aside="Kokonut UI is a shadcn registry with an MCP server, a setup file and Markdown for every page, so the agent you already use can find a component and install it for you."
        id="agents"
        number={number}
        title="Works with agents"
      />
      <div className={cn("grid grid-cols-1 border", GRID, LINE)}>
        <AgentTabs
          className={cn("grid grid-cols-2 sm:grid-cols-5", GRID)}
          itemClassName="h-14 justify-start gap-2.5 px-4 text-[15px] last:col-span-2 sm:h-[72px] sm:last:col-span-1 [&_svg]:size-5"
          onChange={setId}
          value={id}
        />
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          <ol className={cn("grid grid-cols-1 lg:col-span-8", GRID)}>
            {steps.map((step, i) => (
              <li
                className={cn("flex gap-4 p-5 sm:gap-6 sm:p-6", CELL)}
                key={step.title}
              >
                <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <p className="flex flex-col gap-0.5">
                    <span className={cn("font-medium text-[15px]", INK)}>
                      {step.title}
                    </span>
                    <span className={cn("text-[13.5px] leading-snug", SOFT)}>
                      {step.note}
                    </span>
                  </p>
                  {step.line}
                </div>
              </li>
            ))}
          </ol>
          <div
            className={cn(
              "flex flex-col justify-between gap-8 p-5 sm:p-6 lg:col-span-4",
              CELL
            )}
          >
            <div className="flex flex-col gap-1">
              <p className={META}>Rules go in</p>
              <p className={cn(MONO, "text-[15px]", INK)}>{agent.rules}</p>
              <p className={cn("text-[13.5px] leading-snug", SOFT)}>
                So {id === "any" ? "your agent" : agent.label} keeps using the
                registry, the cn helper and the @/ paths.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className={META}>What it reads</p>
              <ul className={cn("flex flex-col border-t", LINE)}>
                {READS.map((r) => (
                  <li
                    className={cn("border-b last:border-b-0", LINE)}
                    key={r.path}
                  >
                    <a
                      className={cn(
                        "group flex flex-col gap-0.5 py-2",
                        FOCUS_INSET
                      )}
                      href={r.path}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span
                        className={cn(
                          MONO,
                          "text-[12.5px] underline-offset-4 group-hover:underline",
                          INK
                        )}
                      >
                        {r.path}
                      </span>
                      <span className={cn("text-[13px]", SOFT)}>{r.line}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <Link
                className={cn(
                  "mt-1 w-fit text-[13px] underline decoration-black/25 underline-offset-4 hover:decoration-black dark:decoration-white/25 dark:hover:decoration-white",
                  SOFT,
                  EASE_COLORS,
                  FOCUS
                )}
                href="/docs/agents"
              >
                The full agents guide
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Shared cover pieces --------------------------------------------------- */

function MetaRow({ agents = true }: { agents?: boolean }) {
  const labels = [
    "Kokonut UI",
    "UI and AI components",
    "React, Tailwind CSS, Motion",
    ...(agents ? [] : ["Free and open source"]),
  ];
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4", GRID)}>
      {labels.map((label, i) => (
        <p
          className={cn(
            "home-enter flex h-10 items-center px-4",
            CELL,
            i === 0
              ? "font-medium text-[11.5px] text-black dark:text-white"
              : META
          )}
          key={label}
          style={enter(0)}
        >
          {label}
        </p>
      ))}
      {agents ? (
        <p
          className={cn(
            "home-enter flex h-10 items-center justify-between gap-3 px-4",
            CELL,
            META
          )}
          style={enter(0)}
        >
          <span>Works with</span>
          <AgentMarks />
        </p>
      ) : null}
    </div>
  );
}

/* A. By screen ------------------------------------------------------------ */

/**
 * The cover's order, now with the app around the chat: pay in the chat,
 * the receipt prints, the courier arrives.
 */
const ORDER = [
  { name: "ai-checkout", label: "Pay", room: "min-h-[460px]" },
  { name: "receipt-printer", label: "Receipt", room: "min-h-[460px]" },
  { name: "ai-order-status", label: "Track", room: "min-h-[460px]" },
];

/** Rows of one screen each, every row mixing AI and UI parts. */
const SCREENS = [
  {
    id: "trip",
    title: "A trip",
    line: "The assistant finds the hotel, you pick the nights, the pass keeps itself current.",
    names: ["ai-tool-calls", "stay-picker", "boarding-pass"],
    room: "h-[480px]",
  },
  {
    id: "money",
    title: "Money",
    line: "See where it went, hand a double charge to a person, send what you owe.",
    names: ["spending-ring", "ai-handoff", "amount-pad"],
    room: "h-[460px]",
  },
  {
    id: "work",
    title: "Work",
    line: "Find a time for both calendars, send the draft, watch the number move.",
    names: ["ai-schedule", "ai-send", "metric-card"],
    room: "h-[480px]",
  },
];

export function LandingByScreen({ parts }: { parts: Part[] }) {
  const pick = usePick(parts);
  const steps: FlowStep[] = ORDER.flatMap((step) => {
    const part = pick([step.name])[0];
    return part ? [{ ...step, part }] : [];
  });

  return (
    <>
      <section
        aria-label="Kokonut UI"
        className={cn("grid grid-cols-1 border", GRID, LINE)}
      >
        <MetaRow agents={false} />
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          <div
            className={cn(
              "order-1 flex flex-col justify-between gap-8 p-5 sm:gap-12 sm:p-8 lg:col-span-8 lg:p-10",
              CELL
            )}
          >
            <h1
              className={cn(
                "home-enter font-semibold text-[clamp(40px,12.5vw,52px)] leading-[0.9] tracking-[-0.06em] sm:text-[clamp(52px,8vw,104px)]",
                INK
              )}
              style={enter(0)}
            >
              UI and AI <br />
              components <br />
              that feel right.
            </h1>
            <p
              className="home-enter max-w-[620px] text-pretty text-[19px] leading-[1.45] tracking-[-0.01em] sm:text-[22px]"
              style={enter(1)}
            >
              <span className={INK}>
                Open-source React components for the chat and the app around it,
                made to sit on the same screen.
              </span>{" "}
              <span className={SOFT}>
                Install them with the shadcn CLI, or ask your agent to.
              </span>
            </p>
          </div>
          {pick(["apple-activity-card"]).map((part) => (
            <CornerPlate
              className="order-4 lg:order-2 lg:col-span-4"
              key={part.name}
              part={part}
            />
          ))}
          <div
            className={cn(
              "order-2 flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:px-8 lg:order-3 lg:col-span-8 lg:px-10",
              CELL
            )}
          >
            <HeroActions count={parts.length} />
          </div>
          <div
            className={cn(
              "order-3 flex items-center p-5 sm:px-8 lg:order-4 lg:col-span-4 lg:px-6",
              CELL
            )}
          >
            <AgentStrip />
          </div>
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-3", GRID)}>
          {steps.map((step, i) => (
            <FlowPlate
              key={step.part.name}
              label={`${i + 1}. ${step.label}`}
              part={step.part}
              room={step.room}
            />
          ))}
        </div>

        <div className={cn("grid grid-cols-1 md:grid-cols-12", GRID)}>
          <div
            className={cn(
              "home-enter flex flex-col justify-center gap-3 p-5 sm:p-6 md:col-span-7",
              CELL
            )}
            style={enter(2)}
          >
            <p className={META}>Ask your agent for all three</p>
            <PromptLine prompt="Add @kokonutui/ai-checkout, receipt-printer and ai-order-status to my order flow" />
          </div>
          <div className={cn("grid grid-cols-1 md:col-span-5", GRID)}>
            <VercelCell />
            <LatestRelease className="" parts={latestParts(parts)} />
          </div>
        </div>
      </section>

      <section aria-labelledby="screens" className="pt-24 md:pt-32">
        <SectionHead
          aside="Each row is one screen of a real app: the assistant's part and the controls around it, live and installable on their own."
          id="screens"
          number="01"
          title="AI and UI, together"
        />
        <div className={cn("grid grid-cols-1 border", GRID, LINE)}>
          {SCREENS.map((screen) => {
            const row = pick(screen.names);
            return (
              <section
                aria-labelledby={`screen-${screen.id}`}
                className={cn("grid grid-cols-1", GRID)}
                key={screen.id}
              >
                <div
                  className={cn(
                    "flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6",
                    CELL
                  )}
                >
                  <p className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <span
                      className={cn("shrink-0 font-medium text-[17px]", INK)}
                      id={`screen-${screen.id}`}
                    >
                      {screen.title}
                    </span>
                    <span className={cn("text-[14px]", SOFT)}>
                      {screen.line}
                    </span>
                  </p>
                  <span className={cn(META, "shrink-0")}>
                    {row.map((p) => p.code).join(" + ")}
                  </span>
                </div>
                <div className={cn("grid grid-cols-1 lg:grid-cols-3", GRID)}>
                  {row.map((part) => (
                    <Plate key={part.name} part={part} room={screen.room} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <Agents number="02" />
      <Index number="03" parts={parts} />
      <References number="04" />
      <Supplement number="05" />
    </>
  );
}

/* B. Ask your agent ------------------------------------------------------- */

/** Prompts people send, each answered by one live part: AI and UI mixed. */
const ASKS = [
  {
    name: "ai-checkout",
    prompt:
      "Add a checkout card to my agent's chat with @kokonutui/ai-checkout",
  },
  {
    name: "apple-activity-card",
    prompt: "Add @kokonutui/apple-activity-card to the dashboard",
  },
  {
    name: "ai-tool-calls",
    prompt: "Show tool calls in the replies with @kokonutui/ai-tool-calls",
  },
  {
    name: "slide-to-confirm",
    prompt: "Add a slide-to-pay button with @kokonutui/slide-to-confirm",
  },
  {
    name: "ai-schedule",
    prompt:
      "Let the assistant suggest meeting times with @kokonutui/ai-schedule",
  },
  {
    name: "spending-ring",
    prompt: "Add a spending breakdown with @kokonutui/spending-ring",
  },
];

/** The agents with a terminal command, plus the plain prompt for the rest. */
const DECK_AGENTS = AGENTS.filter((a) => a.id !== "vscode");

export function LandingAskAgent({ parts }: { parts: Part[] }) {
  const pick = usePick(parts);
  const asks = ASKS.flatMap((ask) => {
    const part = pick([ask.name])[0];
    return part ? [{ ...ask, part }] : [];
  });

  return (
    <>
      <section
        aria-label="Kokonut UI"
        className={cn("grid grid-cols-1 border", GRID, LINE)}
      >
        <MetaRow />
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          <div
            className={cn(
              "flex items-center p-5 sm:p-8 lg:col-span-8 lg:p-10",
              CELL
            )}
          >
            <h1
              className={cn(
                "home-enter font-semibold text-[clamp(40px,12.5vw,52px)] leading-[0.9] tracking-[-0.06em] sm:text-[clamp(52px,8vw,112px)]",
                INK
              )}
              style={enter(0)}
            >
              Ask your agent <br />
              for it.
            </h1>
          </div>
          <div
            className={cn(
              "flex items-end p-5 sm:p-8 lg:col-span-4 lg:px-10 lg:py-7",
              CELL
            )}
          >
            <p
              className={cn(
                "home-enter max-w-[520px] text-pretty text-[17px] leading-relaxed",
                SOFT
              )}
              style={enter(1)}
            >
              {parts.length} open-source React components for AI chat and the
              app around it. Name one in Claude Code, Codex, Cursor or any
              agent, and it lands in your repo as a file you own.
            </p>
          </div>
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:px-8 lg:col-span-8 lg:px-10",
              CELL
            )}
          >
            <HeroActions count={parts.length} />
          </div>
          <VercelCell className="lg:col-span-4" />
        </div>

        <PromptDeck asks={asks} />
      </section>

      <MixedPlates parts={parts} pick={pick} />
      <Agents number="02" />
      <Index number="03" parts={parts} />
      <References number="04" />
      <Supplement number="05" />
    </>
  );
}

/**
 * Prompts on the left, the part each one installs on the right. Picking a
 * prompt swaps the part at once (people compare back and forth); the part
 * mounts fresh, so its own entrance plays.
 */
function PromptDeck({
  asks,
}: {
  asks: { name: string; prompt: string; part: Part }[];
}) {
  const [agentId, setAgentId] = useState<AgentId>("claude");
  const [name, setName] = useState(asks[0]?.name);
  const agent = DECK_AGENTS.find((a) => a.id === agentId) ?? DECK_AGENTS[0];
  const current = asks.find((a) => a.name === name) ?? asks[0];
  if (!current) {
    return null;
  }
  const { Component: Demo, hint } = LIVE[current.part.name];

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
      <div
        className={cn("home-enter flex flex-col lg:col-span-5", CELL)}
        style={enter(1)}
      >
        <AgentTabs
          agents={DECK_AGENTS}
          className={cn("grid grid-cols-2 border-b sm:grid-cols-4", GRID, LINE)}
          itemClassName="h-10 justify-center px-2"
          onChange={setAgentId}
          value={agentId}
        />
        <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
          <legend className="sr-only">Prompts</legend>
          {asks.map((ask) => {
            const selected = ask.name === current.name;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "flex items-baseline gap-3 border-b px-4 py-3 text-left text-[14px] leading-snug",
                  LINE,
                  selected
                    ? "bg-[#f4f4f4] text-black dark:bg-[#161616] dark:text-white"
                    : "text-black/60 hover:bg-black/[0.02] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.03] dark:hover:text-white",
                  EASE_COLORS,
                  FOCUS_INSET
                )}
                key={ask.name}
                onClick={() => setName(ask.name)}
                type="button"
              >
                <span
                  className={cn(
                    MONO,
                    "w-[5ch] shrink-0 text-[11.5px]",
                    selected ? LEAF : "text-black/45 dark:text-white/40"
                  )}
                >
                  {ask.part.code}
                </span>
                <span className="text-pretty">{ask.prompt}</span>
              </button>
            );
          })}
        </fieldset>
        <div className="mt-auto flex flex-col gap-2 p-4">
          <p className={META}>
            {agent.cli
              ? `In your terminal, with ${agent.label}`
              : "Paste it into your agent"}
          </p>
          <CopyLine
            className={cn("text-[13px]", INK)}
            label="prompt"
            prefix={agent.cli ? "$" : "›"}
            value={runPrompt(agent, current.prompt)}
          />
        </div>
      </div>
      <figure
        className={cn("home-enter flex flex-col lg:col-span-7", CELL)}
        style={enter(1)}
      >
        <div className="flex items-baseline justify-between gap-4 px-4 pt-3.5">
          <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
            {current.part.code}
          </span>
          <span className={cn(META, "truncate")}>{hint}</span>
        </div>
        <div className="relative flex min-h-[520px] flex-1 items-center justify-center px-5 py-6">
          <Suspense fallback={<LiveFallback />}>
            <Demo key={current.part.name} />
          </Suspense>
        </div>
        <PlateFoot part={current.part} />
      </figure>
    </div>
  );
}

/** The categories with live parts on the page, AI first. */
const FILTERS = [
  { id: "all", label: "All" },
  { id: "ai", label: "AI" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs" },
  { id: "cards", label: "Cards" },
  { id: "texts", label: "Text" },
];

/** "All" alternates AI and UI parts, so no row is only one kind. */
const MIXED = [
  "ai-autocomplete",
  "hold-button",
  "boarding-pass",
  "detent-dial",
  "ai-model-selector",
  "ai-tool-calls",
  "ai-prompt",
  "wheel-picker",
  "tear-button",
  "liquid-gauge",
  "ai-context-meter",
  "plucked-text",
];
/** Pool per category, from every live part. */
const POOL = [
  ...MIXED,
  "ai-loading",
  "ai-handoff",
  "ai-input-search",
  "slide-to-confirm",
  "bell-button",
  "pull-cord",
  "amount-pad",
  "stay-picker",
  "spending-ring",
  "receipt-printer",
  "activity-terrain",
];

function MixedPlates({ parts, pick }: { parts: Part[]; pick: Pick }) {
  const [filter, setFilter] = useState("all");
  const shown =
    filter === "all"
      ? pick(MIXED)
      : pick(POOL)
          .filter((p) => p.categorySlug === filter)
          .slice(0, 6);
  const total = (slug: string) =>
    slug === "all"
      ? parts.length
      : parts.filter((p) => p.categorySlug === slug).length;
  const label = FILTERS.find((f) => f.id === filter)?.label ?? "All";

  return (
    <section aria-labelledby="components" className="pt-24 md:pt-32">
      <SectionHead
        aside="AI parts and the controls, cards and text around them, in one place. Every one runs live here and installs as a single file."
        id="components"
        number="01"
        title="Components"
      />
      <fieldset
        className={cn(
          "m-0 grid min-w-0 grid-cols-3 border border-b-0 p-0 sm:grid-cols-6",
          GRID,
          LINE
        )}
      >
        <legend className="sr-only">Category</legend>
        {FILTERS.map((f) => {
          const selected = f.id === filter;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "flex h-10 items-baseline justify-between gap-2 px-4 pt-3 font-medium text-[13px]",
                CELL,
                selected
                  ? "bg-[#f4f4f4] text-black dark:bg-[#161616] dark:text-white"
                  : "text-black/55 hover:text-black/80 dark:text-white/55 dark:hover:text-white/80",
                EASE_COLORS,
                FOCUS_INSET
              )}
              key={f.id}
              onClick={() => setFilter(f.id)}
              type="button"
            >
              {f.label}
              <span className={cn(MONO, "text-[11px] tabular-nums opacity-70")}>
                {total(f.id)}
              </span>
            </button>
          );
        })}
      </fieldset>
      <div
        className={cn(
          "grid grid-cols-1 border sm:grid-cols-2 lg:grid-cols-3",
          GRID,
          LINE
        )}
      >
        {shown.map((part) => (
          <Plate key={part.name} part={part} />
        ))}
        {filter === "all" ? null : (
          <HoverLink
            className={cn(
              "group flex min-h-[120px] flex-col justify-end gap-1 p-4",
              CELL,
              "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
              EASE_COLORS,
              FOCUS_INSET
            )}
            href={`/docs/${filter}`}
          >
            <span
              className={cn(
                "font-medium text-[15px] underline-offset-4 group-hover:underline",
                INK
              )}
            >
              All {total(filter)} {label} components
            </span>
            <span className={META}>Open the category</span>
          </HoverLink>
        )}
      </div>
    </section>
  );
}

/* Prototype chrome --------------------------------------------------------- */

const PROPOSALS = [
  { href: "/", label: "Current" },
  { href: "/landing/a", label: "A. By screen" },
  { href: "/landing/b", label: "B. Ask your agent" },
];

/** Links between the proposals, above the cover. Not part of the design. */
export function ProposalNav({ current }: { current: string }) {
  return (
    <nav
      aria-label="Landing proposals"
      className={cn("mb-4 flex flex-wrap gap-x-5 gap-y-1", META)}
    >
      <span>Landing proposals</span>
      {PROPOSALS.map((p) => (
        <Link
          className={cn(
            "underline-offset-4 hover:underline",
            p.href === current && cn(INK, "underline"),
            FOCUS
          )}
          href={p.href}
          key={p.href}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
