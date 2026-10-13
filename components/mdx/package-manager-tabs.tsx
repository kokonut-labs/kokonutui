"use client";

import { Check, Copy } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/lib/utils";

const PACKAGE_MANAGERS = ["npm", "pnpm", "bun", "yarn"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const RUNNERS: Record<PackageManager, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  bun: "bunx --bun",
  yarn: "yarn dlx",
};

const DEFAULT_PACKAGE_MANAGER: PackageManager = "bun";
const STORAGE_KEY = "kokonutui:package-manager";
const CHANGE_EVENT = "kokonutui:package-manager-change";

/*
  The chosen package manager is shared by every install block on the page and
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

function writePackageManager(value: PackageManager) {
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

function usePackageManager() {
  return useSyncExternalStore(
    subscribe,
    readPackageManager,
    () => DEFAULT_PACKAGE_MANAGER
  );
}

interface InstallCommandProps {
  componentName: string;
  prePath: string;
  className?: string;
}

/**
 * Package-manager switch plus the install command. The whole command row is
 * one button: clicking anywhere on it copies the command.
 */
export function InstallCommand({
  componentName,
  prePath,
  className,
}: InstallCommandProps) {
  const packageManager = usePackageManager();
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const runner = RUNNERS[packageManager];
  const target = `${prePath}/${componentName}`;
  const command = `${runner} shadcn@latest add ${target}`;

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(command);
    setIsCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsCopied(false), 1500);
  }, [command]);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center",
        className
      )}
    >
      <div
        aria-label="Package manager"
        className="flex shrink-0 items-center self-start rounded-lg bg-zinc-200/60 p-0.5 sm:self-auto dark:bg-zinc-800/60"
        role="tablist"
      >
        {PACKAGE_MANAGERS.map((item) => {
          const isSelected = item === packageManager;
          return (
            <button
              aria-selected={isSelected}
              className={cn(
                "h-7 rounded-md px-2.5 font-medium text-xs transition-[color,background-color,box-shadow] duration-150 ease-out",
                isSelected
                  ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-zinc-950 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
              key={item}
              onClick={() => writePackageManager(item)}
              role="tab"
              type="button"
            >
              {item}
            </button>
          );
        })}
      </div>

      <button
        aria-label={isCopied ? "Copied" : `Copy install command: ${command}`}
        className="group flex min-h-8 min-w-0 flex-1 items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-left transition-[border-color,background-color] duration-150 ease-out hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:active:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60"
        onClick={handleCopy}
        title="Click to copy"
        type="button"
      >
        {/* Wraps on phones; one line from `sm` up, with the full command in the label. */}
        <code className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-5 sm:truncate sm:whitespace-nowrap">
          <span className="select-none text-zinc-400 dark:text-zinc-600">
            ${" "}
          </span>
          <span className="text-zinc-500">{runner} </span>
          <span className="text-zinc-700 dark:text-zinc-300">
            shadcn@latest add{" "}
          </span>
          <span className="font-medium text-zinc-950 dark:text-white">
            {target}
          </span>
        </code>
        <span className="relative flex h-5 shrink-0 items-center justify-end gap-1.5 text-xs text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200">
          <span
            aria-hidden="true"
            className={cn(
              "flex items-center gap-1.5 transition-[opacity,filter] duration-150 ease-out",
              isCopied ? "opacity-0 blur-[2px]" : "opacity-100"
            )}
          >
            <Copy className="size-3.5" />
            <span className="hidden sm:inline">Copy</span>
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-0 flex items-center gap-1.5 text-emerald-600 transition-[opacity,filter] duration-150 ease-out dark:text-emerald-400",
              isCopied ? "opacity-100" : "opacity-0 blur-[2px]"
            )}
          >
            <Check className="size-3.5" />
            <span className="hidden sm:inline">Copied</span>
          </span>
        </span>
      </button>
    </div>
  );
}
