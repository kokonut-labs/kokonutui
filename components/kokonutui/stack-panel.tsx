"use client";

/**
 * @author: @dorianbaffier
 * @description: Stack Panel
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  type PanInfo,
  useAnimate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

export interface StackRow {
  id: string;
  label: string;
  /** Grey text on the right, like the current value of a setting. */
  detail?: string;
  /** Id of the page this row opens. */
  to?: string;
  /** Anything else on the right: a switch, a badge. */
  trailing?: ReactNode;
  onSelect?: () => void;
  /** Shows a check, for rows that pick one option of a section. */
  selected?: boolean;
  /** Shows a switch in this state, for rows that turn something on. */
  checked?: boolean;
  tone?: "default" | "danger";
}

export interface StackSection {
  title?: string;
  rows: StackRow[];
  /** Small print under the section. */
  footer?: string;
}

export interface StackPage {
  title: string;
  sections: StackSection[];
}

export interface StackPanelProps {
  pages: Record<string, StackPage>;
  /** The page the panel starts on. */
  root: string;
  className?: string;
}

// iOS pushes with a curve close to this; the page settles without bounce.
const PUSH = { type: "spring", duration: 0.42, bounce: 0 } as const;
const HEIGHT = { type: "spring", duration: 0.38, bounce: 0 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// The page underneath moves a third as far as the one on top.
const PARALLAX = 0.3;
// Let go past this share of the width, or flick faster, and the page pops.
const POP_DISTANCE = 0.35;
const POP_VELOCITY = 500;

interface Origin {
  /** The tapped row's label, relative to the panel. */
  left: number;
  top: number;
  height: number;
  fontSize: number;
}

/**
 * The header title. Pushed in from a row, it flies from that row's label
 * up into the header; otherwise it slides a little and fades.
 */
function Title({
  text,
  origin,
  direction,
  panel,
}: {
  text: string;
  origin: Origin | null;
  direction: 1 | -1;
  panel: HTMLElement | null;
}) {
  const [scope, run] = useAnimate<HTMLSpanElement>();
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const el = scope.current;
    if (!(el && panel)) {
      return;
    }
    if (!origin || reduced) {
      run(
        el,
        { opacity: [0, 1], x: [direction * 24, 0] },
        { duration: reduced ? 0 : 0.28, ease: EASE_OUT }
      );
      return;
    }
    const box = panel.getBoundingClientRect();
    const own = el.getBoundingClientRect();
    const fontSize = Number.parseFloat(getComputedStyle(el).fontSize);
    const scale = origin.fontSize / fontSize;
    const dx = origin.left - (own.left - box.left);
    const dy =
      origin.top + origin.height / 2 - (own.top - box.top + own.height / 2);
    // Placed at the row before the first frame, so it never flashes in the
    // header first.
    el.style.transform = `translateX(${dx}px) translateY(${dy}px) scale(${scale})`;
    run(
      el,
      { x: [dx, 0], y: [dy, 0], scale: [scale, 1], opacity: [1, 1] },
      PUSH
    );
  }, [scope, run, origin, direction, panel, reduced]);

  return (
    <motion.span
      className="absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[55%] -translate-y-1/2 truncate font-semibold text-[15px] text-zinc-900 dark:text-zinc-100"
      exit={{
        opacity: 0,
        x: direction * -40,
        transition: { duration: 0.18, ease: EASE_OUT },
      }}
      ref={scope}
      style={{ transformOrigin: "left center" }}
    >
      {text}
    </motion.span>
  );
}

