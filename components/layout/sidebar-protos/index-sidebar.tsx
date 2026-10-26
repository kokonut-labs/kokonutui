"use client";

import Link from "fumadocs-core/link";
import { ChevronRight } from "lucide-react";
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
import type { SidebarLink, SidebarSection } from "./model";
import { ProtoShell } from "./shell";

const ROW = cn(
  "group relative flex h-8 items-center gap-3 px-4 text-[13.5px] text-black/60 hover:bg-black/[0.03] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white",
  EASE_COLORS,
  FOCUS_INSET
);

/** One row: code, name, and a 2px ink bar on the edge when it's open. */
function Row({ link, active }: { link: SidebarLink; active: boolean }) {
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
        ROW,
        active &&
          "font-medium text-black hover:bg-transparent dark:text-white dark:hover:bg-transparent"
      )}
      href={link.url}
      ref={ref}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 start-0 w-0.5 bg-black dark:bg-white"
        />
      )}
      {link.code && (
        <span
          className={cn(
            MONO,
            "w-[5ch] shrink-0 text-[11px]",
            active ? LEAF : "text-black/35 dark:text-white/35"
          )}
        >
          {link.code}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{link.name}</span>
      {link.pro && (
        <span className={cn(MONO, "text-[#FF2D55] text-[10.5px]")}>PRO</span>
      )}
    </Link>
  );
}

/** Height-only reveal: the rows slide out from under the header. */
function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function Section({
  section,
  index,
  defaultOpen,
}: {
  section: SidebarSection;
  index: number;
  defaultOpen: boolean;
}) {
  const isActive = useIsActive();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);
  const count = section.items.filter((item) => item.code).length;

  return (
    <div className={cn("border-t", LINE)}>
      <button
        aria-expanded={open}
        className={cn(
          "sticky top-0 z-10 flex h-10 w-full items-center gap-3 bg-white px-4 text-start hover:bg-black/[0.02] dark:bg-black dark:hover:bg-white/[0.03]",
          EASE_COLORS,
          FOCUS_INSET
        )}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span
          className={cn(
            MONO,
            "w-[5ch] shrink-0 text-[11px] text-black/35 dark:text-white/35"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 font-medium text-[13.5px] text-black dark:text-white">
          {section.name}
        </span>
        <span
          className={cn(
            MONO,
            "text-[10.5px]",
            section.added > 0 ? LEAF : "text-black/35 dark:text-white/35"
          )}
        >
          {section.added > 0 ? `${section.added} new` : count}
        </span>
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 text-black/35 transition-transform duration-200 ease-out dark:text-white/35",
            open && "rotate-90"
          )}
        />
      </button>
      <Reveal open={open}>
        <div className="pb-2">
          {section.items.map((link) => (
            <Row active={isActive(link.url)} key={link.url} link={link} />
          ))}
          {section.url && (
            <Link
              className={cn(
                MONO,
                "flex h-8 items-center gap-1.5 px-4 ps-[calc(1rem+5ch+0.75rem)] text-[11px] text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white",
                EASE_COLORS,
                FOCUS_INSET
              )}
              href={section.url}
            >
              All {count} {section.name.toLowerCase()} →
            </Link>
          )}
        </div>
      </Reveal>
    </div>
  );
}

/**
 * A · Index. The catalog's index, ruled: numbered categories as hairline
 * headers that pin while their rows scroll, only the one being read open.
 */
export function IndexSidebar({ footer }: { footer?: ReactNode }) {
  const { model } = useSidebarProto();
  const isActive = useIsActive();

  return (
    <ProtoShell>
      <ProtoTitle />
      <div className="px-4 pb-3">
        <SearchRow />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="pb-3">
          {model.guide.map((link) => (
            <Row active={isActive(link.url)} key={link.url} link={link} />
          ))}
        </div>
        {model.sections.map((section, i) => (
          <Section
            defaultOpen={section.items.some(
              (item) => isActive(item.url) || isActive(section.url ?? "")
            )}
            index={i}
            key={section.name}
            section={section}
          />
        ))}
        <div className={cn("border-t", LINE)} />
      </div>
      <ProtoFooter footer={footer} />
    </ProtoShell>
  );
}
