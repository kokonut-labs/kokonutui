"use client";

import { usePathname } from "fumadocs-core/framework";
import Link from "fumadocs-core/link";
import { useSearchContext } from "fumadocs-ui/contexts/search";
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
import type { SidebarLink, SidebarSection } from "./model";
import { ProtoShell } from "./shell";

const GLYPH = "text-black/25 dark:text-white/25";

/** Box-drawing prefix for a row, from whether each ancestor was last. */
function branch(last: boolean, parentLast?: boolean) {
  let trunk = "";
  if (parentLast !== undefined) {
    trunk = parentLast ? "   " : "│  ";
  }
  return `${trunk}${last ? "└─ " : "├─ "}`;
}

const DOCS_PREFIX = /^\/docs\/?/;

const ROW = cn(
  "flex h-[26px] w-full items-center whitespace-pre px-4 text-start outline-none",
  "focus-visible:bg-black/[0.06] dark:focus-visible:bg-white/[0.08]",
  EASE_COLORS
);

function FileRow({
  link,
  prefix,
  active,
  matched,
}: {
  link: SidebarLink;
  prefix: string;
  active: boolean;
  matched: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: "center" });
    }
  }, [active]);
  const at = matched ? link.slug.indexOf(matched) : -1;
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        ROW,
        active
          ? "bg-black text-white focus-visible:bg-black dark:bg-white dark:text-black dark:focus-visible:bg-white"
          : "text-black/65 hover:bg-black/[0.04] hover:text-black dark:text-white/65 dark:hover:bg-white/[0.06] dark:hover:text-white"
      )}
      data-row=""
      href={link.url}
      ref={ref}
      title={link.name}
    >
      <span className={active ? "opacity-40" : GLYPH}>{prefix}</span>
      <span className="min-w-0 truncate">
        {at < 0 ? (
          link.slug
        ) : (
          <>
            {link.slug.slice(0, at)}
            <span className={active ? "" : cn(LEAF, "font-medium")}>
              {link.slug.slice(at, at + matched.length)}
            </span>
            {link.slug.slice(at + matched.length)}
          </>
        )}
        {link.code && (
          <span className={active ? "opacity-50" : GLYPH}>.tsx</span>
        )}
      </span>
      {link.pro && (
        <span
          className={cn(
            "ms-auto ps-2",
            active ? "opacity-70" : "text-[#FF2D55]"
          )}
        >
          [pro]
        </span>
      )}
    </Link>
  );
}

function FolderRow({
  section,
  prefix,
  open,
  onToggle,
  hits,
}: {
  section: SidebarSection;
  prefix: string;
  open: boolean;
  onToggle: () => void;
  hits?: number;
}) {
  return (
    <button
      aria-expanded={open}
      className={cn(
        ROW,
        "text-black hover:bg-black/[0.04] dark:text-white dark:hover:bg-white/[0.06]"
      )}
      data-folder={section.slug}
      data-row=""
      onClick={onToggle}
      type="button"
    >
      <span className={GLYPH}>{prefix}</span>
      <span className="font-medium">{section.slug}/</span>
      <span className="ms-auto flex gap-2 ps-2 text-[11px]">
        {hits === undefined ? (
          <>
            {section.added > 0 && (
              <span className={LEAF}>+{section.added}</span>
            )}
            <span className="text-black/35 dark:text-white/35">
              {section.items.length}
            </span>
          </>
        ) : (
          <span className={LEAF}>{hits}</span>
        )}
        <span className="w-[1ch] text-black/35 dark:text-white/35">
          {open ? "−" : "+"}
        </span>
      </span>
    </button>
  );
}

/**
 * A · Terminal. The docs as the file tree you'd install from: slugs are the
 * names the shadcn CLI takes, folders fold like a TUI, `/` greps, j and k
 * walk the tree, and a status line says where you are.
 */
