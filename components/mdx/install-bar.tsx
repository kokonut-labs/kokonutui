"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { announceCopy } from "@/components/copy-toast";
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
import { useInstallVia, usePackageManager } from "@/components/mdx/docs-prefs";
import { copyComponent } from "@/lib/action";
import { componentPrompt, PACKAGE_MANAGERS, runWith } from "@/lib/agents";
import { cn } from "@/lib/utils";

const COPIED_MS = 1600;

// v0 fetches the registry entry, so the link always points at the live site.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `https://${process.env.NEXT_PUBLIC_SITE_URL}`;

const TAB =
  "inline-flex h-8 items-center gap-1.5 px-3 text-[12px] text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white";

/**
 * The install row above every demo: a prompt for your agent first, or a
 * package manager, then click the line anywhere to copy it. v0 and the raw
 * source sit beside the picker.
 */
export function InstallBar({
  name,
  prePath,
  showSource = true,
  source,
}: {
  name: string;
  prePath: string;
  showSource?: boolean;
  /** The component's source, read with the page so Copy code is instant. */
  source?: string;
}) {
  const [manager, setManager] = usePackageManager();
  const [via, setVia] = useInstallVia();
  const { copied, copy } = useCopy();
  const agent = via === "agent";
  const command = agent
    ? componentPrompt(name)
    : runWith(manager, `shadcn@latest add ${prePath}/${name}`);
  const tab = (selected: boolean) =>
    cn(
      TAB,
      MONO,
      "border-r",
      LINE,
      selected && "bg-[#f4f4f4] text-black dark:bg-[#161616] dark:text-white",
      EASE_COLORS,
      FOCUS_INSET
    );

  return (
    <div className={cn("grid grid-cols-1 border-b", GRID, LINE)}>
      <div className={cn("flex flex-wrap items-stretch justify-between", CELL)}>
        <fieldset className="m-0 flex min-w-0 border-0 p-0">
          <legend className="sr-only">Install with</legend>
          <button
            aria-pressed={agent}
            className={tab(agent)}
            onClick={() => setVia("agent")}
            type="button"
          >
            Agent
          </button>
          {PACKAGE_MANAGERS.map((m) => {
            const selected = !agent && m.id === manager;
            return (
              <button
                aria-pressed={selected}
                className={tab(selected)}
                key={m.id}
                onClick={() => {
                  setVia("cli");
                  setManager(m.id);
                }}
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
          {showSource ? <CopySource name={name} source={source} /> : null}
        </div>
      </div>
      <button
        aria-label={
          copied
            ? "Copied"
            : `Copy the install ${agent ? "prompt" : "command"}: ${command}`
        }
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
          {agent ? "\u203A" : "$"}
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

const sources = new Map<string, Promise<string>>();

/**
 * Reads a component's source on the server once per page view, for a page
 * that did not bring it along. Hovering or focusing Copy code starts it.
 */
function loadSource(name: string) {
  let source = sources.get(name);
  if (!source) {
    const formData = new FormData();
    formData.append("folder", name);
    source = copyComponent(
      { error: "", content: "", success: false },
      formData
    ).then((result) => {
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.content;
    });
    // A failed read is tried again on the next click.
    source.catch(() => sources.delete(name));
    sources.set(name, source);
  }
  return source;
}

/**
 * Copies the component's source file. Docs pages pass it in, so the click
 * writes it straight away; otherwise it is read on the server.
 */
function CopySource({ name, source }: { name: string; source?: string }) {
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
    if (source !== undefined) {
      navigator.clipboard.writeText(source).then(
        () => {
          settle("copied");
          announceCopy(`${name}.tsx`);
        },
        () => settle("failed")
      );
      return;
    }

    const text = loadSource(name);
    // Safari only allows clipboard writes inside the click, so hand it a
    // pending item rather than waiting for the server first.
    const write =
      typeof ClipboardItem === "undefined"
        ? text.then((value) => navigator.clipboard.writeText(value))
        : navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": text.then(
                (value) => new Blob([value], { type: "text/plain" })
              ),
            }),
          ]);

    // The toast says Copying if the server is slow to answer.
    announceCopy(`${name}.tsx`, write);
    write.then(
      () => settle("copied"),
      () => settle("failed")
    );
  };

  const warm = source === undefined ? () => loadSource(name) : undefined;

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
      onFocus={warm}
      onPointerDown={warm}
      onPointerEnter={warm}
      type="button"
    >
      <CopyIconSwap className="size-3" copied={state === "copied"} />
      <span aria-live="polite">{label}</span>
    </button>
  );
}
