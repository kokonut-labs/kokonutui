"use client";

import { ArrowUpRight } from "lucide-react";
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] text-zinc-500 dark:text-zinc-500">
      {children}
    </span>
  );
}

/**
 * "Spec": a spec-sheet header. Install, what it requires and what you get,
 * in three columns of real registry data.
 */
export function SpecToolbar(props: ToolbarProps) {
  const { packageManager, runner, command } = useInstallCommand(props.target);
  const install = useCopy();
  const source = useCopySource(props.link);
  const requires = [
    ...props.dependencies,
    ...props.registryDependencies.map((dep) => `ui/${dep}`),
  ];

  return (
    <div className="grid border-zinc-200 border-b md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_auto] dark:border-zinc-800">
      <div className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <Label>Install</Label>
          <div
            aria-label="Package manager"
            className="flex items-center gap-3"
            role="tablist"
          >
            {PACKAGE_MANAGERS.map((item) => (
              <button
                aria-selected={item === packageManager}
                className={cn(
                  "text-[12px] transition-colors duration-150 ease-out",
                  item === packageManager
                    ? "text-zinc-950 underline decoration-zinc-300 underline-offset-4 dark:text-white dark:decoration-zinc-600"
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
        </div>
        <button
          aria-label={install.copied ? "Copied" : `Copy ${command}`}
          className="group -mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-zinc-100 dark:hover:bg-white/[0.04]"
          onClick={() => install.copy(command)}
          type="button"
        >
          <CommandText runner={runner} target={props.target} />
          <SwapLabel
            active={install.copied}
            className="shrink-0 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
            done={
              <span className="text-emerald-600 dark:text-emerald-400">
                <CheckGlyph />
              </span>
            }
            idle={<CopyGlyph />}
          />
        </button>
      </div>

      <div className="flex min-w-0 flex-col gap-2 border-zinc-200 p-4 max-md:border-t md:border-l dark:border-zinc-800">
        <Label>Requires</Label>
        {requires.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {requires.map((dep) => (
              <li
                className="rounded-md border border-zinc-200 px-1.5 py-0.5 font-mono text-[12px] text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                key={dep}
              >
                {dep}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[13px] text-zinc-700 dark:text-zinc-300">
            Nothing extra
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 border-zinc-200 p-4 max-md:border-t md:min-w-36 md:border-l dark:border-zinc-800">
        <Label>
          {props.fileCount} {props.fileCount === 1 ? "file" : "files"}
        </Label>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:flex-col md:items-start">
          {props.isBlock ? null : (
            <button
              aria-label={source.copied ? "Copied" : "Copy component source"}
              className="font-medium text-[13px] text-zinc-950 underline decoration-zinc-300 underline-offset-4 transition-colors duration-150 ease-out hover:decoration-zinc-950 disabled:opacity-60 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
              disabled={source.pending}
              onClick={source.copySource}
              type="button"
            >
              <SwapLabel
                active={source.copied}
                done={
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Copied to clipboard
                  </span>
                }
                idle="Copy source"
              />
            </button>
          )}
          <a
            className="flex items-center gap-1 text-[13px] text-zinc-500 transition-colors duration-150 ease-out hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            href={props.v0Href}
            rel="noreferrer"
            target="_blank"
          >
            Open in <V0Mark />
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
