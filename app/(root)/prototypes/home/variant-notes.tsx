"use client";

import { ArrowRightIcon, ArrowUpRightIcon, RotateCcwIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type CSSProperties,
  type RefObject,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { Avatar, CommandChip } from "@/components/landing/home/client";
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
} from "@/components/landing/home/data";
import {
  EASE_COLORS,
  enter,
  FOCUS,
  PRIMARY_BUTTON,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import type { Part, PrototypeProps } from "./data";
import { Fit, LIVE, LiveFallback } from "./live";
import { NOTES, type Note } from "./notes-content";
import { ClientPicker, CopyLine } from "./shared";

// An essay with working figures. Serif for the voice, sans for the facts,
// and one color: Kokonut's leaf, for the callouts that tie notes to parts.
const SERIF = "font-(family-name:--font-proto-serif)";
const MONO = "font-(family-name:--font-proto-mono)";
const INK = "text-black dark:text-white";
const BODY = "text-black/70 dark:text-white/70";
const SOFT = "text-black/50 dark:text-white/50";
const RULE = "border-black/[0.08] dark:border-white/[0.1]";
/** Two columns from lg: the text, and a margin for notes. */
const SPREAD = "grid grid-cols-1 gap-x-16 lg:grid-cols-[minmax(0,1fr)_248px]";

export function NotesVariant({ parts }: PrototypeProps) {
  const byName = new Map(parts.map((p) => [p.name, p]));

  return (
    <article className="mx-auto w-full max-w-[1080px] px-5 pb-32 sm:px-8">
      <Opening />
      {NOTES.map((note, i) => {
        const part = byName.get(note.name);
        return part ? (
          <NoteSection index={i + 1} key={note.name} note={note} part={part} />
        ) : null;
      })}
      <AgentNote index={NOTES.length + 1} />
      <Said />
      <Postscript />
      <Contents parts={parts} />
    </article>
  );
}

/* Opening --------------------------------------------------------------- */

function Opening() {
  return (
    <header className={cn(SPREAD, "pt-16 pb-20 md:pt-24 md:pb-28")}>
      <div>
        <p className={cn("home-enter text-[14px]", SOFT)} style={enter(0)}>
          Kokonut UI, by{" "}
          <a
            className={cn(
              "rounded-sm underline decoration-black/20 underline-offset-4 hover:text-black hover:decoration-black/60 dark:decoration-white/25 dark:hover:text-white dark:hover:decoration-white/60",
              EASE_COLORS,
              FOCUS
            )}
            href="https://x.com/dorianbaffier"
            rel="noreferrer"
            target="_blank"
          >
            Dorian Baffier
          </a>
        </p>
        <h1
          className={cn(
            "home-enter mt-5 text-balance text-[clamp(52px,8vw,96px)] leading-[0.95] tracking-[-0.025em]",
            SERIF,
            INK
          )}
          style={enter(1)}
        >
          Components that <em>feel</em> right.
        </h1>
        <p
          className={cn(
            "home-enter mt-8 max-w-[600px] text-pretty text-[19px] leading-[1.65]",
            BODY
          )}
          style={enter(2)}
        >
          Kokonut UI is a free, open-source collection of React components,
          built with Tailwind CSS and Motion. This page walks through a few of
          them and the small decisions that make them feel the way they do.
          Every figure is the real component, running. Try them as you read.
        </p>
        <div
          className="home-enter mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          style={enter(3)}
        >
          <Link
            className={cn(PRIMARY_BUTTON, "h-11 px-6", EASE_COLORS, FOCUS)}
            href="/docs"
          >
            Browse components
            <ArrowRightIcon aria-hidden className="size-4" />
          </Link>
          <CommandChip
            className="min-h-11 sm:w-auto"
            command={installCommand("hold-button")}
          />
        </div>
      </div>

      <nav
        aria-label="In this note"
        className="home-enter mt-14 self-end lg:mt-0"
        style={enter(4)}
      >
        <p className={cn("mb-3 text-[13px]", SOFT)}>In these notes</p>
        <ol className="flex flex-col gap-1.5">
          {[
            ...NOTES.map((n) => n.short),
            "Asking for it",
            "What people said",
          ].map((title, i) => (
            <li className="flex gap-3 text-[14px]" key={title}>
              <span
                className={cn(MONO, "w-5 text-[12px] leading-[21px]", SOFT)}
              >
                {i + 1}
              </span>
              <span className={BODY}>{title}</span>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}

/* A note --------------------------------------------------------------- */

function NoteHeading({
  index,
  title,
  id,
}: {
  index: number;
  title: string;
  id: string;
}) {
  return (
    <>
      <p className={cn(MONO, "text-[12px]", SOFT)}>Note {index}</p>
      <h2
        className={cn(
          "mt-3 text-balance text-[clamp(34px,4.6vw,48px)] leading-[1.02] tracking-[-0.015em]",
          SERIF,
          INK
        )}
        id={id}
      >
        {title}
      </h2>
    </>
  );
}

function NoteSection({
  index,
  note,
  part,
}: {
  index: number;
  note: Note;
  part: Part;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const figureRef = useRef<HTMLDivElement>(null);
  const visible = useMountWhenNear(figureRef);
  const Demo = LIVE[part.name].Component;
  const id = `note-${part.name}`;

  return (
    <section
      aria-labelledby={id}
      className={cn("border-t py-16 md:py-20", RULE)}
    >
      <div className={SPREAD}>
        <div>
          <NoteHeading id={id} index={index} title={note.title} />
          <div
            className={cn(
              "[&_code]:font-(family-name:--font-proto-mono) mt-6 flex max-w-[600px] flex-col gap-4 text-pretty text-[18px] leading-[1.7] [&_code]:text-[15px]",
              BODY
            )}
          >
            {note.body}
          </div>
        </div>
      </div>

      <figure className={cn(SPREAD, "mt-10 gap-y-6")}>
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border bg-black/[0.015] dark:bg-white/[0.02]",
            RULE
          )}
          ref={figureRef}
          style={{ height: note.height ?? 400 }}
        >
          <button
            className={cn(
              "absolute top-3 right-3 z-20 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] hover:bg-black/[0.05] hover:text-black dark:hover:bg-white/[0.07] dark:hover:text-white",
              SOFT,
              EASE_COLORS,
              FOCUS
            )}
            onClick={() => setRun((n) => n + 1)}
            type="button"
          >
            <RotateCcwIcon aria-hidden className="size-3" />
            Replay
          </button>
          <Fit className="p-8">
            {/* Callouts sit on the component itself, so they stay put
                whatever size the figure is. */}
            <div className="relative">
              {/* Mounted as the figure nears the screen, so one-shot demos
                  play when they can be seen, not on page load. */}
              {visible ? (
                <Suspense fallback={<LiveFallback />}>
                  <Demo key={run} />
                </Suspense>
              ) : (
                <LiveFallback />
              )}
              {note.callouts.map((c, i) => (
                <Marker
                  active={active === i}
                  key={c.text}
                  n={i + 1}
                  onEnter={() => setActive(i)}
                  onLeave={() => setActive(null)}
                  style={c.at}
                />
              ))}
            </div>
          </Fit>
        </div>

        <figcaption className="flex flex-col gap-6">
          <ol className="flex flex-col gap-4">
            {note.callouts.map((c, i) => (
              <li
                className="flex gap-3"
                key={c.text}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
              >
                <MarkerDot active={active === i} n={i + 1} />
                <p className={cn("text-[14px] leading-[1.6]", BODY)}>
                  {c.text}
                </p>
              </li>
            ))}
          </ol>
          <div className={cn("mt-auto border-t pt-4", RULE)}>
            <p className={cn("text-[13px]", SOFT)}>
              <span className={cn(SERIF, "text-[16px] italic", INK)}>
                Fig. {index}
              </span>{" "}
              <Link
                className={cn(
                  "rounded-sm underline decoration-black/20 underline-offset-4 hover:text-black hover:decoration-black/60 dark:decoration-white/25 dark:hover:text-white dark:hover:decoration-white/60",
                  EASE_COLORS,
                  FOCUS
                )}
                href={part.url}
              >
                {part.title}
              </Link>
              , {LIVE[part.name].hint.toLowerCase()}.
            </p>
            <CopyLine
              className={cn("mt-3 text-black/65 dark:text-white/65")}
              display={
                <>
                  npx shadcn@latest add
                  <br />
                  @kokonutui/{part.name}
                </>
              }
              label={`install command for ${part.name}`}
              value={installCommand(part.name)}
            />
          </div>
        </figcaption>
      </figure>
    </section>
  );
}

/** True once the element comes within 200px of the viewport. */
function useMountWhenNear(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, near]);
  return near;
}

const MARKER =
  "inline-flex size-[22px] shrink-0 items-center justify-center rounded-full font-semibold text-[11px] tabular-nums transition-[background-color,color,box-shadow] duration-150 ease-out";

function markerColors(active: boolean) {
  return active
    ? "bg-black text-white shadow-[0_0_0_4px_rgba(44,210,66,0.35)] dark:bg-white dark:text-black"
    : "bg-[#2CD242] text-black dark:bg-[#3BB44B]";
}

function MarkerDot({ n, active }: { n: number; active: boolean }) {
  return (
    <span aria-hidden className={cn(MARKER, "mt-px", markerColors(active))}>
      {n}
    </span>
  );
}

function Marker({
  n,
  active,
  style,
  onEnter,
  onLeave,
}: {
  n: number;
  active: boolean;
  style: CSSProperties;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        MARKER,
        "pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 shadow-[0_1px_2px_rgba(0,0,0,0.15)]",
        markerColors(active)
      )}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      style={style}
    >
      {n}
    </span>
  );
}

