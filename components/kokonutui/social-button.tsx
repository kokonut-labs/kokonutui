"use client";

/**
 * @author: @dorianbaffier
 * @description: Social Button
 * @version: 2.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Link, Mail } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SocialShareData {
  title?: string;
  text?: string;
  /** Defaults to the current page URL. */
  url?: string;
}

export interface ResolvedShareData {
  title: string;
  text: string;
  url: string;
}

export interface ShareItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Renders the item as a link. Mail links open in place, others in a new tab. */
  href?: string | ((data: ResolvedShareData) => string);
  /** "copy" writes the URL to the clipboard and confirms it in place. */
  action?: "copy";
  onClick?: (data: ResolvedShareData) => void;
}

interface SocialButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label?: string;
  /** Icon shown on the trigger next to the label. */
  icon?: ComponentType<{ className?: string }>;
  items?: ShareItem[];
  shareData?: SocialShareData;
  /** "inline" swaps the trigger for the row; "popover" opens a menu from it. */
  placement?: "inline" | "popover";
  /** Use the system share sheet on touch devices that have one. */
  nativeShare?: boolean;
  onShare?: (index: number, item: ShareItem) => void;
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  viewBox: "0 0 24 24",
} as const;

// Outline brand marks so they match the stroke weight of the lucide icons.
function XIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} {...strokeProps}>
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} {...strokeProps}>
      <path d="M8 11v5" />
      <path d="M8 8v.01" />
      <path d="M12 16v-5" />
      <path d="M16 16v-3a2 2 0 1 0 -4 0" />
      <path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4z" />
    </svg>
  );
}

const enc = encodeURIComponent;

