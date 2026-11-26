"use client";

import { useRef, useState } from "react";
import { HoverLink } from "@/components/hover-link";
import {
  Agents,
  HeroActions,
  PlateCopy,
  References,
  Supplement,
} from "@/components/landing/home/catalog";
import { AgentIcon } from "@/components/landing/home/client";
import { installCommand } from "@/components/landing/home/data";
import { Fit, LIVE } from "@/components/landing/home/live";
import type { Part } from "@/components/landing/home/parts";
import {
  CELL,
  EASE_COLORS,
  enter,
  FOCUS,
  GRID,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { componentPrompt } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { PartDemo } from "./demo";

/*
 * 2. Contents. The cover is the whole library as a table of contents, in
 * type: nine categories, every component by name. Point at a name (or tab
 * to it) and it runs on the stage beside the list, with its install line.
 * No plates, no grid of demos: one stage, 116 things to put on it.
 */

const FIRST = "ai-checkout";

export function Contents({ parts }: { parts: Part[] }) {
  const [current, setCurrent] = useState(
    () => parts.find((p) => p.name === FIRST) ?? parts[0]
  );
  const stage = useRef<HTMLDivElement>(null);
  const groups = new Map<string, Part[]>();
  for (const p of parts) {
    groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  }

  // Stacked, the stage is above the list: picking a name brings it back
  // into view. Side by side it's already there.
  const pick = (part: Part, reveal: boolean) => {
    setCurrent(part);
    if (reveal && !window.matchMedia("(min-width: 1024px)").matches) {
      stage.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  return (
    <>
      <section
        aria-label="Kokonut UI"
        className={cn("grid grid-cols-1 border", GRID, LINE)}
      >
        <div className={cn("grid grid-cols-2 md:grid-cols-4", GRID)}>
          {[
            "Kokonut UI",
            `${parts.length} components, ${groups.size} categories`,
            "React, Tailwind CSS, Motion",
            "Free and open source",
          ].map((label, i) => (
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
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          {/* Stacked: headline, stage, list. Side by side, the stage spans
              both rows on the right and stays put while the list scrolls. */}
          <div
            className={cn(
              "flex flex-col gap-6 p-5 pt-8 sm:p-8 sm:pt-12 lg:col-span-7 lg:p-10",
              CELL
            )}
          >
            <h1
              className={cn(
                "home-enter font-semibold text-[clamp(38px,11vw,48px)] leading-[0.92] tracking-[-0.055em] sm:text-[clamp(48px,6vw,84px)]",
                INK
              )}
              style={enter(0)}
            >
              UI and AI components. <br />
              Point at one.
            </h1>
            <p
              className={cn(
                "home-enter max-w-[560px] text-pretty text-[17px] leading-relaxed",
                SOFT
              )}
              style={enter(1)}
            >
              <span className={INK}>
                The whole library, by name, every one of them live.
              </span>{" "}
              Each installs as one file with the shadcn CLI, or ask your agent
              for it.
            </p>
            <HeroActions count={parts.length} />
          </div>
          <div
            className={cn(
              "lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1",
              CELL
            )}
          >
            <Stage part={current} ref={stage} />
          </div>
          <ol
            aria-label="All components"
            className={cn("flex flex-col lg:col-span-7", CELL)}
          >
            {[...groups].map(([category, items], i) => (
              <li
                className={cn(
                  "grid grid-cols-[40px_1fr] gap-x-3 border-b px-5 py-6 last:border-b-0 sm:grid-cols-[56px_1fr] sm:px-8 lg:px-10",
                  LINE
                )}
                key={category}
              >
                <span
                  className={cn(MONO, "pt-2 font-medium text-[12px]", LEAF)}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  <h2
                    className={cn(
                      "flex items-baseline gap-2 font-semibold text-[28px] leading-none tracking-[-0.04em] sm:text-[34px]",
                      INK
                    )}
                  >
                    {category}
                    <span className={cn(META, "tracking-normal")}>
                      {items.length}
                    </span>
                  </h2>
                  <p className="text-pretty text-[16px] leading-[1.75] sm:text-[17px]">
                    {items.map((part, j) => (
                      // The slash stays with the name before it, so a line
                      // never starts with one.
                      <span key={part.name}>
                        <span className="whitespace-nowrap">
                          <NameButton
                            current={current.name === part.name}
                            onPick={(reveal) => pick(part, reveal)}
                            part={part}
                          />
                          {j < items.length - 1 ? (
                            <span
                              aria-hidden
                              className="text-black/25 dark:text-white/25"
                            >
                              {" "}
                              /
                            </span>
                          ) : null}
                        </span>{" "}
                      </span>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Agents number="01" />
      <References number="02" />
      <Supplement number="03" />
    </>
  );
}

/**
 * A name in the list. Pointing at it puts it on the stage at once: you
 * sweep along these dozens of times, so the swap has no animation; only the
 * name's color eases.
 */
function NameButton({
  part,
  current,
  onPick,
}: {
  part: Part;
  current: boolean;
  onPick: (reveal: boolean) => void;
}) {
  return (
    <button
      aria-pressed={current}
      className={cn(
        "rounded-sm text-left underline-offset-[5px]",
        current
          ? cn(
              INK,
              "underline decoration-2 decoration-[#15852A] dark:decoration-[#3BB44B]"
            )
          : "text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white",
        EASE_COLORS,
        FOCUS
      )}
      onClick={() => onPick(true)}
      onFocus={() => onPick(false)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          onPick(false);
        }
      }}
      type="button"
    >
      {part.title}
      {part.isNew ? (
        <span className={cn(MONO, "ml-1 align-super text-[10px]", LEAF)}>
          New
        </span>
      ) : null}
    </button>
  );
}

/** The part under the pointer, live, with what it takes to install it. */
function Stage({ part, ref }: { part: Part; ref: React.Ref<HTMLDivElement> }) {
  const hint = LIVE[part.name]?.hint;
  return (
    <div
      className="flex scroll-mt-20 flex-col lg:sticky lg:top-[116px]"
      ref={ref}
    >
      <div
        className={cn(
          "flex items-baseline justify-between gap-4 border-b px-4 py-3",
          LINE
        )}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={cn(MONO, "shrink-0 font-medium text-[12px]", LEAF)}>
            {part.code}
          </span>
          <HoverLink
            className={cn(
              "truncate rounded-sm font-medium text-[15px] underline-offset-4 hover:underline",
              INK,
              FOCUS
            )}
            href={part.url}
          >
            {part.title}
          </HoverLink>
        </span>
        <span className={cn(META, "hidden shrink-0 sm:inline")}>
          {hint ?? part.category}
        </span>
      </div>
      {/* Keyed by name, so each part mounts fresh and plays its own entrance. */}
      <div className="relative h-[360px] sm:h-[440px]" key={part.name}>
        <Fit className="px-6 py-6">
          <PartDemo part={part} />
        </Fit>
      </div>
      <div className={cn("flex flex-col gap-3 border-t p-4", LINE)}>
        {part.description ? (
          <p
            className={cn(
              "line-clamp-2 text-pretty text-[14px] leading-snug",
              SOFT
            )}
          >
            {part.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn(META, "truncate")}>
            {part.dependencies.join(", ") || "no extra packages"}
          </span>
          <span className="flex gap-1.5">
            <PlateCopy
              icon={AgentIcon}
              label="Agent"
              target={`prompt for your agent to add ${part.name}`}
              value={componentPrompt(part.name)}
            />
            <PlateCopy
              label="Copy"
              target={`install command for ${part.name}`}
              value={installCommand(part.name)}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
