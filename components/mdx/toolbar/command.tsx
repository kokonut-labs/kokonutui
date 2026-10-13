"use client";

import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CheckGlyph,
  CommandText,
  CopyGlyph,
  PACKAGE_MANAGERS,
  SwapLabel,
  setPackageManager,
  type ToolbarProps,
  useCopy,
  useCopySource,
  useInstallCommand,
  V0Mark,
} from "./shared";

/**
 * "Command": one quiet line. The install command is the hero; the package
 * manager and actions sit beside it as text, separated by hairlines.
 */
export function CommandToolbar(props: ToolbarProps) {
  const { packageManager, runner, command } = useInstallCommand(props.target);
  const install = useCopy();
  const source = useCopySource(props.link);

  return (
    <div className="flex flex-wrap items-stretch border-zinc-200 border-b md:h-12 md:flex-nowrap dark:border-zinc-800">
      <div
        aria-label="Package manager"
        className="flex items-center gap-3.5 px-4 max-md:h-11"
        role="tablist"
      >
        {PACKAGE_MANAGERS.map((item) => (
          <button
            aria-selected={item === packageManager}
            className={cn(
              "font-medium text-[13px] transition-colors duration-150 ease-out",
              item === packageManager
                ? "text-zinc-950 dark:text-white"
                : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
            )}
            key={item}
            onClick={() => setPackageManager(item)}
            role="tab"
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      <button
        aria-label={install.copied ? "Copied" : `Copy ${command}`}
        className="group flex min-w-0 flex-1 items-center gap-4 border-zinc-200 px-4 text-left transition-colors duration-150 ease-out hover:bg-zinc-50 max-md:order-last max-md:basis-full max-md:border-t max-md:py-3 md:border-x dark:border-zinc-800 dark:hover:bg-white/[0.03]"
        onClick={() => install.copy(command)}
        type="button"
      >
        <CommandText runner={runner} target={props.target} />
        <SwapLabel
          active={install.copied}
          className="shrink-0 text-xs text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300"
          done={
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckGlyph />
              <span className="md:hidden">Copied</span>
            </span>
          }
          idle={
            <>
              <CopyGlyph />
              <span className="md:hidden">Copy</span>
            </>
          }
        />
      </button>

      <div className="ml-auto flex items-center gap-1 px-2 max-md:h-11">
        <a
          aria-label="Open in v0"
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-zinc-500 transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
          href={props.v0Href}
          rel="noreferrer"
          target="_blank"
        >
          Open in <V0Mark />
        </a>
        {props.isBlock ? null : (
          <button
            aria-label={source.copied ? "Copied" : "Copy component source"}
            className="flex h-8 items-center rounded-md px-2.5 font-medium text-[13px] text-zinc-950 transition-colors duration-150 ease-out hover:bg-zinc-100 disabled:opacity-60 dark:text-white dark:hover:bg-white/[0.06]"
            disabled={source.pending}
            onClick={source.copySource}
            type="button"
          >
            <SwapLabel
              active={source.copied}
              done={
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckGlyph />
                  Copied
                </span>
              }
              idle={
                <>
                  <Code2 className="size-3.5" />
                  Copy code
                </>
              }
            />
          </button>
        )}
      </div>
    </div>
  );
}
