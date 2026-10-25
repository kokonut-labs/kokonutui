"use client";

import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ClientPicker, CopyLine } from "../home/controls";
import {
  installCommand,
  type McpClient,
  mcpCommand,
  VERCEL_OSS_URL,
} from "../home/data";
import type { Part } from "../home/parts";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  GRID,
  INK,
  LEAF,
  LINE,
  MONO,
  SOFT,
} from "../home/styles";
import {
  BrowseButton,
  DEMOS,
  Demo,
  Faq,
  FinalCta,
  META,
  Proof,
  SectionHead,
  Tagline,
} from "./shared";

/**
 * A: Try it first. A classic hero with one live app component beside the
 * promise, then the argument: what you own, how your agent installs it, the
 * motion, and proof.
 */
export function ProposalA({ parts }: { parts: Part[] }) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const count = parts.length;
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-32 sm:px-6 md:pt-12">
      <Hero count={count} part={byName.get("ai-tool-approval")} />
      <Tagline
        lines={[
          "You own every file it installs.",
          "Change it like code you wrote.",
        ]}
        reveal
      />
      <Benefits byName={byName} parts={parts} />
      <Steps />
      <Proof />
      <Faq />
      <FinalCta
        action={<BrowseButton count={count} />}
        body="Every component runs live on its docs page. Try it, then add it with one command or one prompt."
        title="Free React components with the details already done"
      />
    </div>
  );
}

