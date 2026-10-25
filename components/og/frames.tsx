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
export const META = cn(MONO, "text-[15px] text-black/50 dark:text-white/50");

/**
 * One 1200 by 630 canvas, in a fixed theme whatever the browser prefers, so a
 * screenshot of it is the link-preview image.
 */
export function Canvas({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
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

export function MetaRow({ cells }: { cells: ReactNode[] }) {
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

export function Brand({ theme }: { theme: Theme }) {
  return (
    <>
      <OgLogo dark={theme === "dark"} size={24} />
      <span className="font-medium text-[18px] tracking-[-0.01em]">
        Kokonut UI
      </span>
    </>
  );
}

export const SITE_META = [
  "Component catalog",
  "React, Tailwind CSS, Motion",
  "Free and open source",
];

export function Live({ name }: { name: string }) {
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

/** The homepage's first screen, set as its link preview. */

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
