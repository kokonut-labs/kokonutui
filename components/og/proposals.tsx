"use client";

import type { ReactNode } from "react";
import { installCommand } from "@/components/landing/home/data";
import { Fit } from "@/components/landing/home/live";
import {
  CELL,
  GRID,
  INK,
  LEAF,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import {
  Brand,
  Canvas,
  type FramePart,
  Live,
  META,
  MetaRow,
  SITE_META,
  type Theme,
} from "./frames";
import { AI_PART, type ProposalId, SHEET_PARTS } from "./proposal-list";

/** One docs category, as the index lists it. */
export interface FrameCategory {
  code: string;
  title: string;
  count: number;
}

/** What every proposal is drawn from; plain data from the server. */
export interface ProposalData {
  count: number;
  categories: FrameCategory[];
  /** Parts the proposals feature, by name. */
  parts: Record<string, FramePart>;
  /** A few AI components' titles, for the AI proposal's list. */
  aiTitles: string[];
}

/** The part every proposal's install line names. */
const INSTALL_PART = "slide-to-confirm";

function SiteRow({ theme }: { theme: Theme }) {
  return (
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
  );
}

function Install({ name, className }: { name: string; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 px-9 text-[18px]",
        MONO,
        CELL,
        className
      )}
    >
      <span className={LEAF}>$</span>
      {installCommand(name)}
    </p>
  );
}

