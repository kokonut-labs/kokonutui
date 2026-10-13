"use client";

import {
  ArrowUpRightIcon,
  BookOpenIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type KeyboardEvent,
  type ReactNode,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Avatar } from "@/components/landing/home/client";
import {
  installCommand,
  type McpClient,
  mcpCommand,
  POSTS,
  PRO_TEMPLATES,
  PRO_TEMPLATES_URL,
  PRO_URL,
  REGISTRY_ENTRY,
  V0_THREAD,
  VERCEL_OSS_URL,
} from "@/components/landing/home/data";
import {
  EASE_COLORS,
  enter,
  FOCUS,
  FOCUS_INSET,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { agentPrompt, type Part, type PrototypeProps, V0_URL } from "./data";
import { Framed, LIVE, LiveFallback, preload } from "./live";
import { ClientPicker, CopyLine } from "./shared";

const FIRST = "currency-transfer";
// Small, hands-on pieces first; full-page backgrounds last.
const ORDER = ["buttons", "cards", "inputs", "navigation", "ai", "texts"];
const rank = (slug: string) => {
  const i = ORDER.indexOf(slug);
  return i === -1 ? ORDER.length : i;
};
const IGNORED_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;

const RULE = "border-black/[0.08] dark:border-white/[0.09]";
const MUTED = "text-black/55 dark:text-white/55";
const LABEL = "font-medium text-[12px] text-black/45 dark:text-white/45";

export function WorkbenchVariant({ parts }: PrototypeProps) {
  // Only components that run live here; the rest are a click away in docs.
  const live = useMemo(
    () =>
      parts
        .filter((p) => LIVE[p.name])
        .sort((a, b) => rank(a.categorySlug) - rank(b.categorySlug)),
    [parts]
  );
  const [selected, setSelected] = useState(FIRST);
  const [run, setRun] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) {
      return live;
    }
    return live.filter((p) =>
      [p.title, p.name, p.category, p.description ?? ""].some((field) =>
        field.toLowerCase().includes(q)
      )
    );
  }, [live, deferredQuery]);

  const part = live.find((p) => p.name === selected) ?? live[0];

  // Start with the first pick in view inside the list, without scrolling
  // the page to it.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-part="${FIRST}"]`);
    if (list && item) {
      list.scrollTop = item.offsetTop - list.clientHeight / 2;
      list.scrollLeft = item.offsetLeft - list.clientWidth / 2;
    }
  }, []);

  // "/" jumps to search from anywhere on the page, like most docs sites.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (IGNORED_TAGS.test(target.tagName) || target.isContentEditable) {
        return;
      }
      if (e.key === "/" && !(e.metaKey || e.ctrlKey || e.altKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const select = (name: string) => {
    setSelected(name);
    setRun((n) => n + 1);
  };

  const focusItem = (name: string) => {
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-part="${name}"]`)
      ?.focus();
  };

  // Up and down walk the list and select as they go, so the stage follows
  // the keyboard. Left and right stay with the page.
  const onItemKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
      return;
    }
    e.preventDefault();
    const index = results.findIndex((p) => p.name === selected);
    const step = e.key === "ArrowDown" ? 1 : -1;
    const next = results[(index + step + results.length) % results.length];
    if (next) {
      select(next.name);
      focusItem(next.name);
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const first = results[0];
      if (first) {
        select(first.name);
        focusItem(first.name);
      }
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  // Group the visible results under their docs category.
  const groups = useMemo(() => {
    const map = new Map<string, Part[]>();
    for (const p of results) {
      map.set(p.category, [...(map.get(p.category) ?? []), p]);
    }
    return [...map.entries()];
  }, [results]);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 pb-32 sm:px-6">
      <header className="flex flex-col gap-4 pt-10 pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:pt-12 lg:pb-8">
        <h1
          className="home-enter max-w-[620px] text-balance font-semibold text-[clamp(32px,4vw,46px)] text-black leading-[1.04] tracking-[-0.045em] dark:text-white"
          style={enter(0)}
        >
          Try every component before you install it.
        </h1>
        <div
          className="home-enter flex max-w-[440px] flex-col gap-2"
          style={enter(1)}
        >
          <p className={cn("text-pretty text-[15.5px] leading-relaxed", MUTED)}>
            Free, open-source React components built with Tailwind CSS and
            Motion. Everything here is running live: pick one, use it, copy one
            line to make it yours.
          </p>
          <a
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-sm text-[13px] underline-offset-4 hover:text-black hover:underline dark:hover:text-white",
              MUTED,
              FOCUS
            )}
            href={VERCEL_OSS_URL}
            rel="noreferrer"
            target="_blank"
          >
            Part of the
            <svg
              aria-hidden="true"
              className="size-2.5"
              fill="currentColor"
              viewBox="0 0 76 65"
            >
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
            Vercel OSS Program
          </a>
        </div>
      </header>

      <section
        aria-label="Component workbench"
        className={cn(
          "home-enter grid grid-cols-1 overflow-hidden rounded-2xl border bg-white lg:h-[clamp(600px,calc(100svh-280px),760px)] lg:grid-cols-[224px_minmax(0,1fr)_320px] dark:bg-[#050505]",
          RULE
        )}
        style={enter(2)}
      >
        {/* Index */}
        <div
          className={cn(
            "flex min-h-0 flex-col border-b lg:border-r lg:border-b-0",
            RULE
          )}
        >
          <div className={cn("border-b p-2", RULE)}>
            <label className="relative flex items-center">
              <span className="sr-only">Search components</span>
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute left-2.5 size-3.5 text-black/40 dark:text-white/40"
              />
              <input
                autoComplete="off"
                className={cn(
                  "h-9 w-full rounded-lg bg-black/[0.04] pr-8 pl-8 text-[14px] text-black placeholder:text-black/40 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40",
                  FOCUS_INSET
                )}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search components"
                ref={searchRef}
                type="search"
                value={query}
              />
              <kbd
                aria-hidden
                className="pointer-events-none absolute right-2 rounded border border-black/10 px-1.5 font-mono text-[11px] text-black/40 dark:border-white/15 dark:text-white/40"
              >
                /
              </kbd>
            </label>
          </div>

          {/* Phones: one scrollable row. Desktop: the full grouped list. */}
          <div
            className="relative flex min-h-0 flex-1 gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-visible"
            ref={listRef}
          >
            {groups.map(([category, items]) => (
              <div className="contents lg:block lg:pb-3" key={category}>
                <p
                  className={cn(
                    "hidden px-2.5 pt-2 pb-1.5 lg:block",
                    LABEL,
                    "text-[11.5px]"
                  )}
                >
                  {category}
                </p>
                {items.map((p) => {
                  const active = p.name === part?.name;
                  return (
                    <button
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-2.5 text-left text-[13.5px] lg:w-full",
                        active
                          ? "bg-black/[0.06] font-medium text-black dark:bg-white/[0.09] dark:text-white"
                          : "text-black/65 hover:bg-black/[0.03] hover:text-black dark:text-white/65 dark:hover:bg-white/[0.04] dark:hover:text-white",
                        EASE_COLORS,
                        FOCUS_INSET
                      )}
                      data-part={p.name}
                      key={p.name}
                      onClick={() => select(p.name)}
                      onFocus={() => preload(p.name)}
                      onKeyDown={onItemKeyDown}
                      onPointerEnter={() => preload(p.name)}
                      type="button"
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>
            ))}
            {results.length === 0 ? (
              <p className={cn("px-2.5 py-3 text-[13px]", MUTED)}>
                Nothing matches “{deferredQuery}”.{" "}
                <Link
                  className={cn("underline underline-offset-4", FOCUS)}
                  href="/docs"
                >
                  Search the docs
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        {/* Stage */}
        {part ? (
          <Stage
            key={part.name}
            onReplay={() => setRun((n) => n + 1)}
            part={part}
            run={run}
          />
        ) : null}

        {/* Inspector */}
        {part ? <Inspector part={part} /> : null}
      </section>

      <Agents />
      <Timeline />
      <Pro />
    </div>
  );
}

function Stage({
  part,
  run,
  onReplay,
}: {
  part: Part;
  run: number;
  onReplay: () => void;
}) {
  const entry = LIVE[part.name];
  const Demo = entry.Component;

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col border-b lg:border-b-0",
        RULE
      )}
    >
      <div
        className={cn(
          "flex h-11 shrink-0 items-center gap-2 border-b px-4",
          RULE
        )}
      >
        <p className="min-w-0 truncate text-[13px]">
          <span className={MUTED}>{part.category}</span>
          <span aria-hidden className="px-1.5 text-black/25 dark:text-white/25">
            /
          </span>
          <span className="font-medium text-black dark:text-white">
            {part.title}
          </span>
        </p>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            aria-label="Restart the demo"
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md text-black/50 hover:bg-black/[0.05] hover:text-black dark:text-white/50 dark:hover:bg-white/[0.07] dark:hover:text-white",
              EASE_COLORS,
              FOCUS
            )}
            onClick={onReplay}
            title="Restart the demo"
            type="button"
          >
            <RotateCcwIcon aria-hidden className="size-3.5" />
          </button>
          <Link
            aria-label={`${part.title} docs`}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md text-black/50 hover:bg-black/[0.05] hover:text-black dark:text-white/50 dark:hover:bg-white/[0.07] dark:hover:text-white",
              EASE_COLORS,
              FOCUS
            )}
            href={part.url}
            title="Open the docs"
          >
            <BookOpenIcon aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="relative min-h-[460px] flex-1 bg-black/[0.018] lg:min-h-0 dark:bg-white/[0.02]">
        {/* A new key per run, so "Restart" replays the component's own
            entrance. Swapping components is instant: no transition. */}
        <Framed name={part.name} padding="p-6 sm:p-10">
          <Suspense fallback={<LiveFallback />}>
            <Demo key={run} />
          </Suspense>
        </Framed>
      </div>

      <p
        className={cn(
          "flex h-10 shrink-0 items-center border-t px-4 text-[12.5px]",
          RULE,
          MUTED
        )}
      >
        {entry.hint}
      </p>
    </div>
  );
}

function Inspector({ part }: { part: Part }) {
  const deps = part.dependencies;
  const primitives = part.registryDependencies;

  return (
    <aside
      aria-label={`${part.title} details`}
      className={cn("flex min-h-0 flex-col overflow-y-auto lg:border-l", RULE)}
    >
      <div className="flex flex-col gap-2 p-5">
        <h2 className="font-semibold text-[17px] text-black tracking-[-0.02em] dark:text-white">
          {part.title}
        </h2>
        {part.description ? (
          <p className={cn("text-pretty text-[13.5px] leading-relaxed", MUTED)}>
            {part.description}
          </p>
        ) : null}
      </div>

      <Block title="Install">
        <CopyLine
          className="rounded-lg border border-black/[0.08] px-3 py-2.5 text-black/80 hover:border-black/15 dark:border-white/[0.1] dark:text-white/80 dark:hover:border-white/20"
          display={
            <>
              npx shadcn@latest add
              <br />
              @kokonutui/{part.name}
            </>
          }
          label={`install command for ${part.name}`}
          prefix="$"
          value={installCommand(part.name)}
        />
        <p className={cn("mt-3 mb-2", LABEL)}>Or ask your agent</p>
        <CopyLine
          className="rounded-lg border border-black/[0.08] px-3 py-2.5 text-black/80 hover:border-black/15 dark:border-white/[0.1] dark:text-white/80 dark:hover:border-white/20"
          label="prompt"
          prefix="›"
          value={agentPrompt(part.name)}
        />
      </Block>

      <Block title="Comes with">
        <dl className="flex flex-col gap-2.5 text-[13px]">
          {deps.length > 0 ? <Spec label="Packages" values={deps} /> : null}
          {primitives.length > 0 ? (
            <Spec label="shadcn/ui" values={primitives} />
          ) : null}
          <Spec
            label="Files"
            mono
            values={part.files.map((f) => f.split("/").at(-1) ?? f)}
          />
        </dl>
      </Block>

      <div className="mt-auto flex items-center gap-2 p-5 pt-2">
        <Link
          className={cn(
            "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-black px-3 font-medium text-[13px] text-white hover:bg-black/85 active:bg-black/75 dark:bg-white dark:text-black dark:active:bg-white/75 dark:hover:bg-white/85",
            EASE_COLORS,
            FOCUS
          )}
          href={part.url}
        >
          Read the docs
        </Link>
        <a
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1 rounded-lg border px-3 font-medium text-[13px] text-black/75 hover:border-black/20 hover:text-black active:bg-black/[0.03] dark:text-white/75 dark:active:bg-white/[0.04] dark:hover:border-white/25 dark:hover:text-white",
            RULE,
            EASE_COLORS,
            FOCUS
          )}
          href={V0_URL(part.name)}
          rel="noreferrer"
          target="_blank"
        >
          Open in v0
          <ArrowUpRightIcon aria-hidden className="size-3.5" />
        </a>
      </div>
    </aside>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn("border-t px-5 py-4", RULE)}>
      <h3 className={cn("mb-2", LABEL)}>{title}</h3>
      {children}
    </section>
  );
}

function Spec({
  label,
  values,
  mono,
}: {
  label: string;
  values: string[];
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3">
      <dt className={MUTED}>{label}</dt>
      <dd
        className={cn(
          "wrap-anywhere text-black/80 dark:text-white/80",
          mono && "font-mono text-[12px] leading-[1.7]"
        )}
      >
        {mono
          ? values.map((v) => (
              <span className="block" key={v}>
                {v}
              </span>
            ))
          : values.join(", ")}
      </dd>
    </div>
  );
}

/* Below the workbench: the same panel language, kept short. */

function SectionTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 md:mb-8 md:flex-row md:items-end md:justify-between">
      <h2 className="font-semibold text-[26px] text-black tracking-[-0.035em] md:text-[30px] dark:text-white">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Agents() {
  const [client, setClient] = useState<McpClient>("claude");

  return (
    <section className="pt-24 md:pt-32">
      <SectionTitle title="Or skip the clicking.">
        <p className={cn("max-w-[440px] text-[15px] leading-relaxed", MUTED)}>
          Kokonut UI is a shadcn registry. Connect it once and your agent can
          install any component, with its dependencies, as code you own.
        </p>
      </SectionTitle>
      <ol
        className={cn(
          "grid grid-cols-1 overflow-hidden rounded-2xl border md:grid-cols-3",
          RULE
        )}
      >
        <AgentStep n={1} title="Add the registry">
          <p className={cn("text-[13.5px]", MUTED)}>
            One line in components.json.
          </p>
          <CopyLine
            className="mt-auto text-black/75 dark:text-white/75"
            label="registry entry"
            value={REGISTRY_ENTRY}
          />
        </AgentStep>
        <AgentStep n={2} title="Connect your editor">
          <ClientPicker
            className="flex-wrap gap-1"
            itemClassName="h-7 rounded-md px-2"
            onChange={setClient}
            selectedClassName="bg-black/[0.06] dark:bg-white/[0.09]"
            value={client}
          />
          <CopyLine
            className="mt-auto text-black/75 dark:text-white/75"
            prefix="$"
            value={mcpCommand(client)}
          />
        </AgentStep>
        <AgentStep n={3} title="Ask in plain words">
          <p className={cn("text-[13.5px]", MUTED)}>
            Name a component, or describe what you need.
          </p>
          <p className="mt-auto rounded-xl rounded-br-sm bg-black px-3.5 py-2.5 text-[13.5px] text-white dark:bg-white dark:text-black">
            Add a hold-to-delete button to the danger zone in settings
          </p>
        </AgentStep>
      </ol>
    </section>
  );
}

function AgentStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 border-b p-5 last:border-b-0 md:min-h-[200px] md:border-r md:border-b-0 md:last:border-r-0",
        RULE
      )}
    >
      <p className="flex items-baseline gap-2.5">
        <span className="font-mono text-[12px] text-black/35 tabular-nums dark:text-white/35">
          0{n}
        </span>
        <span className="font-medium text-[15px] text-black dark:text-white">
          {title}
        </span>
      </p>
      {children}
    </li>
  );
}

function Timeline() {
  const { post, reply } = V0_THREAD;
  return (
    <section className="pt-24 md:pt-32">
      <SectionTitle title="Seen on the timeline" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <a
          className={cn(
            "group flex flex-col gap-4 rounded-2xl border p-5 hover:border-black/15 md:row-span-2 dark:hover:border-white/20",
            RULE,
            EASE_COLORS,
            FOCUS
          )}
          href={post.href}
          rel="noreferrer"
          target="_blank"
        >
          <Byline
            avatar={reply.avatar}
            handle={reply.handle}
            name={reply.name}
          />
          <p className="font-semibold text-[56px] text-black leading-none tracking-[-0.05em] dark:text-white">
            {reply.text}
          </p>
          <p className={cn("text-[13.5px] leading-relaxed", MUTED)}>
            shadcn, replying to “{post.text}”
          </p>
          <div
            className={cn(
              "mt-auto flex items-center gap-3 rounded-xl border p-3",
              RULE
            )}
          >
            <Avatar name={post.name} size={28} src={post.avatar} />
            <p className="min-w-0 text-[13px] text-black/70 dark:text-white/70">
              {post.steps.join(" → ")}
            </p>
          </div>
        </a>
        {POSTS.slice(0, 4).map((p) => (
          <figure
            className={cn("flex flex-col gap-3 rounded-2xl border p-5", RULE)}
            key={p.handle}
          >
            <Byline avatar={p.avatar} handle={p.handle} name={p.name} />
            <blockquote className="text-pretty text-[14px] text-black/75 leading-relaxed dark:text-white/75">
              {p.text}
            </blockquote>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Byline({
  name,
  handle,
  avatar,
}: {
  name: string;
  handle: string;
  avatar: string;
}) {
  return (
    <figcaption className="flex items-center gap-2.5">
      <Avatar name={name} size={28} src={avatar} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-medium text-[13px] text-black dark:text-white">
          {name}
        </span>
        <span className={cn("text-[12px]", MUTED)}>@{handle}</span>
      </span>
    </figcaption>
  );
}

function Pro() {
  return (
    <section className="pt-24 md:pt-32">
      <div
        className={cn(
          "grid grid-cols-1 overflow-hidden rounded-2xl border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]",
          RULE
        )}
      >
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <p className="font-medium text-[#FF2D55] text-[13px]">
            Kokonut UI Pro
          </p>
          <h2 className="text-balance font-semibold text-[26px] text-black leading-[1.1] tracking-[-0.035em] md:text-[30px] dark:text-white">
            When you need the whole page.
          </h2>
          <p className={cn("text-pretty text-[15px] leading-relaxed", MUTED)}>
            Premium sections and complete website templates, on the same stack:
            Next.js, Tailwind CSS, Motion and shadcn/ui.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <a
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-4 font-medium text-[13px] text-white hover:bg-black/85 active:bg-black/75 dark:bg-white dark:text-black dark:active:bg-white/75 dark:hover:bg-white/85",
                EASE_COLORS,
                FOCUS
              )}
              href={PRO_URL}
              rel="noreferrer"
              target="_blank"
            >
              Explore Pro
              <ArrowUpRightIcon aria-hidden className="size-3.5" />
            </a>
            <a
              className={cn(
                "inline-flex h-9 items-center rounded-lg px-3 font-medium text-[13px] hover:bg-black/[0.04] hover:text-black dark:hover:bg-white/[0.06] dark:hover:text-white",
                MUTED,
                EASE_COLORS,
                FOCUS
              )}
              href={PRO_TEMPLATES_URL}
              rel="noreferrer"
              target="_blank"
            >
              All templates
            </a>
          </div>
        </div>
        <ul
          className={cn(
            "grid grid-cols-3 gap-px border-t bg-black/[0.08] lg:border-t-0 lg:border-l dark:bg-white/[0.09]",
            RULE
          )}
        >
          {PRO_TEMPLATES.map((t) => (
            <li className="bg-white dark:bg-black" key={t.name}>
              <a
                className={cn("group block h-full p-3", FOCUS_INSET)}
                href={PRO_TEMPLATES_URL}
                rel="noreferrer"
                target="_blank"
              >
                <span className="block overflow-hidden rounded-md border border-black/[0.06] dark:border-white/[0.08]">
                  <Image
                    alt={`${t.name} template`}
                    className="aspect-[4/3] w-full object-cover object-top"
                    height={t.height}
                    sizes="(min-width: 1024px) 260px, 33vw"
                    src={t.image}
                    width={t.width}
                  />
                </span>
                <span className="mt-2.5 block font-medium text-[13px] text-black dark:text-white">
                  {t.name}
                </span>
                <span className={cn("block text-[12px]", MUTED)}>
                  {t.blurb}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
