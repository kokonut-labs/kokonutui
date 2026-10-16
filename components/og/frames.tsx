"use client";

import { type ReactNode, Suspense, useEffect } from "react";
import { installCommand } from "@/components/landing/home/data";
import { Fit, LIVE, LiveFallback } from "@/components/landing/home/live";
import {
  CELL,
  GRID,
  INK,
  LEAF,
  LINE,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { OgLogo } from "./logo";

/** What a frame needs to know about a part; plain data from the server. */
export interface FramePart {
  code: string;
  name: string;
  title: string;
  category: string;
  description?: string;
  dependencies: string[];
}

export type Theme = "light" | "dark";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/* Meta type is set larger than the site's 11.5px: a link preview is shown at
   about 40% of its size in a feed, so anything smaller turns to grain. */
const META = cn(MONO, "text-[15px] text-black/50 dark:text-white/50");

/**
 * One 1200 by 630 canvas, in a fixed theme whatever the browser prefers, so a
 * screenshot of it is the link-preview image.
 */
function Canvas({ theme, children }: { theme: Theme; children: ReactNode }) {
  // The page's own theme class would leak into a light frame, so the frame
  // sets it.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  }, [theme]);

  return (
    <div className={theme}>
      <div
        className={cn(
          "flex flex-col overflow-hidden bg-white p-7 antialiased dark:bg-black",
          INK
        )}
        data-og-frame
        style={{ width: OG_WIDTH, height: OG_HEIGHT }}
      >
        <div className={cn("grid min-h-0 flex-1 border", GRID, LINE)}>
          {children}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ cells }: { cells: ReactNode[] }) {
  return (
    <div className={cn("grid h-[54px] grid-cols-4", GRID)}>
      {cells.map((cell, i) => (
        <div
          className={cn("flex items-center gap-2.5 px-5", CELL)}
          // The row is fixed per frame, so the position is its identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: static row
          key={i}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}

function Brand({ theme }: { theme: Theme }) {
  return (
    <>
      <OgLogo dark={theme === "dark"} size={24} />
      <span className="font-medium text-[18px] tracking-[-0.01em]">
        Kokonut UI
      </span>
    </>
  );
}

const SITE_META = [
  "Component catalog",
  "React, Tailwind CSS, Motion",
  "Free and open source",
];

function Live({ name }: { name: string }) {
  const entry = LIVE[name];
  if (!entry) {
    return null;
  }
  const Demo = entry.Component;
  return (
    <Suspense fallback={<LiveFallback />}>
      <Demo />
    </Suspense>
  );
}

function Headline({ className }: { className?: string }) {
  return (
    <h1
      className={cn(
        "font-semibold tracking-[-0.06em]",
        INK,
        // Size first, then leading: cn() drops a leading set before a size.
        className,
        "leading-[0.9]"
      )}
    >
      Components
      <br />
      that feel right.
    </h1>
  );
}

/* A. Cover: the homepage's first screen, set for a link preview. ---------- */

export function CoverFrame({
  theme,
  featured,
  count,
}: {
  theme: Theme;
  featured: FramePart;
  count: number;
}) {
  return (
    <Canvas theme={theme}>
      <div className={cn("grid grid-rows-[54px_1fr_68px]", GRID)}>
        <MetaRow
          cells={[
            <Brand key="brand" theme={theme} />,
            ...SITE_META.map((label) => (
              <span className={META} key={label}>
                {label}
              </span>
            )),
          ]}
        />
        <div className={cn("grid grid-cols-12", GRID)}>
          <div
            className={cn(
              "col-span-8 flex flex-col justify-between px-9 pt-10 pb-9",
              CELL
            )}
          >
            <Headline className="text-[116px]" />
            <p
              className={cn(
                "max-w-[540px] text-pretty text-[21px] leading-[1.45]",
                SOFT
              )}
            >
              Open-source React components built with Tailwind CSS, Motion and
              shadcn/ui.
            </p>
          </div>
          <figure className={cn("col-span-4 flex flex-col", CELL)}>
            <div className="flex items-baseline justify-between px-5 pt-4">
              <span className={cn(MONO, "font-medium text-[15px]", LEAF)}>
                {featured.code}
              </span>
              <span className={META}>{featured.category}</span>
            </div>
            <div className="relative flex-1">
              <Fit className="p-5">
                <Live name={featured.name} />
              </Fit>
            </div>
            <figcaption className="flex flex-col gap-1 px-5 pb-4">
              <span className="font-medium text-[18px] tracking-[-0.01em]">
                {featured.title}
              </span>
              <span className={META}>
                {featured.dependencies.join(", ") || "no extra packages"}
              </span>
            </figcaption>
          </figure>
        </div>
        <div className={cn("grid grid-cols-12", GRID)}>
          <p
            className={cn(
              "col-span-8 flex items-center gap-3 px-9 text-[18px]",
              MONO,
              CELL
            )}
          >
            <span className={LEAF}>$</span>
            {installCommand(featured.name)}
          </p>
          <p
            className={cn(
              "col-span-4 flex items-center justify-between px-5 text-[18px]",
              CELL
            )}
          >
            <span className="font-medium">{count} components</span>
            <span className={cn(MONO, "text-[16px]", SOFT)}>kokonutui.com</span>
          </p>
        </div>
      </div>
    </Canvas>
  );
}

/* B. Plates: the headline beside four live parts. ------------------------ */

export function PlatesFrame({
  theme,
  plates,
  count,
}: {
  theme: Theme;
  plates: FramePart[];
  count: number;
}) {
  return (
    <Canvas theme={theme}>
      <div className={cn("grid grid-rows-[54px_1fr]", GRID)}>
        <MetaRow
          cells={[
            <Brand key="brand" theme={theme} />,
            ...SITE_META.map((label) => (
              <span className={META} key={label}>
                {label}
              </span>
            )),
          ]}
        />
        <div className={cn("grid grid-cols-3 grid-rows-2", GRID)}>
          <div
            className={cn(
              "row-span-2 flex flex-col justify-between p-7 pt-8",
              CELL
            )}
          >
            <Headline className="text-[58px]" />
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-[20px]">
                {count} components
              </span>
              <span className={cn(MONO, "text-[16px]", SOFT)}>
                kokonutui.com
              </span>
            </div>
          </div>
          {plates.slice(0, 4).map((part) => (
            <figure className={cn("flex flex-col", CELL)} key={part.name}>
              <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
                <span className={cn(MONO, "font-medium text-[14px]", LEAF)}>
                  {part.code}
                </span>
                <span className="truncate font-medium text-[15px] tracking-[-0.01em]">
                  {part.title}
                </span>
              </div>
              <div className="relative flex-1">
                <Fit className="px-4 py-3">
                  <Live name={part.name} />
                </Fit>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </Canvas>
  );
}

/* C. Index: the wordmark over the catalog's own index. ------------------- */

export function IndexFrame({
  theme,
  parts,
  count,
}: {
  theme: Theme;
  parts: FramePart[];
  count: number;
}) {
  const groups = new Map<string, FramePart[]>();
  for (const p of parts) {
    groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  }
  const columns = [...groups.entries()].slice(0, 4);

  return (
    <Canvas theme={theme}>
      <div className={cn("grid grid-rows-[1fr_250px]", GRID)}>
        <div className={cn("grid grid-cols-12", GRID)}>
          <div
            className={cn(
              "col-span-8 flex flex-col justify-between px-9 pt-9 pb-8",
              CELL
            )}
          >
            <OgLogo dark={theme === "dark"} size={56} />
            <div className="flex flex-col gap-5">
              <h1 className="font-semibold text-[104px] leading-[0.9] tracking-[-0.06em]">
                Kokonut UI
              </h1>
              <p className={cn("text-[22px] leading-snug", SOFT)}>
                {count} open-source React components, built with Tailwind CSS
                and Motion.
              </p>
            </div>
          </div>
          <div
            className={cn(
              "col-span-4 flex flex-col justify-between p-6 pt-7",
              CELL
            )}
          >
            <span className={META}>Install any of them</span>
            <p className={cn(MONO, "text-[17px] leading-[1.6]")}>
              <span className={LEAF}>$</span> npx shadcn@latest add
              <br />
              @kokonutui/<span className={SOFT}>{"{name}"}</span>
            </p>
            <span className={cn(MONO, "text-[16px]", SOFT)}>kokonutui.com</span>
          </div>
        </div>
        <div className={cn("grid grid-cols-4 overflow-hidden", GRID)}>
          {columns.map(([category, items]) => (
            <div className={cn("flex flex-col px-5 pt-4", CELL)} key={category}>
              <p className="mb-2.5 flex items-baseline justify-between font-medium text-[17px]">
                {category}
                <span className={META}>{items[0]?.code.slice(0, 2)}</span>
              </p>
              <ul className="flex flex-col">
                {items.map((p) => (
                  <li
                    className="flex items-baseline gap-3 py-[3px] text-[15px] text-black/70 dark:text-white/70"
                    key={p.name}
                  >
                    <span
                      className={cn(
                        MONO,
                        "w-[5ch] shrink-0 text-[13px] text-black/35 dark:text-white/35"
                      )}
                    >
                      {p.code}
                    </span>
                    <span className="truncate">{p.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Canvas>
  );
}

/* D. A component page, with the part itself. ----------------------------- */

export function DocFrame({ theme, part }: { theme: Theme; part: FramePart }) {
  return (
    <Canvas theme={theme}>
      <div className={cn("grid grid-rows-[54px_1fr_68px]", GRID)}>
        <MetaRow
          cells={[
            <Brand key="brand" theme={theme} />,
            <span className={META} key="category">
              {part.category}
            </span>,
            <span className={cn(MONO, "text-[15px]", LEAF)} key="code">
              {part.code}
            </span>,
            <span className={META} key="deps">
              {part.dependencies.join(", ") || "no extra packages"}
            </span>,
          ]}
        />
        <div className={cn("grid grid-cols-12", GRID)}>
          <div
            className={cn(
              "col-span-7 flex flex-col justify-between px-9 pt-10 pb-9",
              CELL
            )}
          >
            <h1 className="text-balance font-semibold text-[80px] leading-[0.95] tracking-[-0.05em]">
              {part.title}
            </h1>
            <p
              className={cn(
                "line-clamp-3 max-w-[560px] text-pretty text-[21px] leading-[1.45]",
                SOFT
              )}
            >
              {part.description}
            </p>
          </div>
          <div className={cn("relative col-span-5", CELL)}>
            <Fit className="p-8" maxScale={1.5}>
              <Live name={part.name} />
            </Fit>
          </div>
        </div>
        <div className={cn("grid grid-cols-12", GRID)}>
          <p
            className={cn(
              "col-span-7 flex items-center gap-3 truncate px-9 text-[17px]",
              MONO,
              CELL
            )}
          >
            <span className={LEAF}>$</span>
            {installCommand(part.name)}
          </p>
          <p
            className={cn(
              "col-span-5 flex items-center justify-end px-6 text-[16px]",
              MONO,
              SOFT,
              CELL
            )}
          >
            kokonutui.com
          </p>
        </div>
      </div>
    </Canvas>
  );
}
