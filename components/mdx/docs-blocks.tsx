"use client";

import { ArrowDownIcon, ArrowUpRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CopyIconSwap, useCopy } from "@/components/landing/home/client";
import { CLIENT_MARKS } from "@/components/landing/home/controls";
import {
  CELL,
  EASE_COLORS,
  FOCUS_INSET,
  INK,
  LEAF,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { useEditor, usePackageManager } from "@/components/mdx/docs-prefs";
import { CopyFile, CopyRow, Picker, Plate } from "@/components/mdx/plate";
import {
  AGENT_ENDPOINTS,
  AGENT_PROMPTS,
  AGENT_RULES,
  MCP_CLIENTS,
  MCP_SETUP,
  mcpInit,
  PACKAGE_MANAGERS,
  runWith,
  SETUP_PROMPT,
} from "@/lib/agents";
import { cn } from "@/lib/utils";

/**
 * A shadcn command for the reader's package manager. Picking one here picks
 * it for every command in the docs, the component install rows included.
 */
export function Command({ run }: { run: string }) {
  const [manager, setManager] = usePackageManager();
  return (
    <Plate>
      <Picker
        label="Package manager"
        onChange={setManager}
        options={PACKAGE_MANAGERS}
        value={manager}
      />
      <CopyRow value={runWith(manager, run)} />
    </Plate>
  );
}

/** An aside: a label in mono, then a sentence or two. */
export function Note({
  title = "Note",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Plate>
      <div className={cn("flex flex-col gap-1.5 px-4 py-3.5", CELL)}>
        <p className={META}>{title}</p>
        <div
          className={cn(
            "text-[14.5px] leading-relaxed [&_code]:text-[13px] [&_p]:m-0",
            SOFT
          )}
        >
          {children}
        </div>
      </div>
    </Plate>
  );
}

const EDITOR_OPTIONS = MCP_CLIENTS.map((c) => {
  const { Mark, color } = CLIENT_MARKS[c.id];
  return {
    id: c.id,
    label: (
      <>
        <Mark className={cn("size-3.5 shrink-0", color)} />
        <span className="font-sans text-[13px]">{c.label}</span>
      </>
    ),
  };
});

function EditorPicker() {
  const [editor, setEditor] = useEditor();
  return (
    <Picker
      grid
      label="Your editor"
      onChange={setEditor}
      options={EDITOR_OPTIONS}
      value={editor}
    />
  );
}

/** Connect an editor to the shadcn MCP server: one command, or by hand. */
export function McpSetup() {
  const [editor] = useEditor();
  const [manager] = usePackageManager();
  const setup = MCP_SETUP[editor];
  return (
    <Plate>
      <EditorPicker />
      <CopyRow value={runWith(manager, mcpInit(editor))} />
      {setup.install ? (
        <a
          className={cn(
            "group flex items-center justify-between gap-4 px-3 py-3 text-[14px] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
            CELL,
            INK,
            EASE_COLORS,
            FOCUS_INSET
          )}
          href={setup.install.href}
        >
          <span>
            {setup.install.label}
            <span className={SOFT}> in one click, instead of the command</span>
          </span>
          <ArrowUpRightIcon
            aria-hidden
            className="size-3.5 text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
          />
        </a>
      ) : null}
      <CopyFile
        content={setup.config}
        file={
          <>
            <span className="text-black/40 dark:text-white/40">
              Or by hand in
            </span>
            {setup.file}
          </>
        }
      />
      <p className={cn("px-4 py-3 text-[14px] leading-relaxed", SOFT, CELL)}>
        {setup.note}
      </p>
    </Plate>
  );
}

/**
 * The two ways in. The agent route leads: one short prompt the reader can
 * read before pasting, pointing at steps the site serves at /setup.md. The
 * manual route links down to the same steps on the page.
 */
export function SetupChoice({
  manual = "#add-the-registry",
}: {
  manual?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <Plate className="md:grid-cols-12">
      <button
        aria-label={copied ? "Copied" : `Copy the prompt: ${SETUP_PROMPT}`}
        className={cn(
          "group flex flex-col gap-4 p-5 text-left hover:bg-black/[0.02] md:col-span-8 dark:hover:bg-white/[0.03]",
          CELL,
          EASE_COLORS,
          FOCUS_INSET
        )}
        onClick={() => copy(SETUP_PROMPT)}
        type="button"
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className={META}>Set up with your agent</span>
          <span
            className={cn(
              MONO,
              "flex items-center gap-1.5 text-[11.5px] text-black/50 group-hover:text-black dark:text-white/50 dark:group-hover:text-white",
              EASE_COLORS
            )}
          >
            <CopyIconSwap copied={copied} />
            {copied ? "Copied" : "Copy prompt"}
          </span>
        </span>
        <span
          className={cn(
            MONO,
            "flex items-start gap-3 text-[15px] leading-snug",
            INK
          )}
        >
          <span aria-hidden className={LEAF}>
            &rsaquo;
          </span>
          <span className="wrap-anywhere min-w-0 flex-1">{SETUP_PROMPT}</span>
        </span>
        <span className={cn("text-[14px] leading-relaxed", SOFT)}>
          Paste it into Claude Code, Cursor, VS Code or Codex. Your agent adds
          the registry, connects the MCP server and writes a rules file, then
          tells you what changed.
        </span>
      </button>
      <a
        className={cn(
          "group flex flex-col justify-between gap-4 p-5 hover:bg-black/[0.02] md:col-span-4 dark:hover:bg-white/[0.03]",
          CELL,
          EASE_COLORS,
          FOCUS_INSET
        )}
        href={manual}
      >
        <span className="flex flex-col gap-1.5">
          <span className={META}>Or by hand</span>
          <span className={cn("font-medium text-[17px]", INK)}>
            Follow the steps
          </span>
          <span className={cn("text-[14px] leading-relaxed", SOFT)}>
            Two commands and one line in components.json.
          </span>
        </span>
        <ArrowDownIcon
          aria-hidden
          className="size-4 text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
        />
      </a>
    </Plate>
  );
}

/** The rules file for the picked editor, ready to paste. */
export function AgentRules() {
  const [editor] = useEditor();
  const rules = AGENT_RULES[editor];
  return (
    <Plate>
      <EditorPicker />
      <CopyFile content={rules.content} file={rules.file} />
    </Plate>
  );
}

/** Prompts to start from; each row copies. */
export function AgentPrompts() {
  return (
    <Plate>
      {AGENT_PROMPTS.map((prompt) => (
        <CopyRow key={prompt} label="prompt" prefix="›" value={prompt} />
      ))}
    </Plate>
  );
}

/** The URLs the site serves for agents, each with what it holds. */
export function AgentEndpoints() {
  return (
    <Plate>
      {AGENT_ENDPOINTS.map((endpoint) => {
        const concrete = !endpoint.path.includes("<");
        const body = (
          <>
            <span
              className={cn(
                MONO,
                "flex items-center gap-1.5 text-[13px] sm:w-44 sm:shrink-0",
                INK
              )}
            >
              {endpoint.path}
              {concrete ? (
                <ArrowUpRightIcon
                  aria-hidden
                  className="size-3 text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
                />
              ) : null}
            </span>
            <span className={cn("text-[14px] leading-relaxed", SOFT)}>
              {endpoint.description}
            </span>
          </>
        );
        const row = cn(
          "group flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4",
          CELL
        );
        return concrete ? (
          <a
            className={cn(
              row,
              "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
              EASE_COLORS,
              FOCUS_INSET
            )}
            href={endpoint.path}
            key={endpoint.path}
            rel="noreferrer"
            target="_blank"
          >
            {body}
          </a>
        ) : (
          <div className={row} key={endpoint.path}>
            {body}
          </div>
        );
      })}
    </Plate>
  );
}
