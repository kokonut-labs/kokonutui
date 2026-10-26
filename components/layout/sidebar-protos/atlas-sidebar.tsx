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

const SOFT_TEXT = "text-black/45 dark:text-white/45";

/** One part as one cell on the map. */
function Cell({
  link,
  active,
  lit,
  onHover,
}: {
  link: SidebarLink;
  active: boolean;
  lit: boolean;
  onHover: (url: string | null) => void;
}) {
  let tone = "bg-black/[0.16] dark:bg-white/[0.2]";
  if (link.pro) {
    tone = "bg-[#FF2D55]/45";
  } else if (link.isNew) {
    tone = "bg-[#1FA834]/55 dark:bg-[#3BB44B]/60";
  }
  return (
    <Link
      aria-label={link.name}
      className={cn(
        "relative size-[7px] shrink-0 outline-none",
        active ? "bg-black dark:bg-white" : tone,
        lit && !active && "bg-black/60 dark:bg-white/70",
        "focus-visible:ring-1 focus-visible:ring-black focus-visible:ring-offset-1 dark:focus-visible:ring-white",
        "transition-[background-color] duration-100 ease-out"
      )}
      href={link.url}
      onBlur={() => onHover(null)}
      onFocus={() => onHover(link.url)}
      onPointerEnter={() => onHover(link.url)}
      onPointerLeave={() => onHover(null)}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -inset-[2px] border border-black dark:border-white"
        />
      )}
    </Link>
  );
}

function ListRow({
  link,
  active,
  lit,
  onHover,
}: {
  link: SidebarLink;
  active: boolean;
  lit: boolean;
  onHover: (url: string | null) => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [active]);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 px-4 text-[13.5px]",
        active
          ? "font-medium text-black dark:text-white"
          : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white",
        lit && !active && "text-black dark:text-white",
        EASE_COLORS,
        FOCUS_INSET
      )}
      href={link.url}
      onPointerEnter={() => onHover(link.url)}
      onPointerLeave={() => onHover(null)}
      ref={ref}
    >
      <span
        aria-hidden
        className={cn(
          "size-[6px] shrink-0",
          active ? "bg-black dark:bg-white" : "bg-black/15 dark:bg-white/20",
          link.isNew && !active && "bg-[#1FA834]/70 dark:bg-[#3BB44B]/75",
          link.pro && !active && "bg-[#FF2D55]/45"
        )}
      />
      <span className="min-w-0 flex-1 truncate">{link.name}</span>
      <span
        className={cn(
          MONO,
          "text-[10.5px]",
          active ? LEAF : "text-black/35 dark:text-white/35"
        )}
      >
        {link.pro ? "PRO" : link.code}
      </span>
    </Link>
  );
}

/**
 * C · Atlas. Every part in the library at once, as a map: one row of cells
 * per category, new parts in leaf, Pro in red, the page you're on boxed.
 * Hover a cell to read its name, and the list below follows whichever
 * category you point at, so the map and the list light each other up.
 */
export function AtlasSidebar({ footer }: { footer?: ReactNode }) {
  const { model } = useSidebarProto();
  const isActive = useIsActive();
  const [hovered, setHovered] = useState<string | null>(null);
  const [pick, setPick] = useState<{ slug: string; on?: string } | null>(null);

  const all = model.sections.flatMap((section) =>
    section.items.map((item) => ({ section, item }))
  );
  const here = all.find(({ item }) => isActive(item.url));
  const lit = all.find(({ item }) => item.url === hovered);
  // A picked category holds until you move to another page.
  const picked = pick && pick.on === here?.item.url ? pick.slug : null;
  const focusSlug =
    lit?.section.slug ??
    picked ??
    here?.section.slug ??
    model.sections[0]?.slug;
  const focus =
    model.sections.find((section) => section.slug === focusSlug) ??
    model.sections[0];
  const readout = lit ?? here;
  const parts = all.filter(({ item }) => item.code).length;
  const added = model.sections.reduce((sum, section) => sum + section.added, 0);

  return (
    <ProtoShell>
      <ProtoTitle />
      <div className="px-4 pb-3">
        <SearchRow />
      </div>
      <nav
        aria-label="Guides"
        className={cn(
          MONO,
          "flex flex-wrap gap-x-3 gap-y-1 border-t px-4 py-2.5 text-[11.5px]",
          LINE
        )}
      >
        {model.guide.map((link) => (
          <Link
            className={cn(
              isActive(link.url)
                ? "text-black underline underline-offset-4 dark:text-white"
                : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white",
              link.pro && !isActive(link.url) && "text-[#FF2D55]/80",
              EASE_COLORS,
              FOCUS_INSET
            )}
            href={link.url}
            key={link.url}
          >
            {link.name}
          </Link>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t px-4 pt-3 pb-2.5", LINE)}>
        <div className="flex flex-col gap-[7px]">
          {model.sections.map((section) => (
            <div className="flex items-center gap-2" key={section.slug}>
              <button
                aria-pressed={focus?.slug === section.slug}
                className={cn(
                  MONO,
                  "w-[3ch] shrink-0 text-start text-[10.5px]",
                  focus?.slug === section.slug
                    ? "text-black dark:text-white"
                    : "text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white",
                  EASE_COLORS,
                  FOCUS_INSET
                )}
                onClick={() =>
                  setPick({ slug: section.slug, on: here?.item.url })
                }
                title={section.name}
                type="button"
              >
                {section.code}
              </button>
              <div className="flex flex-wrap gap-[2px]">
                {section.items.map((item) => (
                  <Cell
                    active={isActive(item.url)}
                    key={item.url}
                    link={item}
                    lit={hovered === item.url}
                    onHover={setHovered}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div
          className={cn(
            MONO,
            "mt-3 flex h-4 items-center gap-2 text-[11px]",
            SOFT_TEXT
          )}
        >
          {readout ? (
            <>
              <span className={readout.item.isNew ? LEAF : undefined}>
                {readout.item.code ?? "PRO"}
              </span>
              <span className="min-w-0 flex-1 truncate text-black dark:text-white">
                {readout.item.name}
              </span>
              {!lit && <span>here</span>}
            </>
          ) : (
            <span>
              {parts} parts · <span className={LEAF}>{added} new</span>
            </span>
          )}
        </div>
      </div>

      {focus && (
        <div className={cn("flex min-h-0 flex-1 flex-col border-t", LINE)}>
          <div className="flex shrink-0 items-baseline justify-between gap-2 px-4 pt-3 pb-1.5">
            <span className="font-medium text-[14px] text-black tracking-[-0.01em] dark:text-white">
              {focus.name}
            </span>
            <span className={cn(MONO, "text-[10.5px]", SOFT_TEXT)}>
              {focus.items.length}
              {focus.added > 0 && (
                <span className={LEAF}> · {focus.added} new</span>
              )}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            {focus.items.map((item) => (
              <ListRow
                active={isActive(item.url)}
                key={item.url}
                link={item}
                lit={hovered === item.url}
                onHover={setHovered}
              />
            ))}
            {focus.url && (
              <Link
                className={cn(
                  MONO,
                  "flex h-8 items-center gap-1.5 px-4 text-[11px] text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white",
                  EASE_COLORS,
                  FOCUS_INSET
                )}
                href={focus.url}
              >
                Open {focus.name} <ArrowRight aria-hidden className="size-3" />
              </Link>
            )}
          </div>
        </div>
      )}
      <ProtoFooter footer={footer} />
    </ProtoShell>
  );
}