export function TerminalSidebar({ footer }: { footer?: ReactNode }) {
  const { model } = useSidebarProto();
  const isActive = useIsActive();
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenSearch } = useSearchContext();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const current = model.sections.find((section) =>
    section.items.some((item) => isActive(item.url))
  );
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(current ? [current.slug] : [])
  );
  useEffect(() => {
    if (current) {
      setOpen((prev) => new Set(prev).add(current.slug));
    }
  }, [current]);

  const toggle = (slug: string, next?: boolean) =>
    setOpen((prev) => {
      const copy = new Set(prev);
      const shouldOpen = next ?? !copy.has(slug);
      if (shouldOpen) {
        copy.add(slug);
      } else {
        copy.delete(slug);
      }
      return copy;
    });

  const filtered = useMemo(
    () =>
      model.sections.map((section) => ({
        section,
        items: q
          ? section.items.filter((item) => item.slug.includes(q))
          : section.items,
      })),
    [model, q]
  );
  const guide = q
    ? model.guide.filter((item) => item.slug.includes(q))
    : model.guide;
  const visible = filtered.filter(({ items }) => !q || items.length > 0);
  const firstHit = guide[0] ?? visible[0]?.items[0];

  // `/` jumps to the prompt from anywhere outside a text field.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        target?.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onTreeKey = (event: globalThis.KeyboardEvent) => {
    const rows = Array.from(
      treeRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? []
    );
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const row = rows[at];
    const move = (delta: number) => {
      event.preventDefault();
      rows[Math.min(rows.length - 1, Math.max(0, at + delta))]?.focus();
    };
    if (event.key === "j" || event.key === "ArrowDown") {
      move(1);
    } else if (event.key === "k" || event.key === "ArrowUp") {
      move(-1);
    } else if (
      row?.dataset.folder &&
      (event.key === "l" || event.key === "ArrowRight")
    ) {
      event.preventDefault();
      toggle(row.dataset.folder, true);
    } else if (
      row?.dataset.folder &&
      (event.key === "h" || event.key === "ArrowLeft")
    ) {
      event.preventDefault();
      toggle(row.dataset.folder, false);
    }
  };

  const keyHandler = useRef(onTreeKey);
  keyHandler.current = onTreeKey;
  useEffect(() => {
    const tree = treeRef.current;
    const listener = (event: globalThis.KeyboardEvent) =>
      keyHandler.current(event);
    tree?.addEventListener("keydown", listener);
    return () => tree?.removeEventListener("keydown", listener);
  }, []);

  const total = model.sections.reduce(
    (sum, section) => sum + section.items.length,
    0
  );
  const place = current
    ? `${current.items.findIndex((item) => isActive(item.url)) + 1}/${current.items.length}`
    : `${total}`;
  const path = pathname.replace(DOCS_PREFIX, "") || "installation";

  return (
    <ProtoShell>
      <ProtoTitle />
      <div className={cn(MONO, "px-4 pb-3 text-[12px]")}>
        <div className="mb-1.5 truncate text-[11px] text-black/40 dark:text-white/40">
          ~/kokonutui/docs
        </div>
        <label
          className={cn(
            "flex h-9 items-center gap-2 border px-2.5 focus-within:border-black/45 dark:focus-within:border-white/45",
            LINE,
            EASE_COLORS
          )}
          htmlFor={inputId}
        >
          <span className={LEAF}>❯</span>
          <span className="text-black/40 dark:text-white/40">grep</span>
          <input
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-black caret-[#1FA834] outline-none placeholder:text-black/30 dark:text-white dark:placeholder:text-white/30"
            id={inputId}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && firstHit) {
                router.push(firstHit.url);
              } else if (event.key === "Escape") {
                setQuery("");
                event.currentTarget.blur();
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                treeRef.current
                  ?.querySelector<HTMLElement>("[data-row]")
                  ?.focus();
              }
            }}
            placeholder="/"
            ref={inputRef}
            spellCheck={false}
            type="text"
            value={query}
          />
          <button
            className={cn(
              "text-[10.5px] text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white",
              EASE_COLORS,
              FOCUS_INSET
            )}
            onClick={() => setOpenSearch(true)}
            type="button"
          >
            ⌘K
          </button>
        </label>
      </div>

      <nav
        aria-label="Docs"
        className={cn(
          MONO,
          "min-h-0 flex-1 overflow-y-auto overscroll-contain border-t py-2 text-[12.5px]",
          LINE
        )}
        ref={treeRef}
      >
        {guide.map((link, i) => (
          <FileRow
            active={isActive(link.url)}
            key={link.url}
            link={link}
            matched={q}
            prefix={branch(i === guide.length - 1 && visible.length === 0)}
          />
        ))}
        {visible.map(({ section, items }, i) => {
          const last = i === visible.length - 1;
          const isOpen = q ? true : open.has(section.slug);
          return (
            <div key={section.slug}>
              <FolderRow
                hits={q ? items.length : undefined}
                onToggle={() => toggle(section.slug)}
                open={isOpen}
                prefix={branch(last)}
                section={section}
              />
              {isOpen &&
                items.map((link, j) => (
                  <FileRow
                    active={isActive(link.url)}
                    key={link.url}
                    link={link}
                    matched={q}
                    prefix={branch(j === items.length - 1, last)}
                  />
                ))}
            </div>
          );
        })}
        {q && !firstHit && (
          <p className="px-4 py-2 text-black/45 dark:text-white/45">
            grep: no match for “{q}”
          </p>
        )}
      </nav>

      <div
        className={cn(
          MONO,
          "flex h-7 shrink-0 items-center gap-2 border-t pe-4 text-[10.5px]",
          LINE
        )}
      >
        <span className="flex h-full items-center bg-[#1FA834] px-2 font-medium text-white dark:bg-[#3BB44B] dark:text-black">
          {q ? "GREP" : "READ"}
        </span>
        <span className="min-w-0 flex-1 truncate text-black/60 dark:text-white/60">
          {path}
        </span>
        <span className="text-black/40 dark:text-white/40">{place}</span>
      </div>
      <div
        className={cn(
          MONO,
          "flex shrink-0 gap-3 px-4 pt-2 text-[10.5px] text-black/40 max-md:hidden dark:text-white/40"
        )}
      >
        <span>
          <span className="text-black/70 dark:text-white/70">j k</span> move
        </span>
        <span>
          <span className="text-black/70 dark:text-white/70">h l</span> fold
        </span>
        <span>
          <span className="text-black/70 dark:text-white/70">/</span> grep
        </span>
        <span>
          <span className="text-black/70 dark:text-white/70">⏎</span> open
        </span>
      </div>
      <ProtoFooter footer={footer} />
    </ProtoShell>
  );
}