const DEFAULT_SHARE_ITEMS: ShareItem[] = [
  {
    icon: XIcon,
    label: "Post on X",
    href: ({ title, text, url }) =>
      `https://x.com/intent/post?text=${enc(text || title)}&url=${enc(url)}`,
  },
  {
    icon: LinkedinIcon,
    label: "Share on LinkedIn",
    href: ({ url }) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
  },
  {
    icon: Mail,
    label: "Send by email",
    href: ({ title, text, url }) =>
      `mailto:?subject=${enc(title)}&body=${enc([text, url].filter(Boolean).join("\n\n"))}`,
  },
  { icon: Link, label: "Copy link", action: "copy" },
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const HOVER_OPEN_MS = 100;
const HOVER_CLOSE_MS = 160;
const COPIED_MS = 1500;
const STAGGER_S = 0.025;
// Popover width (w-48) and row height, used to decide where it fits.
const POPOVER_WIDTH = 192;
const POPOVER_ROW = 34;

interface MenuPosition {
  side: "top" | "bottom";
  align: "start" | "end";
}

const SHOWN = { opacity: 1, filter: "blur(0px)" };
const HIDDEN = { opacity: 0, filter: "blur(2px)" };
const CROSSFADE = { duration: 0.18, ease: EASE_OUT };

/** The item icon, which blurs into a drawn check while "Copied" shows. */
function CopyGlyph({
  copied,
  icon: Icon,
  instant,
}: {
  copied: boolean;
  icon: ComponentType<{ className?: string }>;
  instant: boolean;
}) {
  const fade = instant ? { duration: 0 } : CROSSFADE;
  const draw = copied && !instant;
  return (
    <span className="relative inline-flex size-4 shrink-0">
      <motion.span
        animate={copied ? HIDDEN : SHOWN}
        className="absolute inset-0 inline-flex"
        initial={false}
        transition={fade}
      >
        <Icon className="size-4" />
      </motion.span>
      <motion.svg
        animate={copied ? SHOWN : HIDDEN}
        aria-hidden="true"
        className="absolute inset-0 size-4"
        initial={false}
        transition={fade}
        {...strokeProps}
        strokeWidth={2.25}
      >
        <motion.path
          animate={{ pathLength: copied ? 1 : 0 }}
          d="M4.5 12.5l4.75 4.75L19.5 7"
          initial={false}
          transition={{
            duration: draw ? 0.26 : 0,
            delay: draw ? 0.06 : 0,
            ease: EASE_OUT,
          }}
        />
      </motion.svg>
    </span>
  );
}

/** Inline row: a small chip above the icon. */
function CopiedChip({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          animate={SHOWN}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-1.5 py-0.5 font-medium text-[11px] text-white dark:bg-zinc-50 dark:text-zinc-900"
          exit={HIDDEN}
          initial={HIDDEN}
          transition={CROSSFADE}
        >
          Copied
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** Popover menu: the label itself crossfades to "Copied". */
function SwapLabel({ label, copied }: { label: string; copied: boolean }) {
  return (
    <span className="grid">
      {[label, "Copied"].map((text, n) => {
        const shown = (n === 1) === copied;
        return (
          <motion.span
            animate={shown ? SHOWN : HIDDEN}
            aria-hidden={!shown}
            className="[grid-area:1/1]"
            initial={false}
            key={text}
            transition={CROSSFADE}
          >
            {text}
          </motion.span>
        );
      })}
    </span>
  );
}

interface ShareItemNodeProps {
  item: ShareItem;
  data: ResolvedShareData;
  inline: boolean;
  copied: boolean;
  tabbable: boolean;
  instant: boolean;
  onActivate: () => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function ShareItemNode({
  item,
  data,
  inline,
  copied,
  tabbable,
  instant,
  onActivate,
  onFocus,
  onKeyDown,
}: ShareItemNodeProps) {
  const isCopy = item.action === "copy";
  const href = typeof item.href === "function" ? item.href(data) : item.href;
  const opensTab = href ? !href.startsWith("mailto:") : false;

  const glyph = isCopy ? (
    <CopyGlyph copied={copied} icon={item.icon} instant={instant} />
  ) : (
    <item.icon className="size-4 shrink-0" />
  );
  let text: React.ReactNode = <span>{item.label}</span>;
  if (inline) {
    text = isCopy ? <CopiedChip show={copied} /> : null;
  } else if (isCopy) {
    text = <SwapLabel copied={copied} label={item.label} />;
  }

  const shared = {
    "aria-label": inline ? item.label : undefined,
    className: cn(
      "relative flex h-8 items-center outline-hidden",
      "text-zinc-600 dark:text-zinc-400",
      "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-50",
      "focus-visible:bg-zinc-100 focus-visible:text-zinc-900 dark:focus-visible:bg-zinc-800/70 dark:focus-visible:text-zinc-50",
      "active:bg-zinc-200 dark:active:bg-zinc-800",
      "transition-colors duration-150",
      inline
        ? "justify-center rounded-[5px]"
        : "w-full gap-2.5 rounded-md px-2 text-left text-sm",
      copied && "text-zinc-900 dark:text-zinc-50"
    ),
    "data-share-item": "",
    onClick: onActivate,
    onFocus,
    onKeyDown,
    role: "menuitem",
    tabIndex: tabbable ? 0 : -1,
  } as const;

  if (href) {
    return (
      <a
        {...shared}
        href={href}
        rel={opensTab ? "noopener noreferrer" : undefined}
        target={opensTab ? "_blank" : undefined}
      >
        {glyph}
        {text}
      </a>
    );
  }
  return (
    <button {...shared} type="button">
      {glyph}
      {text}
    </button>
  );
}

function useTimer() {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (ref.current) {
      clearTimeout(ref.current);
    }
  }, []);
  const set = useCallback(
    (fn: () => void, ms: number) => {
      clear();
      ref.current = setTimeout(fn, ms);
    },
    [clear]
  );
  useEffect(() => clear, [clear]);
  return { set, clear };
}

async function tryNativeShare(enabled: boolean, data: ResolvedShareData) {
  const canNative =
    enabled &&
    typeof navigator.share === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  if (!canNative) {
    return false;
  }
  try {
    await navigator.share({
      title: data.title || undefined,
      text: data.text || undefined,
      url: data.url || window.location.href,
    });
    return true;
  } catch (error) {
    // Dismissing the sheet is a choice, not a failure: don't open the menu.
    return error instanceof DOMException && error.name === "AbortError";
  }
}

// Hover intent on fine pointers only; touch emulates mouse events too.
const canHover = (e: React.PointerEvent) =>
  e.pointerType === "mouse" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const ITEM_KEYS: Record<string, (index: number, last: number) => number> = {
  ArrowDown: (i) => i + 1,
  ArrowRight: (i) => i + 1,
  ArrowUp: (i) => i - 1,
  ArrowLeft: (i) => i - 1,
  Home: () => 0,
  End: (_, last) => last,
};

/** Flip above and/or align to the right edge when the menu would not fit. */
function placeMenu(rect: DOMRect, count: number): MenuPosition {
  const height = count * POPOVER_ROW + 10;
  const fitsBelow = window.innerHeight - rect.bottom > height + 8;
  return {
    side: !fitsBelow && rect.top > height + 8 ? "top" : "bottom",
    align: rect.left + POPOVER_WIDTH > window.innerWidth - 8 ? "end" : "start",
  };
}

interface MenuProps {
  id: string;
  label: string;
  open: boolean;
  still: boolean;
  children: React.ReactElement[];
}

/** Floating menu that grows from the corner touching the trigger. */
function PopoverMenu({
  id,
  label,
  open,
  still,
  position,
  children,
}: MenuProps & { position: MenuPosition }) {
  const below = position.side === "bottom";
  const start = position.align === "start";
  const offset = below ? -4 : 4;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          aria-label={label}
          aria-orientation="vertical"
          className={cn(
            "absolute z-50 w-48 rounded-lg border border-zinc-200 bg-white p-1 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)]",
            below ? "top-full mt-1.5" : "bottom-full mb-1.5",
            start ? "left-0" : "right-0",
            // Bridges the gap so hover survives the trip to the menu.
            "before:absolute before:inset-x-0 before:h-2",
            below ? "before:bottom-full" : "before:top-full"
          )}
          exit={{
            opacity: 0,
            scale: still ? 1 : 0.97,
            y: still ? 0 : offset / 2,
            transition: { duration: 0.12, ease: EASE_OUT },
          }}
          id={id}
          initial={{
            opacity: 0,
            scale: still ? 1 : 0.96,
            y: still ? 0 : offset,
          }}
          role="menu"
          style={{
            transformOrigin: `${below ? "top" : "bottom"} ${start ? "left" : "right"}`,
          }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {children.map((child, i) => (
            <motion.div
              animate={{ opacity: 1 }}
              initial={{ opacity: 0 }}
              key={child.key}
              role="none"
              transition={{
                duration: 0.16,
                delay: still ? 0 : i * STAGGER_S,
                ease: EASE_OUT,
              }}
            >
              {child}
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The row that takes the trigger's place, items staggering in left to right. */
function InlineRow({ id, label, open, still, children }: MenuProps) {
  const fade = { duration: open ? 0.16 : 0.12, ease: EASE_OUT };
  const delay = (i: number) => (open && !still ? 0.04 + i * STAGGER_S : 0);
  return (
    <div
      aria-label={label}
      aria-orientation="horizontal"
      className="grid gap-0.5 p-1 [grid-area:1/1]"
      id={id}
      inert={!open}
      role="menu"
      style={{
        gridTemplateColumns: `repeat(${children.length}, minmax(0, 1fr))`,
      }}
    >
      {children.map((child, i) => (
        <motion.div
          animate={{ ...(open ? SHOWN : HIDDEN), x: open ? 0 : -4 }}
          className="grid"
          initial={false}
          key={child.key}
          role="none"
          transition={{
            ...fade,
            delay: delay(i),
            x: {
              ...fade,
              delay: delay(i),
              duration: still ? 0 : fade.duration,
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

export default function SocialButton({
  label = "Share",
  icon: TriggerIcon = Link,
  items = DEFAULT_SHARE_ITEMS,
  shareData,
  placement = "inline",
  nativeShare = true,
  onShare,
  className,
  onClick,
  onKeyDown,
  ...props
}: SocialButtonProps) {
  const [hovered, setHovered] = useState(false);
  // Opened by click or keyboard; stays until dismissed.
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const [focusIndex, setFocusIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [position, setPosition] = useState<MenuPosition>({
    side: "bottom",
    align: "start",
  });
  // location.href only exists in the browser, so links pick it up after mount.
  const [pageUrl, setPageUrl] = useState("");
  const reduceMotion = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hoverTimer = useTimer();
  const copiedTimer = useTimer();
  const menuId = useId();
  const isPopover = placement === "popover";

  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  const data: ResolvedShareData = {
    title: shareData?.title ?? "",
    text: shareData?.text ?? "",
    url: shareData?.url ?? pageUrl,
  };

  const close = useCallback(() => {
    hoverTimer.clear();
    setPinned(false);
    setHovered(false);
  }, [hoverTimer.clear]);

  // Close when focus or a press lands outside the component.
  useEffect(() => {
    if (!open) {
      return;
    }
    const root = rootRef.current;
    const onFocusOut = (e: FocusEvent) => {
      if (!root?.contains(e.relatedTarget as Node | null)) {
        setPinned(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!root?.contains(e.target as Node)) {
        close();
      }
    };
    root?.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      root?.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  const measure = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect && isPopover) {
      setPosition(placeMenu(rect, items.length));
    }
  };

  const focusItem = (index: number) => {
    const nodes =
      rootRef.current?.querySelectorAll<HTMLElement>("[data-share-item]");
    if (!nodes?.length) {
      return;
    }
    const next = (index + nodes.length) % nodes.length;
    setFocusIndex(next);
    nodes[next].focus();
  };

  const openMenu = (focusAt: number) => {
    hoverTimer.clear();
    // Commit first so the items exist and are no longer inert.
    flushSync(() => {
      measure();
      setPinned(true);
    });
    focusItem(focusAt);
  };

  const handleTriggerClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) {
      return;
    }
    if (pinned) {
      close();
      return;
    }
    if (await tryNativeShare(nativeShare, data)) {
      return;
    }
    openMenu(0);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) {
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(e.key === "ArrowUp" ? items.length - 1 : 0);
    } else if (e.key === "Escape" && open) {
      close();
    }
  };

  const handleCopy = async (index: number) => {
    try {
      await navigator.clipboard.writeText(data.url || window.location.href);
    } catch {
      return;
    }
    setCopiedIndex(index);
    copiedTimer.set(() => setCopiedIndex(null), COPIED_MS);
  };

  const handleItem = (index: number) => {
    const item = items[index];
    item.onClick?.(data);
    onShare?.(index, item);
    if (item.action === "copy") {
      handleCopy(index);
      return;
    }
    // The link opens elsewhere; put focus back where it started.
    close();
    triggerRef.current?.focus();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    const move = ITEM_KEYS[e.key];
    if (move) {
      e.preventDefault();
      focusItem(move(index, items.length - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  };

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (canHover(e)) {
      hoverTimer.set(() => {
        measure();
        setHovered(true);
      }, HOVER_OPEN_MS);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (canHover(e)) {
      hoverTimer.set(() => setHovered(false), HOVER_CLOSE_MS);
    }
  };

  const renderItem = (item: ShareItem, i: number) => (
    <ShareItemNode
      copied={copiedIndex === i}
      data={data}
      inline={!isPopover}
      instant={reduceMotion}
      item={item}
      key={`share-${item.label}`}
      onActivate={() => handleItem(i)}
      onFocus={() => setFocusIndex(i)}
      onKeyDown={(e) => handleItemKeyDown(e, i)}
      tabbable={focusIndex === i}
    />
  );

  const triggerShared = {
    ...props,
    "aria-controls": open ? menuId : undefined,
    "aria-expanded": open,
    "aria-haspopup": "menu",
    onClick: handleTriggerClick,
    onKeyDown: handleTriggerKeyDown,
    ref: triggerRef,
  } as const;

  const triggerContent = (
    <span className="flex items-center gap-2">
      <TriggerIcon className="size-4" />
      {label}
    </span>
  );

  const announcement = (
    <span aria-live="polite" className="sr-only">
      {copiedIndex === null ? "" : "Link copied to clipboard"}
    </span>
  );

  const rootHandlers = {
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
    ref: rootRef,
  };

  if (isPopover) {
    return (
      <div className={cn("relative inline-flex", className)} {...rootHandlers}>
        <Button
          className="bg-white text-zinc-900 aria-expanded:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-50 dark:aria-expanded:bg-zinc-900"
          variant="outline"
          {...triggerShared}
        >
          {triggerContent}
        </Button>
        <PopoverMenu
          id={menuId}
          label={label}
          open={open}
          position={position}
          still={reduceMotion}
        >
          {items.map(renderItem)}
        </PopoverMenu>
        {announcement}
      </div>
    );
  }

  // `initial={false}` renders the closed state into the server HTML.
  return (
    <div
      className={cn(
        "relative inline-grid h-10 rounded-md border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
        className
      )}
      style={{ minWidth: `calc(${items.length} * 2.25rem + 0.5rem + 2px)` }}
      {...rootHandlers}
    >
      <motion.div
        animate={open ? HIDDEN : SHOWN}
        className={cn("[grid-area:1/1]", open && "pointer-events-none")}
        initial={false}
        transition={{ duration: open ? 0.12 : 0.16, ease: EASE_OUT }}
      >
        <Button
          className="h-full w-full rounded-[5px] px-4 text-inherit dark:hover:bg-zinc-900"
          variant="ghost"
          {...triggerShared}
          // Covered by the open row, so keep it out of the tab order.
          tabIndex={open ? -1 : props.tabIndex}
        >
          {triggerContent}
        </Button>
      </motion.div>
      <InlineRow id={menuId} label={label} open={open} still={reduceMotion}>
        {items.map(renderItem)}
      </InlineRow>
      {announcement}
    </div>
  );
}
