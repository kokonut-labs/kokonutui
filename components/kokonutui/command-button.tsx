"use client";

/**
 * @author: @dorianbaffier
 * @description: Command Button
 * @version: 2.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * A button with its keyboard shortcut drawn as physical keycaps. The shortcut
 * works for real: pressing the keys anywhere on the page sinks each cap as
 * its key goes down and clicks the button when the combination matches.
 */

import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Modifier = "mod" | "ctrl" | "alt" | "shift";

interface ParsedShortcut {
  modifiers: Modifier[];
  key: string;
}

interface CommandButtonProps extends ComponentProps<"button"> {
  children?: ReactNode;
  /**
   * The shortcut, as `+`-joined parts: `mod` (⌘ on Mac, Ctrl elsewhere),
   * `ctrl`, `alt`, `shift` and one key, e.g. `"mod+k"`, `"shift+n"`, `"c"`.
   */
  shortcut?: string;
  /**
   * Listen for the shortcut on the whole page. Shortcuts without `mod`,
   * `ctrl` or `alt` are ignored while typing in a field.
   */
  global?: boolean;
}

const APPLE_PLATFORM = /mac|iphone|ipad|ipod/i;
const MODIFIERS = new Set<Modifier>(["mod", "ctrl", "alt", "shift"]);

const parseShortcut = (shortcut: string): ParsedShortcut => {
  const parts = shortcut
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = parts.filter((part): part is Modifier =>
    MODIFIERS.has(part as Modifier)
  );
  const key = parts.find((part) => !MODIFIERS.has(part as Modifier)) ?? "k";
  return { modifiers, key };
};

const MAC_LABELS: Record<Modifier, string> = {
  mod: "⌘",
  ctrl: "⌃",
  alt: "⌥",
  shift: "⇧",
};
const PC_LABELS: Record<Modifier, string> = {
  mod: "Ctrl",
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
};
const SPOKEN: Record<Modifier, [mac: string, pc: string]> = {
  mod: ["Command", "Control"],
  ctrl: ["Control", "Control"],
  alt: ["Option", "Alt"],
  shift: ["Shift", "Shift"],
};

const keyLabel = (key: string) => {
  if (key === "enter") {
    return "↵";
  }
  if (key === "space") {
    return "Space";
  }
  return key.length === 1 ? key.toUpperCase() : key;
};

// Matches by physical key too, since Option on a Mac changes `event.key`
// (Option+K types "˚").
const isKey = (event: KeyboardEvent, key: string) => {
  const pressed = event.key.toLowerCase();
  if (key === "space") {
    return event.code === "Space";
  }
  return (
    pressed === key ||
    event.code === `Key${key.toUpperCase()}` ||
    event.code === `Digit${key}`
  );
};

const isModifierDown = (
  modifier: Modifier,
  event: KeyboardEvent,
  isMac: boolean
) => {
  switch (modifier) {
    case "mod":
      return isMac ? event.metaKey : event.ctrlKey;
    case "ctrl":
      return event.ctrlKey;
    case "alt":
      return event.altKey;
    case "shift":
      return event.shiftKey;
    default:
      return false;
  }
};

const matches = (
  event: KeyboardEvent,
  { modifiers, key }: ParsedShortcut,
  isMac: boolean
) => {
  if (!isKey(event, key)) {
    return false;
  }
  const wanted = {
    meta: modifiers.includes("mod") && isMac,
    ctrl: modifiers.includes("ctrl") || (modifiers.includes("mod") && !isMac),
    alt: modifiers.includes("alt"),
    shift: modifiers.includes("shift"),
  };
  return (
    event.metaKey === wanted.meta &&
    event.ctrlKey === wanted.ctrl &&
    event.altKey === wanted.alt &&
    event.shiftKey === wanted.shift
  );
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT");

function Keycap({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-medium font-sans text-[11px] leading-none",
        "border border-zinc-200 bg-white text-zinc-600",
        "dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300",
        // The cap stands 2px above its base. Pressing sinks it onto the base:
        // a translate and a shorter shadow, never a scale.
        "shadow-[0_2px_0_0_var(--color-zinc-200)] dark:shadow-[0_2px_0_0_var(--color-zinc-950)]",
        "transition-[translate,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "group-active/command:translate-y-0.5 group-active/command:shadow-none group-active/command:duration-75",
        pressed && "translate-y-0.5 shadow-none duration-75"
      )}
      data-pressed={pressed || undefined}
    >
      {label}
    </kbd>
  );
}

export default function CommandButton({
  className,
  children = "Search",
  shortcut = "mod+k",
  global = true,
  ...props
}: CommandButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isMac, setIsMac] = useState(true);
  const [held, setHeld] = useState<{ modifiers: Modifier[]; key: boolean }>({
    modifiers: [],
    key: false,
  });
  const parsed = parseShortcut(shortcut);
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  // The platform is unknown on the server, so the first render shows Mac
  // labels and switches after mount.
  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ?? navigator.platform;
    setIsMac(APPLE_PLATFORM.test(platform));
  }, []);

  useEffect(() => {
    if (!global) {
      return;
    }
    const sync = (event: KeyboardEvent, isDown: boolean) => {
      const { modifiers, key } = parsedRef.current;
      setHeld({
        modifiers: modifiers.filter((m) => isModifierDown(m, event, isMac)),
        key: isDown && isKey(event, key),
      });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = parsedRef.current;
      const needsModifier = current.modifiers.some((m) => m !== "shift");
      if (!needsModifier && isTyping(event.target)) {
        return;
      }
      sync(event, true);
      if (
        !event.repeat &&
        matches(event, current, isMac) &&
        !buttonRef.current?.disabled
      ) {
        event.preventDefault();
        buttonRef.current?.click();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => sync(event, false);
    const release = () => setHeld({ modifiers: [], key: false });

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", release);
    };
  }, [global, isMac]);

  const labels = isMac ? MAC_LABELS : PC_LABELS;
  const spoken = [
    ...parsed.modifiers.map((m) => SPOKEN[m][isMac ? 0 : 1]),
    keyLabel(parsed.key),
  ].join("+");

  return (
    <button
      aria-keyshortcuts={spoken}
      className={cn(
        "group/command inline-flex h-10 cursor-pointer items-center gap-3 rounded-xl py-1 pr-2 pl-3.5 font-medium text-sm",
        "border border-zinc-200 bg-white text-zinc-700",
        "dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200",
        "transition-[background-color,border-color] duration-150 ease-out",
        "hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-white/15 dark:hover:bg-zinc-800/70",
        "active:bg-zinc-100 dark:active:bg-zinc-800",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      ref={buttonRef}
      type="button"
      {...props}
    >
      {children}
      <span aria-hidden="true" className="flex items-center gap-1 pb-0.5">
        {parsed.modifiers.map((modifier) => (
          <Keycap
            key={modifier}
            label={labels[modifier]}
            pressed={held.modifiers.includes(modifier)}
          />
        ))}
        <Keycap label={keyLabel(parsed.key)} pressed={held.key} />
      </span>
    </button>
  );
}
