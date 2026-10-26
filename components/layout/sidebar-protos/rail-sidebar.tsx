"use client";

import Link from "fumadocs-core/link";
import { ArrowRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  EASE_COLORS,
  FOCUS_INSET,
  LEAF,
  LINE,
  MONO,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { ProtoFooter, ProtoTitle, SearchRow, useIsActive } from "./chrome";
import { useSidebarProto } from "./context";
import type { SidebarLink } from "./model";
import { ProtoShell } from "./shell";

const START = "start";

interface Panel {
  id: string;
  code: string;
  name: string;
  url?: string;
  items: SidebarLink[];
  added: number;
}

function PanelRow({
  link,
  index,
  active,
}: {
  link: SidebarLink;
  index?: number;
  active: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: "center" });
    }
  }, [active]);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 items-center gap-2.5 px-3 text-[13.5px]",
        active
          ? "bg-black/[0.045] font-medium text-black dark:bg-white/[0.07] dark:text-white"
          : "text-black/60 hover:bg-black/[0.03] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white",
        EASE_COLORS,
        FOCUS_INSET
      )}
      href={link.url}
      ref={ref}
    >
      {index !== undefined && (
        <span
          className={cn(
            MONO,
            "w-[2ch] shrink-0 text-[11px]",
            active ? LEAF : "text-black/30 dark:text-white/30"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{link.name}</span>
      {link.pro && (
        <span className={cn(MONO, "text-[#FF2D55] text-[10.5px]")}>PRO</span>
      )}
    </Link>
  );
}

/**
 * B · Rail. Two columns: the category codes down a narrow rail, and only the
 * chosen category's parts beside it. Picking a code swaps the list without
 * leaving the page; the list always opens on the page being read.
 */
export function RailSidebar({ footer }: { footer?: ReactNode }) {
  const { model } = useSidebarProto();
  const isActive = useIsActive();

  const panels: Panel[] = [
    {
      id: START,
      code: "Docs",
      name: "Get started",
      items: model.guide,
      added: 0,
    },
    ...model.sections.map((section) => ({
      id: section.name,
      code: section.code,
      name: section.name,
      url: section.url,
      items: section.items,
      added: section.added,
    })),
  ];

  const current =
    panels.find(
      (panel) =>
        panel.items.some((item) => isActive(item.url)) ||
        (panel.url && isActive(panel.url))
    )?.id ?? START;
  const [chosen, setChosen] = useState(current);
  useEffect(() => setChosen(current), [current]);
  const panel = panels.find((item) => item.id === chosen) ?? panels[0];
  const parts = panel.items.filter((item) => item.code).length;

  return (
    <ProtoShell wide>
      <ProtoTitle />
      <div className="px-4 pb-3">
        <SearchRow />
      </div>
      <div className={cn("flex min-h-0 flex-1 border-t", LINE)}>
        <nav
          aria-label="Categories"
          className={cn(
            "flex w-14 shrink-0 flex-col overflow-y-auto border-e",
            LINE
          )}
        >
          {panels.map((item) => {
            const selected = item.id === chosen;
            const here = item.id === current;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "relative flex h-14 shrink-0 flex-col items-center justify-center gap-1 border-b",
                  LINE,
                  selected
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-black/55 hover:bg-black/[0.03] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.04] dark:hover:text-white",
                  EASE_COLORS,
                  FOCUS_INSET
                )}
                key={item.id}
                onClick={() => setChosen(item.id)}
                title={item.name}
                type="button"
              >
                <span className={cn(MONO, "font-medium text-[12px]")}>
                  {item.code}
                </span>
                <span
                  className={cn(
                    MONO,
                    "text-[9.5px]",
                    selected ? "opacity-60" : "opacity-50"
                  )}
                >
                  {item.id === START
                    ? item.items.length
                    : item.items.filter((link) => link.code).length}
                </span>
                {here && !selected && (
                  <span
                    aria-hidden
                    className="absolute inset-y-3 end-0 w-0.5 bg-[#1FA834] dark:bg-[#3BB44B]"
                  />
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="px-3 pt-3 pb-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-[15px] text-black tracking-[-0.01em] dark:text-white">
                {panel.name}
              </span>
              {panel.url && (
                <Link
                  className={cn(
                    MONO,
                    "flex items-center gap-1 text-[11px] text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white",
                    EASE_COLORS,
                    FOCUS_INSET
                  )}
                  href={panel.url}
                >
                  All <ArrowRight aria-hidden className="size-3" />
                </Link>
              )}
            </div>
            {panel.id !== START && (
              <p
                className={cn(
                  MONO,
                  "mt-1 text-[11px] text-black/45 dark:text-white/45"
                )}
              >
                {parts} parts
                {panel.added > 0 && (
                  <span className={LEAF}> · {panel.added} new</span>
                )}
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
            {panel.items.map((link, i) => (
              <PanelRow
                active={isActive(link.url)}
                index={panel.id === START ? undefined : i}
                key={link.url}
                link={link}
              />
            ))}
          </div>
        </div>
      </div>
      <ProtoFooter footer={footer} />
    </ProtoShell>
  );
}
