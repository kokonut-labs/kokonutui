"use client";

import { Check, Copy } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { copyComponent } from "@/lib/action";
import { cn } from "@/lib/utils";

export const PACKAGE_MANAGERS = ["npm", "pnpm", "bun", "yarn"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const RUNNERS: Record<PackageManager, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  bun: "bunx --bun",
  yarn: "yarn dlx",
};

const DEFAULT_PACKAGE_MANAGER: PackageManager = "bun";
const STORAGE_KEY = "kokonutui:package-manager";
const CHANGE_EVENT = "kokonutui:package-manager-change";

/** Everything a toolbar variant needs to render, resolved on the server. */
export interface ToolbarProps {
  /** `@kokonutui/<name>` */
  target: string;
  /** Component slug, as used by the registry and v0. */
  name: string;
  /** Docs `link` prop, used to read the source file for "Copy code". */
  link: string;
  isBlock: boolean;
  /** Free-form badges from the MDX (e.g. "Motion"). */
  badges: string[];
  /** npm dependencies from the registry entry. */
  dependencies: string[];
  /** shadcn/ui primitives the component pulls in. */
  registryDependencies: string[];
  fileCount: number;
  /** "Open in v0" link, built on the server where the site URL is known. */
  v0Href: string;
}

/*
  The chosen package manager is shared by every install row on the page and
  remembered across visits, so picking "pnpm" once sticks everywhere.
*/
function readPackageManager(): PackageManager {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (PACKAGE_MANAGERS.includes(stored as PackageManager)) {
      return stored as PackageManager;
    }
  } catch {
    // Storage can be blocked (private mode); fall back to the default.
  }
  return DEFAULT_PACKAGE_MANAGER;
}

export function setPackageManager(value: PackageManager) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Still update this page even when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function usePackageManager() {
  return useSyncExternalStore(
    subscribe,
    readPackageManager,
    () => DEFAULT_PACKAGE_MANAGER
  );
}

export function useInstallCommand(target: string) {
  const packageManager = usePackageManager();
  const runner = RUNNERS[packageManager];
  return {
    packageManager,
    runner,
    command: `${runner} shadcn@latest add ${target}`,
  };
}

/** Copies text and reports `copied` for a short moment. */
export function useCopy(duration = 1500) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timeout.current), []);

  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), duration);
    },
    [duration]
  );

  return { copied, copy };
}

/** Reads the component source through the server action, then copies it. */
export function useCopySource(link: string) {
  const { copied, copy } = useCopy(2000);
  const [pending, setPending] = useState(false);

  const copySource = useCallback(async () => {
    const [folder, fileName] = link.split("/");
    const formData = new FormData();
    formData.append("folder", folder);
    formData.append("fileName", fileName);
    setPending(true);
    try {
      const state = await copyComponent(
        { error: "", content: "", success: false },
        formData
      );
      if (state.success && state.content) {
        copy(state.content);
      }
    } finally {
      setPending(false);
    }
  }, [link, copy]);

  return { copied, pending, copySource };
}

/**
 * Two stacked labels that crossfade with a light blur, so rapid clicks
 * retarget the transition instead of restarting it.
 */
export function SwapLabel({
  active,
  idle,
  done,
  className,
}: {
  active: boolean;
  idle: React.ReactNode;
  done: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-grid", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "col-start-1 row-start-1 flex items-center gap-1.5 transition-[opacity,filter] duration-150 ease-out",
          active ? "opacity-0 blur-[2px]" : "opacity-100"
        )}
      >
        {idle}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "col-start-1 row-start-1 flex items-center gap-1.5 transition-[opacity,filter] duration-150 ease-out",
          active ? "opacity-100" : "opacity-0 blur-[2px]"
        )}
      >
        {done}
      </span>
    </span>
  );
}

export const CopyGlyph = () => <Copy className="size-3.5 shrink-0" />;
export const CheckGlyph = () => <Check className="size-3.5 shrink-0" />;

export function V0Mark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-3.5 w-auto", className)}
      fill="currentColor"
      viewBox="0 0 40 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M23.3919 0H32.9188C36.7819 0 39.9136 3.13165 39.9136 6.99475V16.0805H36.0006V6.99475C36.0006 6.90167 35.9969 6.80925 35.9898 6.71766L26.4628 16.079C26.4949 16.08 26.5272 16.0805 26.5595 16.0805H36.0006V19.7762H26.5595C22.6964 19.7762 19.4788 16.6139 19.4788 12.7508V3.68923H23.3919V12.7508C23.3919 12.9253 23.4054 13.0977 23.4316 13.2668L33.1682 3.6995C33.0861 3.6927 33.003 3.68923 32.9188 3.68923H23.3919V0Z" />
      <path d="M13.7688 19.0956L0 3.68759H5.53933L13.6231 12.7337V3.68759H17.7535V17.5746C17.7535 19.6705 15.1654 20.6584 13.7688 19.0956Z" />
    </svg>
  );
}

/**
 * The install command as text. When space runs out the runner prefix
 * truncates first, so the component name always stays readable. On phones it
 * wraps instead.
 */
export function CommandText({
  runner,
  target,
  className,
  tones = {
    runner: "text-zinc-400 dark:text-zinc-500",
    verb: "text-zinc-600 dark:text-zinc-400",
    target: "text-zinc-950 dark:text-white",
  },
}: {
  runner: string;
  target: string;
  className?: string;
  tones?: { runner: string; verb: string; target: string };
}) {
  return (
    <code
      className={cn(
        "min-w-0 flex-1 font-mono text-[13px] leading-5 max-md:whitespace-pre-wrap max-md:break-words md:flex md:whitespace-pre",
        className
      )}
    >
      <span className="md:min-w-0 md:truncate">
        <span className={tones.runner}>{runner} </span>
        <span className={tones.verb}>shadcn@latest add</span>
        {/* A trailing space inside a truncating span collapses, so on desktop
            the gap comes from the margin on the target instead. */}
        <span className="md:hidden"> </span>
      </span>
      <span className={cn("md:ml-[1ch] md:shrink-0", tones.target)}>
        {target}
      </span>
    </code>
  );
}
