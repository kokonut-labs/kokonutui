"use client";

import Link from "fumadocs-core/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EASE_COLORS,
  FOCUS_INSET,
  LEAF,
  LINE,
  MONO,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { ProtoFooter, ProtoTitle, useIsActive } from "./chrome";
import { useSidebarProto } from "./context";
import type { SidebarLink } from "./model";
import { ProtoShell } from "./shell";

type Show = "all" | "new";

/** The name with the typed letters in ink, the rest left soft. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-medium text-black underline decoration-black/30 underline-offset-[3px] dark:text-white dark:decoration-white/40">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

function FilterRow({
  link,
  query,
  active,
}: {
  link: SidebarLink;
  query: string;
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
        "flex h-7 items-center gap-2 px-2.5 text-[13.5px]",
        active
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "text-black/60 hover:bg-black/[0.04] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white",
        EASE_COLORS,
        FOCUS_INSET
      )}
      href={link.url}
      ref={ref}
    >
      <span className="min-w-0 flex-1 truncate">
        <Highlight query={query} text={link.name} />
      </span>
      {link.code && (
        <span
          className={cn(
            MONO,
            "text-[10.5px]",
            active ? "opacity-60" : "text-black/30 dark:text-white/30"
          )}
        >
          {link.code}
        </span>
      )}
      {link.pro && (
        <span
          className={cn(
            MONO,
            "text-[10.5px]",
            active ? "opacity-70" : "text-[#FF2D55]"
          )}
        >
          PRO
        </span>
      )}
    </Link>
  );
}

/**
 * C · Filter. The list narrows as you type, without opening a dialog, and
 * one switch shows only what's new. Category names pin while their parts
 * scroll; the page being read is the one ink block in the list.
 */
export function FilterSidebar({ footer }: { footer?: ReactNode }) {
  const { model } = useSidebarProto();
  const isActive = useIsActive();
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");

  const total = model.sections.reduce(
    (sum, section) => sum + section.items.filter((item) => item.code).length,
    0
  );
  const added = model.sections.reduce((sum, section) => sum + section.added, 0);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = (item: SidebarLink) =>
      (show === "all" || item.isNew) &&
      (!q ||
        item.name.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q));
    const guide = show === "all" ? model.guide.filter(keep) : [];
    return [
      ...(guide.length > 0
        ? [{ name: "Docs", count: undefined, items: guide }]
        : []),
      ...model.sections
        .map((section) => ({
          name: section.name,
          count: section.items.length,
          items: section.items.filter(keep),
        }))
        .filter((section) => section.items.length > 0),
    ];
  }, [model, query, show]);

  const first = groups[0]?.items[0];
  const q = query.trim();

  return (
    <ProtoShell>
      <ProtoTitle />
      <div className="flex flex-col gap-2 px-4 pb-3">
        <label className="sr-only" htmlFor={inputId}>
          Filter components
        </label>
        <input
          autoComplete="off"
          className={cn(
            "h-9 w-full border bg-transparent px-2.5 text-[13.5px] text-black placeholder:text-black/40 focus:border-black/40 dark:text-white dark:focus:border-white/40 dark:placeholder:text-white/40",
            LINE,
            "outline-none",
            EASE_COLORS
          )}
          id={inputId}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && first) {
              router.push(first.url);
            } else if (event.key === "Escape") {
              setQuery("");
            }
          }}
          placeholder={`Filter ${total} components`}
          spellCheck={false}
          type="text"
          value={query}
        />
        <div className={cn("grid grid-cols-2 border", LINE)}>
          {(
            [
              ["all", "All", total],
              ["new", "New", added],
            ] as const
          ).map(([id, label, count]) => (
            <button
              aria-pressed={show === id}
              className={cn(
                "flex h-7 items-center justify-center gap-1.5 text-[12.5px]",
                show === id
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white",
                EASE_COLORS,
                FOCUS_INSET
              )}
              key={id}
              onClick={() => setShow(id)}
              type="button"
            >
              {label}
              <span
                className={cn(
                  MONO,
                  "text-[10.5px]",
                  id === "new" && show !== id ? LEAF : "opacity-60"
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain border-t",
          LINE
        )}
      >
        {groups.length === 0 && (
          <p className="px-4 py-6 text-[13px] text-black/50 dark:text-white/50">
            Nothing matches “{q}”.
          </p>
        )}
        {groups.map((group) => (
          <section className="pb-2" key={group.name}>
            <h3
              className={cn(
                "sticky top-0 z-10 flex h-9 items-center justify-between border-b bg-white/95 px-4 font-medium text-[12.5px] text-black backdrop-blur-sm dark:bg-black/95 dark:text-white",
                LINE
              )}
            >
              {group.name}
              {group.count !== undefined && (
                <span
                  className={cn(
                    MONO,
                    "font-normal text-[10.5px] text-black/40 dark:text-white/40"
                  )}
                >
                  {group.items.length === group.count
                    ? group.count
                    : `${group.items.length}/${group.count}`}
                </span>
              )}
            </h3>
            <div className="flex flex-col px-1.5 pt-1.5">
              {group.items.map((link) => (
                <FilterRow
                  active={isActive(link.url)}
                  key={link.url}
                  link={link}
                  query={q}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <ProtoFooter footer={footer} />
    </ProtoShell>
  );
}
