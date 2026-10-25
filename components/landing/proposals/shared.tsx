"use client";

import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, Suspense, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "../home/client";
import { POSTS, V0_THREAD } from "../home/data";
import { Fit, LIVE, LiveFallback, live, useNearViewport } from "../home/live";
import type { Part } from "../home/parts";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  FOCUS_INSET,
  GRID,
  INK,
  LINE,
  MONO,
  SOFT,
} from "../home/styles";

// The proposals keep the catalog's hairline grid and stay on Tailwind's own
// type and spacing steps: no in between sizes like 11.5px or 17px.
export const META = cn(MONO, "text-black/50 text-xs dark:text-white/50");

/** The one primary button: 16px semibold, 8px by 12px of padding. */
export const BUTTON = cn(
  "inline-flex w-fit items-center gap-2 bg-black px-3 py-2 font-semibold text-base text-white hover:bg-black/80 active:bg-black/70 dark:bg-white dark:text-black dark:active:bg-white/70 dark:hover:bg-white/85",
  EASE_COLORS,
  FOCUS
);

/** More app components than the homepage runs, all rendered with their docs defaults. */
export const DEMOS = {
  ...LIVE,
  "ai-tool-approval": live(
    () => import("@/components/kokonutui/ai-tool-approval"),
    ({ default: C }) => <C className="w-full max-w-[420px]" />,
    "Approve or deny what the agent wants to run"
  ),
  "ai-diff-review": live(
    () => import("@/components/kokonutui/ai-diff-review"),
    ({ default: C }) => <C className="w-full max-w-[480px]" />,
    "Accept or reject each change"
  ),
  "slide-to-confirm": live(
    () => import("@/components/kokonutui/slide-to-confirm"),
    ({ default: C }) => <C />,
    "Slide all the way to pay"
  ),
  "save-button": live(
    () => import("@/components/kokonutui/save-button"),
    ({ default: C }) => <C />,
    "Save, then pick a collection"
  ),
  "undo-button": live(
    () => import("@/components/kokonutui/undo-button"),
    ({ default: C }) => <C />,
    "Archive, then take it back"
  ),
  "ai-inline-edit": live(
    () => import("@/components/kokonutui/ai-inline-edit"),
    ({ default: C }) => <C className="w-full max-w-[480px]" />,
    "Select text and ask for an edit"
  ),
  "ai-model-selector": live(
    () => import("@/components/kokonutui/ai-model-selector"),
    ({ default: C }) => <C />,
    "Switch models mid conversation"
  ),
  "currency-transfer": live(
    () => import("@/components/kokonutui/currency-transfer"),
    ({ default: C }) => <C />,
    "Type an amount to convert"
  ),
  "receipt-printer": live(
    () => import("@/components/kokonutui/receipt-printer"),
    ({ default: C }) => <C />,
    "Print the receipt"
  ),
  "amount-pad": live(
    () => import("@/components/kokonutui/amount-pad"),
    ({ default: C }) => <C />,
    "Tap in an amount"
  ),
  "signature-pad": live(
    () => import("@/components/kokonutui/signature-pad"),
    ({ default: C }) => <C />,
    "Sign with your pointer"
  ),
  "hold-button": live(
    () => import("@/components/kokonutui/hold-button"),
    ({ default: C }) => <C />,
    "Hold to delete"
  ),
  "uptime-card": live(
    () => import("@/components/kokonutui/uptime-card"),
    ({ default: C }) => <C />,
    "Hover a day for its incidents"
  ),
  "spending-ring": live(
    () => import("@/components/kokonutui/spending-ring"),
    ({ default: C }) => <C />,
    "Hover a slice"
  ),
  "slot-picker": live(
    () => import("@/components/kokonutui/slot-picker"),
    ({ default: C }) => <C />,
    "Pick a day and a time"
  ),
};

export type DemoName = keyof typeof DEMOS;

/**
 * A live component in a frame of fixed height, at its natural size. Fit only
 * shrinks it when the frame is narrower than the component (phones).
 */
