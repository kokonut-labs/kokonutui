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
        "not-prose w-full min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-zinc-200 border-b pr-1.5 pl-3 dark:border-zinc-800">
        <div
          aria-label="Package manager"
          className="-mb-px flex items-center gap-3"
          role="tablist"
        >
          {PACKAGE_MANAGERS.map((item) => {
            const isSelected = item === packageManager;
            return (
              <button
                aria-selected={isSelected}
                className={cn(
                  "h-9 rounded-sm border-b font-medium text-xs transition-colors duration-150 ease-out",
                  isSelected
                    ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200"
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
          aria-label={isCopied ? "Copied" : "Copy install command"}
          className="relative flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-[color,background-color,transform] duration-150 ease-out hover:bg-zinc-200/60 hover:text-zinc-900 active:scale-[0.94] dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={handleCopy}
          title="Copy install command"
          type="button"
        >
          <Copy
            aria-hidden="true"
            className={cn(
              "absolute size-3.5 transition-[opacity,filter,transform] duration-150 ease-out",
              isCopied ? "scale-75 opacity-0 blur-[2px]" : "opacity-100"
            )}
          />
          <Check
            aria-hidden="true"
            className={cn(
              "absolute size-3.5 text-emerald-600 transition-[opacity,filter,transform] duration-150 ease-out dark:text-emerald-400",
              isCopied ? "opacity-100" : "scale-75 opacity-0 blur-[2px]"
            )}
          />
        </button>
      </div>
      {/* The full command wraps on phones and scrolls on desktop; never cut. */}
      <div className="overflow-x-auto px-3 py-2.5 [scrollbar-width:thin]">
        <code className="whitespace-pre-wrap break-words font-mono text-[13px] leading-5 md:whitespace-nowrap">
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
      </div>
    </div>
  );
}