function Hero({ count, part }: { count: number; part?: Part }) {
  const [run, setRun] = useState(0);
  return (
    <section
      aria-labelledby="hero"
      className={cn("grid grid-cols-1 border lg:grid-cols-12", GRID, LINE)}
    >
      <div
        className={cn(
          "flex flex-col gap-8 p-6 sm:p-8 lg:col-span-7 lg:p-12",
          CELL
        )}
      >
        <h1
          className={cn(
            "home-enter max-w-[680px] text-balance font-semibold text-5xl tracking-tighter sm:text-6xl lg:text-7xl",
            INK
          )}
          id="hero"
        >
          Free React components <br className="hidden sm:block" />
          with the details already done
        </h1>
        <p className={cn("home-enter max-w-[680px] text-pretty text-lg", SOFT)}>
          {count} animated components for shadcn/ui projects, from AI chat
          inputs to checkout. Try each one on this page, then add it with one
          command or one prompt to your agent.
        </p>
        <div className="home-enter flex flex-col gap-6 sm:flex-row sm:items-center">
          <BrowseButton count={count} />
          <p className={cn("text-sm", SOFT)}>
            MIT licensed ·{" "}
            <a
              className={cn(
                "rounded-sm underline decoration-black/20 underline-offset-4 hover:decoration-black dark:decoration-white/25 dark:hover:decoration-white",
                INK,
                EASE_COLORS,
                FOCUS
              )}
              href={VERCEL_OSS_URL}
              rel="noreferrer"
              target="_blank"
            >
              Backed by Vercel OSS
            </a>
          </p>
        </div>
      </div>
      {part ? (
        <figure className={cn("flex flex-col lg:col-span-5", CELL)}>
          <div className="flex items-baseline justify-between gap-4 px-4 pt-4">
            <span
              className={cn(
                MONO,
                "shrink-0 whitespace-nowrap font-medium text-xs",
                LEAF
              )}
            >
              {part.code}
            </span>
            <span className="flex min-w-0 items-baseline gap-3">
              <span className={cn(META, "truncate")}>
                {DEMOS["ai-tool-approval"].hint}
              </span>
              <button
                className={cn(
                  META,
                  "inline-flex shrink-0 items-center gap-1 hover:text-black dark:hover:text-white",
                  EASE_COLORS,
                  FOCUS
                )}
                onClick={() => setRun((r) => r + 1)}
                type="button"
              >
                Replay
                <RotateCcwIcon aria-hidden className="size-3" />
              </button>
            </span>
          </div>
          <Demo className="min-h-96 flex-1" name={part.name} run={run} />
          <figcaption className="flex items-end justify-between gap-4 px-4 pb-4">
            <Link
              className={cn(
                "rounded-sm font-medium text-base underline-offset-4 hover:underline",
                INK,
                FOCUS
              )}
              href={part.url}
            >
              {part.title}
            </Link>
            <span className={META}>{part.category}</span>
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}

function Benefits({
  parts,
  byName,
}: {
  parts: Part[];
  byName: Map<string, Part>;
}) {
  const save = byName.get("save-button");
  const groups = new Map<string, number>();
  for (const p of parts) {
    groups.set(p.category, (groups.get(p.category) ?? 0) + 1);
  }
  return (
    <section aria-labelledby="benefits">
      <SectionHead
        aside="What changes when a component comes from a registry instead of a package."
        id="benefits"
        title="Why teams use Kokonut UI"
      />
      <div className={cn("grid grid-cols-1 border md:grid-cols-2", GRID, LINE)}>
        <Benefit
          detail="The CLI writes one file into components/kokonutui and installs its packages. No wrapper, no version to pin."
          title="The source lands in your repo"
        >
          {save ? (
            <div
              className={cn(
                "flex flex-col gap-2 border p-4 text-sm",
                LINE,
                MONO
              )}
            >
              <span className={META}>{installCommand("save-button")}</span>
              {save.files.map((f) => (
                <span className={INK} key={f}>
                  <span className={LEAF}>+ </span>
                  {f}
                </span>
              ))}
              {save.dependencies.map((d) => (
                <span className={SOFT} key={d}>
                  <span className={LEAF}>+ </span>
                  {d} <span className={META}>package</span>
                </span>
              ))}
            </div>
          ) : null}
        </Benefit>
        <Benefit
          detail="Connect your editor once. After that, ask for a component by name or describe the screen you are building."
          title="Your agent can install it"
        >
          <AgentConnect />
        </Benefit>
        <Benefit
          detail="Springs, easing and timing are set per component, not left at library defaults. Turn the dial: it clicks into each step."
          title="Motion tuned by hand"
        >
          <Demo className="h-64" name="detent-dial" />
        </Benefit>
        <Benefit
          detail="Most of the library is for product screens, not just landing pages."
          title={`${parts.length} components across ${groups.size} categories`}
        >
          <ul className={cn("grid grid-cols-2 border", GRID, LINE)}>
            {[...groups.entries()].map(([category, n]) => (
              <li
                className={cn(
                  "flex items-baseline justify-between gap-2 px-3 py-2 text-sm",
                  CELL
                )}
                key={category}
              >
                <span className={INK}>{category}</span>
                <span className={META}>{n}</span>
              </li>
            ))}
          </ul>
        </Benefit>
      </div>
    </section>
  );
}

function Benefit({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-6 p-6 md:p-8", CELL)}>
      <div className="flex max-w-[480px] flex-col gap-2">
        <h3 className={cn("font-semibold text-xl tracking-tight", INK)}>
          {title}
        </h3>
        <p className={cn("text-pretty text-base", SOFT)}>{detail}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function AgentConnect() {
  const [client, setClient] = useState<McpClient>("claude");
  return (
    <div className="flex flex-col gap-4">
      <ClientPicker
        className={cn("grid grid-cols-2 border sm:grid-cols-4", GRID, LINE)}
        itemClassName={cn("h-10 justify-start px-3", CELL)}
        onChange={setClient}
        selectedClassName="bg-[#f4f4f4] dark:bg-[#181818]"
        value={client}
      />
      <CopyLine
        className={cn("text-sm", INK)}
        prefix="$"
        value={mcpCommand(client)}
      />
      <CopyLine
        className={cn("text-sm", INK)}
        label="prompt"
        prefix="›"
        value="Add a tool approval prompt to the agent chat"
      />
    </div>
  );
}

function Steps() {
  return (
    <section aria-labelledby="how" className="pt-24 md:pt-32">
      <SectionHead
        aside="Three steps, the same in every React project with Tailwind CSS v4."
        id="how"
        title="How it works"
      />
      <ol className={cn("grid grid-cols-1 border md:grid-cols-3", GRID, LINE)}>
        {[
          {
            title: "Try it on its page",
            body: "Every component runs live in the docs, with its props and the packages it installs listed above the demo.",
            line: { prefix: "→", value: "kokonutui.com/docs" },
          },
          {
            title: "Add it with one command",
            body: "Or one prompt to your agent. The file and its packages land in your project.",
            line: { prefix: "$", value: installCommand("slide-to-confirm") },
          },
          {
            title: "Make it yours",
            body: "Change the copy, colors and timing in the file. There is nothing to override.",
            line: {
              prefix: "›",
              value: "components/kokonutui/slide-to-confirm.tsx",
            },
          },
        ].map((s, i) => (
          <li
            className={cn("flex min-h-64 flex-col gap-4 p-6", CELL)}
            key={s.title}
          >
            <span
              className={cn(
                MONO,
                "shrink-0 whitespace-nowrap font-medium text-xs",
                LEAF
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className={cn("font-semibold text-xl tracking-tight", INK)}>
              {s.title}
            </h3>
            <p className={cn("text-pretty text-base", SOFT)}>{s.body}</p>
            <CopyLine
              className={cn("mt-auto text-sm", INK)}
              prefix={s.line.prefix}
              value={s.line.value}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
