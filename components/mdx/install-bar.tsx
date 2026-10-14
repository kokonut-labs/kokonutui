"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CopyIconSwap, useCopy } from "@/components/landing/home/client";
import {
  CELL,
  EASE_COLORS,
  FOCUS_INSET,
  GRID,
  INK,
  LEAF,
  LINE,
  MONO,
} from "@/components/landing/home/styles";
import { usePackageManager } from "@/components/mdx/docs-prefs";
import { copyComponent } from "@/lib/action";
import { PACKAGE_MANAGERS, runWith } from "@/lib/agents";
import { cn } from "@/lib/utils";

const COPIED_MS = 1600;

// v0 fetches the registry entry, so the link always points at the live site.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `https://${process.env.NEXT_PUBLIC_SITE_URL}`;

const TAB =
  "inline-flex h-8 items-center gap-1.5 px-3 text-[12px] text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white";

/**
 * The install row above every demo: pick a package manager, then click the
 * command anywhere to copy it. v0 and the raw source sit beside the picker.
 */
export function InstallBar({
  name,
  prePath,
  showSource = true,
}: {
  name: string;
  prePath: string;
  showSource?: boolean;
}) {
  const [manager, setManager] = usePackageManager();
  const { copied, copy } = useCopy();
  const command = runWith(manager, `shadcn@latest add ${prePath}/${name}`);

  return (
    <div className={cn("grid grid-cols-1 border-b", GRID, LINE)}>
      <div className={cn("flex flex-wrap items-stretch justify-between", CELL)}>
        <fieldset className="m-0 flex min-w-0 border-0 p-0">
          <legend className="sr-only">Package manager</legend>
          {PACKAGE_MANAGERS.map((m) => {
            const selected = m.id === manager;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  TAB,
                  MONO,
                  "border-r",
                  LINE,
                  selected &&
                    "bg-[#f4f4f4] text-black dark:bg-[#161616] dark:text-white",
                  EASE_COLORS,
                  FOCUS_INSET
                )}
                key={m.id}
                onClick={() => setManager(m.id)}
                type="button"
              >
                {m.id}
              </button>
            );
          })}
        </fieldset>
        <div className="flex items-stretch">
          <a
            className={cn(
              TAB,
              MONO,
              "border-l",
              LINE,
              EASE_COLORS,
              FOCUS_INSET
            )}
            href={`https://v0.dev/chat/api/open?url=${SITE_URL}/r/${name}.json`}
            rel="noreferrer"
            target="_blank"
          >
            Open in v0
            <ArrowUpRightIcon aria-hidden className="size-3" />
          </a>
          {showSource ? <CopySource name={name} /> : null}
        </div>
      </div>
      <button
        aria-label={copied ? "Copied" : `Copy the install command: ${command}`}
        className={cn(
          "group flex w-full min-w-0 items-start gap-2.5 px-3 py-3 text-left text-[13px] leading-[1.6] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
          MONO,
          INK,
          CELL,
          EASE_COLORS,
          FOCUS_INSET
        )}
        onClick={() => copy(command)}
        type="button"
      >
        <span aria-hidden className={LEAF}>
          $
        </span>
        <span className="wrap-anywhere min-w-0 flex-1">{command}</span>
        <CopyIconSwap
          className="mt-[3px] text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
          copied={copied}
        />
      </button>
    </div>
  );
}

/** Copies the component's source file, read on the server. */
function CopySource({ name }: { name: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    []
  );

  const settle = useCallback((next: "copied" | "failed") => {
    setState(next);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => setState("idle"), COPIED_MS);
  }, []);

  const copySource = () => {
    const formData = new FormData();
    formData.append("folder", name);
    const source = copyComponent(
      { error: "", content: "", success: false },
      formData
    ).then((result) => {
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.content;
    });

    // Safari only allows clipboard writes inside the click, so hand it a
    // pending item rather than waiting for the server first.
    const write =
      typeof ClipboardItem === "undefined"
        ? source.then((text) => navigator.clipboard.writeText(text))
        : navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": source.then(
                (text) => new Blob([text], { type: "text/plain" })
              ),
            }),
          ]);

    write.then(
      () => settle("copied"),
      () => settle("failed")
    );
  };

  let label = "Copy code";
  if (state === "copied") {
    label = "Copied";
  } else if (state === "failed") {
    label = "Copy failed";
  }

  return (
    <button
      className={cn(
        TAB,
        MONO,
        "group border-l",
        LINE,
        EASE_COLORS,
        FOCUS_INSET
      )}
      onClick={copySource}
      type="button"
    >
      <CopyIconSwap className="size-3" copied={state === "copied"} />
      <span aria-live="polite">{label}</span>
    </button>
  );
}