function Page({
  page,
  onOpen,
  measureRef,
}: {
  page: StackPage;
  onOpen: (row: StackRow, label: HTMLElement) => void;
  measureRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="flex flex-col gap-5 px-3 pt-2 pb-4" ref={measureRef}>
      {page.sections.map((section, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: sections are a fixed, ordered list
        <section key={index}>
          {section.title && (
            <h3 className="mb-1.5 px-3 font-medium text-xs text-zinc-500 dark:text-zinc-400">
              {section.title}
            </h3>
          )}
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl bg-zinc-50 dark:divide-zinc-800/70 dark:bg-zinc-900">
            {section.rows.map((row) => (
              <li key={row.id}>
                <RowView onOpen={onOpen} row={row} />
              </li>
            ))}
          </ul>
          {section.footer && (
            <p className="mt-1.5 px-3 text-xs text-zinc-400 leading-5 dark:text-zinc-500">
              {section.footer}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function RowView({
  row,
  onOpen,
}: {
  row: StackRow;
  onOpen: (row: StackRow, label: HTMLElement) => void;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const interactive = Boolean(row.to || row.onSelect);
  const content = (
    <>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[15px]",
          row.tone === "danger"
            ? "text-red-600 dark:text-red-400"
            : "text-zinc-900 dark:text-zinc-100"
        )}
        ref={labelRef}
      >
        {row.label}
      </span>
      {row.detail && (
        <span className="max-w-[45%] shrink-0 truncate text-sm text-zinc-500 dark:text-zinc-400">
          {row.detail}
        </span>
      )}
      {row.trailing}
      {row.checked !== undefined && <Toggle on={row.checked} />}
      {row.selected !== undefined && (
        <Check
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-zinc-900 dark:text-zinc-100",
            !row.selected && "invisible"
          )}
        />
      )}
      {row.to && (
        <ChevronRight
          aria-hidden="true"
          className="-mr-1 size-4 shrink-0 text-zinc-400 dark:text-zinc-500"
        />
      )}
    </>
  );
  const base = "flex min-h-11 w-full items-center gap-2 px-3 py-2";
  if (!interactive) {
    return <div className={base}>{content}</div>;
  }
  const className = cn(
    base,
    "outline-none transition-colors duration-150 hover:bg-zinc-100 focus-visible:bg-zinc-100 active:bg-zinc-100 dark:active:bg-zinc-800 dark:focus-visible:bg-zinc-800 dark:hover:bg-zinc-800/60"
  );
  const onClick = () => {
    if (labelRef.current) {
      onOpen(row, labelRef.current);
    }
  };
  if (row.checked !== undefined) {
    return (
      <button
        aria-checked={row.checked}
        className={className}
        onClick={onClick}
        role="switch"
        type="button"
      >
        {content}
      </button>
    );
  }
  return (
    <button
      aria-pressed={row.selected}
      className={className}
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  );
}

/**
 * A panel that drills into pages, like settings on a phone. A row opens its
 * page from the right while its label flies up to become the title; swipe
 * the page right, or press Back or Escape, to return.
 */
export function StackPanel({ pages, root, className }: StackPanelProps) {
  const [stack, setStack] = useState<string[]>([root]);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  // "auto" until the first page is measured, so the server render has a
  // height too.
  const [height, setHeight] = useState<number | "auto">("auto");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  // The top page's offset; the page underneath is derived from it, so a
  // push, a pop and a swipe all move both pages together.
  const x = useMotionValue(0);
  const [width, setWidth] = useState(360);
  const underX = useTransform(x, (v) => -PARALLAX * (width - v));
  const shade = useTransform(x, [0, width], [0.06, 0]);

  const top = stack.at(-1) ?? root;
  const under = stack.length > 1 ? stack.at(-2) : undefined;
  const parent = under ? pages[under] : undefined;

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }
    const watch = new ResizeObserver(() => setWidth(body.clientWidth));
    watch.observe(body);
    return () => {
      watch.disconnect();
      observer.current?.disconnect();
    };
  }, []);

  // The panel's height follows the page on top.
  const measure = (el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) {
      return;
    }
    observer.current = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.current.observe(el);
  };

  const push = (row: StackRow, label: HTMLElement) => {
    row.onSelect?.();
    if (!(row.to && pages[row.to]) || busy) {
      return;
    }
    const box = panelRef.current?.getBoundingClientRect();
    const rect = label.getBoundingClientRect();
    setOrigin(
      box
        ? {
            left: rect.left - box.left,
            top: rect.top - box.top,
            height: rect.height,
            fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
          }
        : null
    );
    setDirection(1);
    setBusy(true);
    x.set(width);
    const to = row.to;
    flushSync(() => setStack((s) => [...s, to]));
    animate(x, 0, PUSH).then(() => setBusy(false));
    backRef.current?.focus({ preventScroll: true });
  };

  const pop = () => {
    if (stack.length < 2) {
      return;
    }
    setOrigin(null);
    setDirection(-1);
    setBusy(true);
    animate(x, width, { ...PUSH, duration: 0.34 }).then(() => {
      // Both in one frame: the old top unmounts as the offset resets.
      flushSync(() => setStack((s) => s.slice(0, -1)));
      x.set(0);
      setBusy(false);
    });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (x.get() > width * POP_DISTANCE || info.velocity.x > POP_VELOCITY) {
      pop();
    } else {
      animate(x, 0, PUSH);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && stack.length > 1) {
      event.preventDefault();
      pop();
      backRef.current?.focus({ preventScroll: true });
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions: Escape is a shortcut for the Back button */}
      <div
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
          className
        )}
        onKeyDown={onKeyDown}
        ref={panelRef}
      >
        <div className="relative z-10 flex h-12 items-center border-zinc-100 border-b bg-white px-2 dark:border-zinc-900 dark:bg-zinc-950">
          <AnimatePresence initial={false}>
            {parent && (
              <motion.button
                animate={{ opacity: 1 }}
                className="relative z-10 flex max-w-[30%] items-center rounded-lg py-1.5 pr-2 pl-1 text-sm text-zinc-600 outline-none transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="back"
                onClick={pop}
                ref={backRef}
                transition={{ duration: 0.18 }}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{parent.title}</span>
              </motion.button>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            <Title
              direction={direction}
              key={`${top}-${stack.length}`}
              origin={origin}
              panel={panelRef.current}
              text={pages[top]?.title ?? ""}
            />
          </AnimatePresence>
        </div>

        <motion.div
          animate={{ height }}
          className="relative"
          ref={bodyRef}
          transition={HEIGHT}
        >
          {under && pages[under] && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0"
              inert
              key={`${under}-${stack.length - 1}`}
              style={{ x: underX }}
            >
              <Page onOpen={() => undefined} page={pages[under]} />
              <motion.div
                className="absolute inset-0 bg-black"
                style={{ opacity: shade }}
              />
            </motion.div>
          )}
          {pages[top] && (
            <motion.div
              className="relative bg-white dark:bg-zinc-950"
              drag={stack.length > 1 && !busy ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragDirectionLock
              dragElastic={{ left: 0, right: 1 }}
              dragMomentum={false}
              key={`${top}-${stack.length}`}
              onDragEnd={onDragEnd}
              style={{
                x,
                boxShadow:
                  stack.length > 1 ? "-8px 0 24px -12px rgb(0 0 0 / 0.18)" : "",
              }}
            >
              <Page measureRef={measure} onOpen={push} page={pages[top]} />
            </motion.div>
          )}
        </motion.div>
      </div>
    </MotionConfig>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative h-[22px] w-9 shrink-0 rounded-full transition-colors duration-200",
        on ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] dark:bg-zinc-950",
          on && "translate-x-3.5"
        )}
      />
    </span>
  );
}