export function Demo({
  name,
  className,
  run,
}: {
  name: string;
  className?: string;
  /** Changing it remounts the component, to replay its entrance. */
  run?: number;
}) {
  const entry = DEMOS[name as DemoName];
  const { ref, near } = useNearViewport<HTMLDivElement>();
  if (!entry) {
    return null;
  }
  const Component = entry.Component;
  return (
    <div className={cn("relative h-80", className)} ref={ref}>
      {entry.wide ? (
        <div className="absolute inset-3 overflow-hidden">
          {near ? (
            <Suspense fallback={<LiveFallback />}>
              <Component key={run} />
            </Suspense>
          ) : null}
        </div>
      ) : (
        <Fit className="p-6">
          {near ? (
            <Suspense fallback={<LiveFallback />}>
              <Component key={run} />
            </Suspense>
          ) : null}
        </Fit>
      )}
    </div>
  );
}

export function SectionHead({
  id,
  title,
  aside,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 border-t pt-4 pb-8 md:grid-cols-2 lg:grid-cols-3",
        LINE
      )}
    >
      <h2
        className={cn(
          "text-balance font-semibold text-4xl tracking-tight md:text-5xl lg:col-span-2",
          INK
        )}
        id={id}
      >
        {title}
      </h2>
      {aside ? (
        <p
          className={cn(
            "max-w-[400px] self-end text-pretty text-base md:justify-self-end",
            SOFT
          )}
        >
          {aside}
        </p>
      ) : null}
    </div>
  );
}

/* Tagline -------------------------------------------------------------- */

/**
 * A large two line statement. With `reveal`, each word goes from muted to
 * full ink as it crosses a line 40% up from the bottom of the screen, in
 * reading order; only the color changes, nothing moves.
 */
export function Tagline({
  lines,
  reveal = false,
}: {
  lines: string[];
  reveal?: boolean;
}) {
  const root = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!(el && reveal)) {
      return;
    }
    const words = [...el.querySelectorAll<HTMLElement>("[data-word]")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const w of words) {
        w.dataset.on = "";
      }
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const w = entry.target as HTMLElement;
          // Words below the line are muted again, so scrolling back up
          // reads the sentence in reverse.
          if (entry.isIntersecting) {
            w.dataset.on = "";
          } else if (entry.boundingClientRect.top > 0) {
            delete w.dataset.on;
          }
        }
      },
      { rootMargin: "0px 0px -40% 0px" }
    );
    for (const w of words) {
      observer.observe(w);
    }
    return () => observer.disconnect();
  }, [reveal]);

  return (
    <section aria-label="Kokonut UI in two lines" className="py-24 md:py-32">
      <p
        className={cn(
          "max-w-[880px] text-balance font-semibold text-4xl tracking-tight md:text-6xl",
          INK
        )}
        ref={root}
      >
        {lines.map((line, i) => (
          <span className="block" key={line}>
            {reveal
              ? line.split(" ").map((word, j) => (
                  <span
                    className="text-black/25 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] data-[on]:text-black dark:text-white/25 dark:data-[on]:text-white"
                    data-word
                    // biome-ignore lint/suspicious/noArrayIndexKey: words repeat; their position is their identity
                    key={`${i}-${j}`}
                  >
                    {word}{" "}
                  </span>
                ))
              : line}
          </span>
        ))}
      </p>
    </section>
  );
}

/* Proof ---------------------------------------------------------------- */