function Tagline({ className }: { className?: string }) {
  return (
    <h1
      className={cn(
        "font-semibold tracking-[-0.06em]",
        INK,
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

/** A: six live parts on one sheet, so the preview shows a range, not one card. */
function SheetFrame({ theme, data }: { theme: Theme; data: ProposalData }) {
  const parts = SHEET_PARTS.flatMap((name) => data.parts[name] ?? []);
  return (
    <Canvas theme={theme}>
      <div className={cn("grid grid-rows-[54px_1fr_68px]", GRID)}>
        <SiteRow theme={theme} />
        <div className={cn("grid grid-cols-12", GRID)}>
          <div
            className={cn(
              "col-span-5 flex flex-col justify-between px-9 pt-10 pb-9",
              CELL
            )}
          >
            <Tagline className="text-[66px]" />
            <p className={cn("text-pretty text-[20px] leading-[1.45]", SOFT)}>
              Open-source React components built with Tailwind CSS, Motion and
              shadcn/ui.
            </p>
          </div>
          <div className={cn("col-span-7 grid grid-cols-3 grid-rows-2", GRID)}>
            {parts.map((part) => (
              <figure className={cn("flex flex-col", CELL)} key={part.name}>
                <span
                  className={cn(
                    MONO,
                    "px-4 pt-3 font-medium text-[13px]",
                    LEAF
                  )}
                >
                  {part.code}
                </span>
                <div className="relative flex-1">
                  <Fit className="p-3">
                    <Live name={part.name} />
                  </Fit>
                </div>
                <figcaption className="truncate px-4 pb-3 font-medium text-[14px]">
                  {part.title}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
        <div className={cn("grid grid-cols-12", GRID)}>
          <p
            className={cn(
              "col-span-5 flex items-center gap-2 px-9 text-[18px]",
              CELL
            )}
          >
            <span className="font-medium">{data.count} components</span>
            <span className={SOFT}>in {data.categories.length} categories</span>
          </p>
          <Install className="col-span-7 px-5" name={INSTALL_PART} />
        </div>
      </div>
    </Canvas>
  );
}

/** B: type only. The tagline beside the catalog's table of contents. */
function IndexFrame({ theme, data }: { theme: Theme; data: ProposalData }) {
  return (
    <Canvas theme={theme}>
      <div className={cn("grid grid-rows-[54px_1fr_68px]", GRID)}>
        <SiteRow theme={theme} />
        <div className={cn("grid grid-cols-12", GRID)}>
          <div
            className={cn(
              "col-span-7 flex flex-col justify-between px-9 pt-10 pb-9",
              CELL
            )}
          >
            <Tagline className="text-[88px]" />
            <p
              className={cn(
                "max-w-[520px] text-pretty text-[21px] leading-[1.45]",
                SOFT
              )}
            >
              Open-source React components built with Tailwind CSS, Motion and
              shadcn/ui.
            </p>
          </div>
          <div className={cn("col-span-5 flex flex-col px-7 py-5", CELL)}>
            <div className="flex items-baseline justify-between pb-2">
              <span className={META}>Index</span>
              <span className={META}>{data.count}</span>
            </div>
            <ol className="flex flex-1 flex-col justify-between">
              {data.categories.map((category) => (
                <li
                  className="flex items-baseline gap-4 text-[22px] tracking-[-0.01em]"
                  key={category.code}
                >
                  <span
                    className={cn(MONO, "w-8 font-medium text-[15px]", LEAF)}
                  >
                    {category.code}
                  </span>
                  <span className="flex-1 font-medium">{category.title}</span>
                  <span className={cn(MONO, "text-[17px] tabular-nums", SOFT)}>
                    {category.count}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className={cn("grid grid-cols-12", GRID)}>
          <Install className="col-span-7" name={INSTALL_PART} />
          <p
            className={cn(
              "col-span-5 flex items-center justify-end px-7 text-[16px]",
              MONO,
              CELL,
              SOFT
            )}
          >
            kokonutui.com
          </p>
        </div>
      </div>
    </Canvas>
  );
}

/** C: leads with the AI shelf, the one people search for most now. */
function AiFrame({ theme, data }: { theme: Theme; data: ProposalData }) {
  const featured = data.parts[AI_PART];
  const ai = data.categories.find((category) => category.code === "AI");
  return (
    <Canvas theme={theme}>
      <div className={cn("grid grid-rows-[54px_1fr_68px]", GRID)}>
        <SiteRow theme={theme} />
        <div className={cn("grid grid-cols-12", GRID)}>
          <div
            className={cn(
              "col-span-7 flex flex-col justify-between px-9 pt-10 pb-9",
              CELL
            )}
          >
            <h1
              className={cn(
                "font-semibold text-[92px] tracking-[-0.06em]",
                INK,
                "leading-[0.92]"
              )}
            >
              AI interfaces
              <br />
              that feel right.
            </h1>
            <p
              className={cn(
                "max-w-[560px] text-pretty text-[19px] leading-[1.5]",
                SOFT
              )}
            >
              {data.aiTitles.join(", ")} and more.
            </p>
          </div>
          {featured ? (
            <figure className={cn("col-span-5 flex flex-col", CELL)}>
              <div className="flex items-baseline justify-between px-5 pt-4">
                <span className={cn(MONO, "font-medium text-[15px]", LEAF)}>
                  {featured.code}
                </span>
                <span className={META}>{featured.category}</span>
              </div>
              <div className="relative flex-1">
                <Fit className="p-6">
                  {/* Drawn larger: a feed shows the image at about 40%. */}
                  <div className="[zoom:1.3]">
                    <Live name={featured.name} />
                  </div>
                </Fit>
              </div>
              <figcaption className="px-5 pb-4 font-medium text-[18px] tracking-[-0.01em]">
                {featured.title}
              </figcaption>
            </figure>
          ) : null}
        </div>
        <div className={cn("grid grid-cols-12", GRID)}>
          <Install
            className="col-span-7"
            name={featured?.name ?? INSTALL_PART}
          />
          <p
            className={cn(
              "col-span-5 flex items-center justify-between px-5 text-[18px]",
              CELL
            )}
          >
            <span className="font-medium">
              {ai?.count ?? 0} AI, {data.count} in all
            </span>
            <span className={cn(MONO, "text-[16px]", SOFT)}>kokonutui.com</span>
          </p>
        </div>
      </div>
    </Canvas>
  );
}

const FRAMES: Record<
  ProposalId,
  (props: { theme: Theme; data: ProposalData }) => ReactNode
> = {
  sheet: SheetFrame,
  index: IndexFrame,
  ai: AiFrame,
};

export function ProposalFrame({
  id,
  theme,
  data,
}: {
  id: ProposalId;
  theme: Theme;
  data: ProposalData;
}) {
  const Frame = FRAMES[id];
  return <Frame data={data} theme={theme} />;
}