/** Workspace settings, three levels deep. */
export default function StackPanelDemo({ className }: { className?: string }) {
  const [theme, setTheme] = useState("System");
  const [density, setDensity] = useState("Comfortable");
  const [alerts, setAlerts] = useState({
    mentions: true,
    digest: false,
    deploys: true,
  });
  const [quiet, setQuiet] = useState("22:00 – 07:00");

  const flip = (key: keyof typeof alerts) => () =>
    setAlerts((a) => ({ ...a, [key]: !a[key] }));
  const toggleRow = (id: keyof typeof alerts, label: string): StackRow => ({
    id,
    label,
    onSelect: flip(id),
    checked: alerts[id],
  });
  const choice = (
    value: string,
    current: string,
    set: (v: string) => void
  ): StackRow => ({
    id: value,
    label: value,
    selected: value === current,
    onSelect: () => set(value),
  });

  const pages: Record<string, StackPage> = {
    settings: {
      title: "Settings",
      sections: [
        {
          rows: [
            {
              id: "account",
              label: "Account",
              detail: "Maya Chen",
              to: "account",
            },
            {
              id: "appearance",
              label: "Appearance",
              detail: theme,
              to: "appearance",
            },
            {
              id: "notifications",
              label: "Notifications",
              to: "notifications",
            },
          ],
        },
        {
          rows: [
            { id: "billing", label: "Billing", detail: "Pro", to: "billing" },
            { id: "shortcuts", label: "Keyboard shortcuts", detail: "34" },
          ],
        },
      ],
    },
    account: {
      title: "Account",
      sections: [
        {
          rows: [
            { id: "name", label: "Name", detail: "Maya Chen" },
            { id: "email", label: "Email", detail: "maya@acme.com" },
            { id: "security", label: "Password & security", to: "security" },
          ],
        },
        {
          rows: [
            {
              id: "sign-out",
              label: "Sign out",
              tone: "danger",
              onSelect: () => undefined,
            },
          ],
        },
      ],
    },
    security: {
      title: "Password & security",
      sections: [
        {
          rows: [
            {
              id: "password",
              label: "Password",
              detail: "Changed 3 months ago",
            },
            { id: "2fa", label: "Two-factor", detail: "Authenticator app" },
            { id: "sessions", label: "Active sessions", detail: "3" },
          ],
          footer: "Signing out of a session takes effect on its next request.",
        },
      ],
    },
    appearance: {
      title: "Appearance",
      sections: [
        {
          title: "Theme",
          rows: ["Light", "Dark", "System"].map((v) =>
            choice(v, theme, setTheme)
          ),
        },
        {
          title: "Density",
          rows: ["Comfortable", "Compact"].map((v) =>
            choice(v, density, setDensity)
          ),
        },
      ],
    },
    notifications: {
      title: "Notifications",
      sections: [
        {
          rows: [
            toggleRow("mentions", "Mentions"),
            toggleRow("deploys", "Failed deploys"),
            toggleRow("digest", "Weekly digest"),
          ],
        },
        {
          rows: [
            { id: "quiet", label: "Quiet hours", detail: quiet, to: "quiet" },
          ],
          footer: "Nothing but failed deploys gets through in quiet hours.",
        },
      ],
    },
    quiet: {
      title: "Quiet hours",
      sections: [
        {
          rows: ["Off", "22:00 – 07:00", "20:00 – 09:00", "Weekends"].map((v) =>
            choice(v, quiet, setQuiet)
          ),
        },
      ],
    },
    billing: {
      title: "Billing",
      sections: [
        {
          rows: [
            { id: "plan", label: "Plan", detail: "Pro, yearly" },
            { id: "next", label: "Next invoice", detail: "Nov 1 · $96" },
            { id: "card", label: "Card", detail: "Visa ·· 4242" },
          ],
        },
      ],
    },
  };

  return <StackPanel className={className} pages={pages} root="settings" />;
}