/* Asking for it ---------------------------------------------------------- */

const TRANSCRIPT = [
  {
    kind: "you",
    text: "Add a hold-to-delete button to the danger zone in settings",
  },
  { kind: "agent", text: "I'll use hold-button from the @kokonutui registry." },
  { kind: "cmd", text: installCommand("hold-button") },
  { kind: "done", text: "Created components/kokonutui/hold-button.tsx" },
  { kind: "done", text: "Installed motion, lucide-react" },
  {
    kind: "agent",
    text: "Added it to app/settings/danger-zone.tsx, wired to deleteAccount().",
  },
] as const;

function AgentNote({ index }: { index: number }) {
  const [client, setClient] = useState<McpClient>("claude");
  const id = "note-agents";
  return (
    <section
      aria-labelledby={id}
      className={cn("border-t py-16 md:py-20", RULE)}
    >
      <div className={SPREAD}>
        <div>
          <NoteHeading id={id} index={index} title="Or just ask for it." />
          <div
            className={cn(
              "mt-6 flex max-w-[600px] flex-col gap-4 text-pretty text-[18px] leading-[1.7]",
              BODY
            )}
          >
            <p>
              Kokonut UI is a shadcn registry. Connect your editor to the shadcn
              MCP server once, and your agent can find any of these components
              by name or by what it does, and install it with its dependencies.
            </p>
            <p>
              What lands in your project is plain source: a file you can read,
              change and keep. No package to update, no wrapper to fight.
            </p>
          </div>
        </div>
        <aside className="mt-10 flex flex-col gap-5 lg:mt-1">
          <div>
            <p className={cn("mb-2 text-[13px]", SOFT)}>
              In components.json, once
            </p>
            <CopyLine
              className="text-black/65 dark:text-white/65"
              label="registry entry"
              value={REGISTRY_ENTRY}
            />
          </div>
          <div>
            <p className={cn("mb-2 text-[13px]", SOFT)}>Then, in your editor</p>
            <ClientPicker
              className="mb-3 flex-wrap gap-x-3 gap-y-1"
              itemClassName="h-7 rounded-sm"
              onChange={setClient}
              value={client}
            />
            <CopyLine
              className="text-black/65 dark:text-white/65"
              prefix="$"
              value={mcpCommand(client)}
            />
          </div>
        </aside>
      </div>

      <figure className={cn(SPREAD, "mt-10")}>
        <ol
          className={cn(
            "flex flex-col gap-3 rounded-2xl border bg-black/[0.015] p-6 text-[14px] leading-relaxed sm:p-8 dark:bg-white/[0.02]",
            RULE
          )}
        >
          {TRANSCRIPT.map((line) => (
            <li className="flex gap-3" key={line.text}>
              {line.kind === "you" ? (
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-black px-4 py-2.5 text-white dark:bg-white dark:text-black">
                  {line.text}
                </p>
              ) : null}
              {line.kind === "agent" ? (
                <p className={INK}>{line.text}</p>
              ) : null}
              {line.kind === "cmd" ? (
                <p className={cn(MONO, "text-[13px]", SOFT)}>$ {line.text}</p>
              ) : null}
              {line.kind === "done" ? (
                <p className={cn(MONO, "text-[13px]", BODY)}>
                  <span className="text-[#1FA834] dark:text-[#3BB44B]">✓</span>{" "}
                  {line.text}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        <figcaption className={cn("mt-4 text-[13px] lg:mt-0", SOFT)}>
          <span className={cn(SERIF, "text-[16px] italic", INK)}>
            Fig. {index}
          </span>{" "}
          The same component, asked for in plain words. Works in Claude Code,
          Cursor, VS Code and Codex.
        </figcaption>
      </figure>
    </section>
  );
}

/* What people said ------------------------------------------------------- */

function Said() {
  const { post, reply } = V0_THREAD;
  return (
    <section
      aria-label="What people said"
      className={cn("border-t py-16 md:py-24", RULE)}
    >
      <figure className="flex flex-col items-start">
        <blockquote
          className={cn(
            "text-[clamp(88px,16vw,200px)] leading-[0.85] tracking-[-0.03em]",
            SERIF,
            INK
          )}
        >
          <em>“Awesome.”</em>
        </blockquote>
        <figcaption
          className={cn("mt-6 flex items-center gap-3 text-[15px]", BODY)}
        >
          <Avatar name={reply.name} size={32} src={reply.avatar} />
          <span>
            <span className={INK}>shadcn</span>, creator of shadcn/ui, replying
            to{" "}
            <a
              className={cn(
                "rounded-sm underline decoration-black/20 underline-offset-4 hover:text-black hover:decoration-black/60 dark:decoration-white/25 dark:hover:text-white dark:hover:decoration-white/60",
                EASE_COLORS,
                FOCUS
              )}
              href={post.href}
              rel="noreferrer"
              target="_blank"
            >
              “{post.text}”
            </a>
          </span>
        </figcaption>
      </figure>

      <div className="mt-16 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {POSTS.slice(0, 3).map((p) => (
          <figure className="flex flex-col gap-4" key={p.handle}>
            <blockquote
              className={cn(
                "text-pretty text-[22px] leading-[1.3]",
                SERIF,
                INK
              )}
            >
              “{p.text}”
            </blockquote>
            <figcaption
              className={cn("flex items-center gap-2.5 text-[13px]", SOFT)}
            >
              <Avatar name={p.name} size={24} src={p.avatar} />
              {p.name}, @{p.handle}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* P.S. ------------------------------------------------------------------ */

function Postscript() {
  return (
    <section
      aria-labelledby="ps"
      className={cn("border-t py-16 md:py-20", RULE)}
    >
      <div className={SPREAD}>
        <div>
          <h2
            className={cn(
              "text-[clamp(34px,4.6vw,48px)] leading-[1.02]",
              SERIF,
              INK
            )}
            id="ps"
          >
            <em>P.S.</em> When you need the whole page.
          </h2>
          <p
            className={cn(
              "mt-6 max-w-[600px] text-pretty text-[18px] leading-[1.7]",
              BODY
            )}
          >
            Kokonut UI Pro has premium sections and complete website templates,
            built the same way, on the same stack: Next.js, Tailwind CSS, Motion
            and shadcn/ui.
          </p>
          <a
            className={cn(
              "mt-6 inline-flex items-center gap-1.5 rounded-sm font-medium text-[#FF2D55] text-[16px] underline-offset-4 hover:underline",
              FOCUS
            )}
            href={PRO_URL}
            rel="noreferrer"
            target="_blank"
          >
            See Kokonut UI Pro
            <ArrowUpRightIcon aria-hidden className="size-4" />
          </a>
        </div>
      </div>
      <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {PRO_TEMPLATES.map((t, i) => (
          <li key={t.name}>
            <a
              className={cn("group block rounded-xl", FOCUS)}
              href={PRO_TEMPLATES_URL}
              rel="noreferrer"
              target="_blank"
            >
              <span
                className={cn(
                  "block overflow-hidden rounded-xl border transition-[border-color] duration-150 ease-out group-hover:border-black/20 dark:group-hover:border-white/25",
                  RULE
                )}
              >
                <Image
                  alt={`${t.name} template`}
                  className="aspect-[16/10] w-full object-cover object-top"
                  height={t.height}
                  sizes="(min-width: 640px) 340px, 100vw"
                  src={t.image}
                  width={t.width}
                />
              </span>
              <span className={cn("mt-3 block text-[13px]", SOFT)}>
                <span className={cn(SERIF, "text-[16px] italic", INK)}>
                  Fig. P{i + 1}
                </span>{" "}
                {t.name}, {t.blurb.charAt(0).toLowerCase() + t.blurb.slice(1)}.
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Contents -------------------------------------------------------------- */

function Contents({ parts }: { parts: Part[] }) {
  const groups = new Map<string, Part[]>();
  for (const p of parts) {
    groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  }
  return (
    <section
      aria-labelledby="contents"
      className={cn("border-t py-16 md:py-20", RULE)}
    >
      <h2
        className={cn(
          "text-[clamp(34px,4.6vw,48px)] leading-[1.02]",
          SERIF,
          INK
        )}
        id="contents"
      >
        Everything else.
      </h2>
      <p className={cn("mt-4 max-w-[600px] text-[18px] leading-[1.7]", BODY)}>
        The full collection, by section. Each one has a page with a live demo,
        its props and the line to install it.
      </p>
      <div className="mt-10 columns-1 gap-x-12 sm:columns-2 lg:columns-4">
        {[...groups.entries()].map(([category, items]) => (
          <div className="mb-8 break-inside-avoid" key={category}>
            <h3 className={cn("mb-2 text-[20px] italic", SERIF, INK)}>
              {category}
            </h3>
            <ul className="flex flex-col">
              {items.map((p) => (
                <li key={p.name}>
                  <Link
                    className={cn(
                      "inline-block rounded-sm py-[3px] text-[14.5px] underline-offset-4 hover:text-black hover:underline dark:hover:text-white",
                      BODY,
                      EASE_COLORS,
                      FOCUS
                    )}
                    href={p.url}
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
