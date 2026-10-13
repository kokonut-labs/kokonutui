"use client";

import { cn } from "@/lib/utils";
import {
  CheckGlyph,
  CommandText,
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
 * "Ink": a solid ink bar seated on top of the preview, like a terminal lid.
 * High contrast in both themes; the command reads like a prompt.
 */
export function InkToolbar(props: ToolbarProps) {
  const { packageManager, runner, command } = useInstallCommand(props.target);
  const install = useCopy();
  const source = useCopySource(props.link);

  return (
    <div className="bg-zinc-950 text-zinc-100 dark:bg-zinc-900 dark:shadow-[inset_0_-1px_0_rgb(255_255_255/0.06)]">
      <div className="flex items-center justify-between gap-3 border-white/[0.08] border-b px-4">
        <div
          aria-label="Package manager"
          className="flex items-center gap-4"
          role="tablist"
        >
          {PACKAGE_MANAGERS.map((item) => (
            <button
              aria-selected={item === packageManager}
              className={cn(
                "-mb-px h-10 border-b text-[12px] transition-colors duration-150 ease-out",
                item === packageManager
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
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
        <div className="flex items-center gap-1">
          <a
            aria-label="Open in v0"
            className="flex h-7 items-center rounded-md px-2 text-zinc-400 transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-white"
            href={props.v0Href}
            rel="noreferrer"
            target="_blank"
            title="Open in v0"
          >
            <V0Mark className="h-4" />
          </a>
          {props.isBlock ? null : (
            <button
              aria-label={source.copied ? "Copied" : "Copy component source"}
              className="flex h-7 items-center rounded-md bg-white px-2.5 font-medium text-[12px] text-zinc-950 transition-colors duration-150 ease-out hover:bg-zinc-200 disabled:opacity-60"
              disabled={source.pending}
              onClick={source.copySource}
              type="button"
            >
              <SwapLabel
                active={source.copied}
                done={
                  <>
                    <CheckGlyph />
                    Copied
                  </>
                }
                idle="Copy code"
              />
            </button>
          )}
        </div>
      </div>
      <button
        aria-label={install.copied ? "Copied" : `Copy ${command}`}
        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 ease-out hover:bg-white/[0.03]"
        onClick={() => install.copy(command)}
        type="button"
      >
        <span
          aria-hidden="true"
          className="select-none font-mono text-[13px] text-emerald-400"
        >
          ❯
        </span>
        <CommandText
          runner={runner}
          target={props.target}
          tones={{
            runner: "text-zinc-500",
            verb: "text-zinc-300",
            target: "text-white",
          }}
        />
        <SwapLabel
          active={install.copied}
          className="shrink-0 text-[12px] text-zinc-500 group-hover:text-zinc-300"
          done={<span className="text-emerald-400">Copied</span>}
          idle="Click to copy"
        />
      </button>
    </div>
  );
}