export function Proof({ id = "proof" }: { id?: string }) {
  const { post, reply } = V0_THREAD;
  return (
    <section aria-labelledby={id} className="pt-24 md:pt-32">
      <SectionHead
        aside="Posts from developers who found it, including the person behind shadcn/ui."
        id={id}
        title="What developers say"
      />
      <div className={cn("grid grid-cols-1 border md:grid-cols-3", GRID, LINE)}>
        <a
          className={cn(
            "flex flex-col justify-between gap-8 p-6 md:row-span-2 md:p-8",
            CELL,
            "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
            EASE_COLORS,
            FOCUS_INSET
          )}
          href={post.href}
          rel="noreferrer"
          target="_blank"
        >
          <span className={META}>
            Re: “{post.text}” · {post.date}
          </span>
          <span
            className={cn(
              "font-semibold text-6xl tracking-tighter lg:text-7xl",
              INK
            )}
          >
            {reply.text}
          </span>
          <span className="flex items-center gap-3">
            <Avatar name={reply.name} size={32} src={reply.avatar} />
            <span className="text-sm">
              <span className={cn("font-medium", INK)}>shadcn</span>
              <span className={SOFT}>, creator of shadcn/ui</span>
            </span>
          </span>
        </a>
        {POSTS.slice(0, 4).map((p) => (
          <figure
            className={cn("flex flex-col gap-4 p-6", CELL)}
            key={p.handle}
          >
            <blockquote className={cn("text-pretty text-base", INK)}>
              “{p.text}”
            </blockquote>
            <figcaption className="mt-auto flex items-center gap-2">
              <Avatar name={p.name} size={24} src={p.avatar} />
              <span className="text-sm">
                <span className={INK}>{p.name}</span>
                <span className={cn(META, "ml-2")}>@{p.handle}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* FAQ ------------------------------------------------------------------ */

export interface Question {
  q: string;
  a: string;
}

export const QUESTIONS: Question[] = [
  {
    q: "Is Kokonut UI free?",
    a: "Yes. Every component on kokonutui.com is MIT licensed and free to use in personal and commercial projects. Kokonut UI Pro is a separate, paid set of templates and sections.",
  },
  {
    q: "Do I need shadcn/ui to use it?",
    a: "You need the shadcn CLI and a components.json file, which shadcn init creates. Kokonut UI is a shadcn registry, so components install the same way shadcn/ui components do, and some build on shadcn/ui primitives.",
  },
  {
    q: "How do I install a component?",
    a: "Run npx shadcn@latest add @kokonutui/ followed by the component name. The CLI writes the file to components/kokonutui and installs the packages it needs, such as motion and lucide-react.",
  },
  {
    q: "Can my AI agent install components for me?",
    a: "Yes. Connect Claude Code, Cursor, VS Code or Codex once with npx shadcn@latest mcp init, then ask for a component by name or describe what you need. The agent finds it in the registry and installs it.",
  },
  {
    q: "Which frameworks does it work with?",
    a: "Any React project with Tailwind CSS v4, including Next.js, Vite and Remix. Components are client components and use Motion for animation.",
  },
  {
    q: "Can I change the components?",
    a: "Yes, that is the point. The source lands in your repo as a single file you own, styled with Tailwind classes you can edit like code you wrote.",
  },
  {
    q: "Do components support dark mode?",
    a: "Yes. Components are styled for light and dark with Tailwind's dark variant, so they follow your site's theme.",
  },
  {
    q: "How is Kokonut UI different from shadcn/ui?",
    a: "shadcn/ui gives you the building blocks: buttons, dialogs, inputs. Kokonut UI adds finished, animated components on top, such as AI chat inputs, approval prompts, pickers and dashboard cards, through the same CLI.",
  },
];

/** Plain questions and answers, plus FAQPage schema for search and answer engines. */
export function Faq({
  id = "questions",
  questions = QUESTIONS,
}: {
  id?: string;
  questions?: Question[];
}) {
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  });
  return (
    <section aria-labelledby={id} className="pt-24 md:pt-32">
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema.org JSON-LD built from the questions above
        dangerouslySetInnerHTML={{ __html: schema }}
        type="application/ld+json"
      />
      <SectionHead
        aside="Short answers. Each component's docs page covers its props and packages."
        id={id}
        title="Questions"
      />
      <div className={cn("grid grid-cols-1 border md:grid-cols-2", GRID, LINE)}>
        {questions.map(({ q, a }) => (
          <details className={cn("group", CELL)} key={q}>
            <summary
              className={cn(
                "flex cursor-pointer list-none items-start justify-between gap-4 p-6 font-medium text-base [&::-webkit-details-marker]:hidden",
                INK,
                "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                EASE_COLORS,
                FOCUS_INSET
              )}
            >
              <span className="text-pretty">{q}</span>
              <PlusIcon
                aria-hidden
                className="mt-1 size-4 shrink-0 text-black/40 transition-[rotate] duration-200 ease-out group-open:rotate-45 dark:text-white/40"
              />
            </summary>
            <p className={cn("text-pretty px-6 pb-6 text-sm", SOFT)}>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* Use cases ------------------------------------------------------------ */

export const USE_CASES: { title: string; body: string; names: string[] }[] = [
  {
    title: "AI chat and agents",
    body: "The prompt box, the model picker, the steps while it works, and the moment it asks before running something.",
    names: [
      "ai-prompt",
      "ai-input-search",
      "ai-model-selector",
      "ai-loading",
      "ai-tool-approval",
      "ai-diff-review",
      "ai-inline-edit",
    ],
  },
  {
    title: "Payments and checkout",
    body: "Amounts, cards and the last step before money moves, built so people do not pay by accident.",
    names: [
      "amount-pad",
      "card-field",
      "currency-transfer",
      "slide-to-confirm",
      "receipt-printer",
      "cart-button",
    ],
  },
  {
    title: "Actions people should not undo by accident",
    body: "Deletes, archives and saves that confirm themselves or can be taken back.",
    names: [
      "hold-button",
      "tear-button",
      "undo-button",
      "save-button",
      "slide-to-confirm",
    ],
  },
  {
    title: "Dashboards",
    body: "Cards for the numbers people check every morning: activity, revenue, uptime and spend.",
    names: [
      "apple-activity-card",
      "metric-card",
      "uptime-card",
      "spending-ring",
      "liquid-gauge",
      "activity-terrain",
    ],
  },
  {
    title: "Booking and scheduling",
    body: "Pick a time, a seat or a stay without a wall of form fields.",
    names: [
      "slot-picker",
      "seat-map",
      "stay-picker",
      "timezone-planner",
      "wheel-picker",
    ],
  },
  {
    title: "Marketing pages",
    body: "Backgrounds and type that react to the pointer, for heroes that need one moving part.",
    names: [
      "drape-background",
      "plucked-text",
      "split-flap-text",
      "topo-background",
      "swoosh-text",
    ],
  },
];

export function PartLinks({
  names,
  byName,
}: {
  names: string[];
  byName: Map<string, Part>;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {names.flatMap((name) => {
        const p = byName.get(name);
        return p
          ? [
              <li key={name}>
                <Link
                  className={cn(
                    "rounded-sm text-sm underline decoration-black/20 underline-offset-4 hover:decoration-black dark:decoration-white/25 dark:hover:decoration-white",
                    INK,
                    EASE_COLORS,
                    FOCUS
                  )}
                  href={p.url}
                >
                  {p.title}
                </Link>
              </li>,
            ]
          : [];
      })}
    </ul>
  );
}

/* Final call to action ------------------------------------------------- */

export function FinalCta({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <section
      aria-labelledby="start"
      className={cn(
        "mt-24 flex flex-col gap-8 border p-6 sm:p-8 md:mt-32 md:flex-row md:items-end md:justify-between md:p-12",
        LINE
      )}
    >
      <div className="flex max-w-[680px] flex-col gap-4">
        <h2
          className={cn(
            "text-balance font-semibold text-4xl tracking-tight md:text-5xl",
            INK
          )}
          id="start"
        >
          {title}
        </h2>
        <p className={cn("text-pretty text-base", SOFT)}>{body}</p>
      </div>
      {action}
    </section>
  );
}

export function BrowseButton({ count }: { count: number }) {
  return (
    <Link className={cn(BUTTON, "shrink-0")} href="/docs">
      Browse {count} components
      <ArrowRightIcon aria-hidden className="size-4" />
    </Link>
  );
}
