"use client";

/**
 * @author: @kokonutui
 * @description: Empty State
 * @version: 1.0.0
 * @date: 2026-11-08
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { FolderGit2, Plus, Trash2 } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface EmptyProject {
  id: number;
  name: string;
  from: "new" | "github";
}

export interface EmptyStateProps {
  title?: string;
  description?: string;
  onCreate?: (project: EmptyProject) => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MORPH = { type: "spring", stiffness: 380, damping: 34 } as const;
const TILE = "linear-gradient(135deg, #8b5cf6, #ec4899)";
const IMPORT_MS = 1600;

export default function EmptyState({
  title = "No projects yet",
  description = "A project keeps your pages, assets and deploys in one place.",
  onCreate,
  className,
}: EmptyStateProps) {
  const uid = useId();
  const [projects, setProjects] = useState<EmptyProject[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [importing, setImporting] = useState<number | null>(null);
  // Hovering the main button lifts the card that's about to be made.
  const [primed, setPrimed] = useState(false);
  const nextId = useRef(1);
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const add = (from: EmptyProject["from"]) => {
    const project: EmptyProject = {
      id: nextId.current++,
      name: from === "github" ? "kokonutui" : "Untitled project",
      from,
    };
    setPrimed(false);
    setProjects((all) => [project, ...all]);
    if (from === "new") {
      setEditing(project.id);
      onCreate?.(project);
    } else {
      setImporting(project.id);
      timer.current = window.setTimeout(() => {
        setImporting(null);
        onCreate?.(project);
      }, IMPORT_MS);
    }
  };

  const rename = (id: number, name: string) =>
    setProjects((all) =>
      all.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
    );

  const empty = projects.length === 0;
  // The card in the drawing turns into the oldest row, and back again.
  const morphId = `${uid}-card`;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={uid}>
        <div
          className={cn(
            "flex min-h-[380px] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
            className
          )}
        >
          <div className="flex h-14 items-center justify-between border-zinc-200 border-b px-4 dark:border-zinc-800">
            <span className="flex items-center gap-1.5 font-medium text-[14px]">
              Projects
              <span className="text-zinc-400 tabular-nums dark:text-zinc-500">
                <Roll value={projects.length} />
              </span>
            </span>
            <AnimatePresence initial={false}>
              {!empty && (
                <motion.button
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-zinc-900 px-3 font-medium text-[12.5px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:active:bg-zinc-300 dark:hover:bg-zinc-200"
                  exit={{
                    opacity: 0,
                    filter: "blur(2px)",
                    transition: { duration: 0.12 },
                  }}
                  initial={{ opacity: 0, filter: "blur(2px)" }}
                  onClick={() => add("new")}
                  transition={{ duration: 0.2, delay: 0.15 }}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  New
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex flex-1 flex-col">
            {empty ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 text-center">
                <Drawing morphId={morphId} primed={primed} />
                <motion.div
                  animate="shown"
                  initial="hidden"
                  transition={{ staggerChildren: 0.05, delayChildren: 0.1 }}
                >
                  <motion.p
                    className="mt-6 font-semibold text-[17px] tracking-tight"
                    variants={REVEAL}
                  >
                    {title}
                  </motion.p>
                  <motion.p
                    className="mx-auto mt-1 max-w-[260px] text-[13.5px] text-zinc-500 leading-snug dark:text-zinc-400"
                    variants={REVEAL}
                  >
                    {description}
                  </motion.p>
                  <motion.div
                    className="mt-5 flex items-center justify-center gap-2"
                    variants={REVEAL}
                  >
                    <button
                      className="flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 font-medium text-[13px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:active:bg-zinc-300 dark:hover:bg-zinc-200"
                      onBlur={() => setPrimed(false)}
                      onClick={() => add("new")}
                      onFocus={() => setPrimed(true)}
                      onPointerEnter={(event) => {
                        if (event.pointerType === "mouse") {
                          setPrimed(true);
                        }
                      }}
                      onPointerLeave={() => setPrimed(false)}
                      type="button"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      New project
                    </button>
                    <button
                      className="flex h-9 items-center gap-1.5 rounded-full bg-zinc-100 px-4 font-medium text-[13px] outline-hidden transition-colors duration-150 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:bg-zinc-300 dark:bg-zinc-900 dark:active:bg-zinc-700 dark:hover:bg-zinc-800"
                      onClick={() => add("github")}
                      type="button"
                    >
                      <FolderGit2 aria-hidden="true" className="size-4" />
                      Import
                    </button>
                  </motion.div>
                </motion.div>
              </div>
            ) : (
              <ul className="flex flex-col gap-1 p-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {projects.map((project, index) => (
                    <Row
                      editing={editing === project.id}
                      importing={importing === project.id}
                      key={project.id}
                      layoutId={
                        index === projects.length - 1 ? morphId : undefined
                      }
                      onDelete={() =>
                        setProjects((all) =>
                          all.filter((p) => p.id !== project.id)
                        )
                      }
                      onRename={(name) => {
                        rename(project.id, name);
                        setEditing(null);
                      }}
                      project={project}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}

const REVEAL = {
  hidden: { opacity: 0, y: 6, filter: "blur(2px)" },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.3, ease: EASE_OUT },
  },
};

/** Two blank cards fanned behind the one you're about to make. */
function Drawing({ morphId, primed }: { morphId: string; primed: boolean }) {
  const spread = primed ? 1.35 : 1;
  return (
    <div className="relative h-[92px] w-[150px]">
      {[-1, 1].map((side) => (
        <motion.div
          animate={{
            rotate: side * 7.5 * spread,
            x: side * 22 * spread,
            y: 6,
          }}
          className="absolute inset-x-4 top-2 h-[76px] rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          initial={{ rotate: 0, x: 0, y: 0 }}
          key={side}
          transition={MORPH}
        />
      ))}
      <motion.div
        animate={{ y: primed ? -5 : 0 }}
        className="absolute inset-x-4 top-0 flex h-[80px] flex-col justify-between border border-zinc-300 border-dashed bg-white p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] dark:border-zinc-700 dark:bg-zinc-950"
        layoutId={morphId}
        style={{ borderRadius: 16 }}
        transition={MORPH}
      >
        <span
          className="flex size-7 items-center justify-center rounded-lg text-white"
          style={{ background: TILE }}
        >
          <Plus aria-hidden="true" className="size-4" />
        </span>
        <span className="flex flex-col gap-1.5">
          <span className="h-1.5 w-14 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <span className="h-1.5 w-9 rounded-full bg-zinc-100 dark:bg-zinc-900" />
        </span>
      </motion.div>
    </div>
  );
}

function Row({
  project,
  editing,
  importing,
  layoutId,
  onRename,
  onDelete,
}: {
  project: EmptyProject;
  editing: boolean;
  importing: boolean;
  layoutId?: string;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  let meta = "Created just now";
  if (importing) {
    meta = "Copying 142 files from GitHub";
  } else if (project.from === "github") {
    meta = "Imported from GitHub · 142 files";
  }

  return (
    <motion.li
      animate={{ opacity: 1, scale: 1 }}
      className="group relative flex h-14 items-center gap-3 overflow-hidden px-2 hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900/60"
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      initial={layoutId ? false : { opacity: 0, scale: 0.97 }}
      layout
      layoutId={layoutId}
      style={{ borderRadius: 14 }}
      transition={MORPH}
    >
      {/* The row's contents arrive just after the card lands. */}
      <motion.span
        animate="shown"
        className="flex min-w-0 flex-1 items-center gap-3"
        initial="hidden"
        layout="position"
        transition={{ staggerChildren: 0.04, delayChildren: 0.08 }}
      >
        <motion.span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: TILE }}
          variants={REVEAL}
        >
          {project.from === "github" ? (
            <FolderGit2 aria-hidden="true" className="size-4" />
          ) : (
            <span className="font-semibold text-[14px]">
              {project.name.charAt(0).toUpperCase()}
            </span>
          )}
        </motion.span>
        <motion.span className="min-w-0 flex-1" variants={REVEAL}>
          {editing ? (
            <input
              aria-label="Project name"
              className="w-full rounded-md bg-transparent font-medium text-[16px] outline-hidden ring-1 ring-zinc-300 ring-offset-2 ring-offset-white sm:text-[14px] dark:ring-zinc-700 dark:ring-offset-zinc-950"
              defaultValue={project.name}
              onBlur={(event) => onRename(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "Escape") {
                  event.currentTarget.blur();
                }
              }}
              ref={inputRef}
            />
          ) : (
            <span className="block truncate font-medium text-[14px]">
              {project.name}
            </span>
          )}
          <span className="relative block h-[18px] text-[12px] text-zinc-500 dark:text-zinc-400">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                className="block truncate"
                exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
                initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
                key={meta}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                {meta}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.span>
      </motion.span>
      <button
        aria-label={`Delete ${project.name}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 outline-hidden transition-[opacity,color] duration-150 hover:text-rose-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-zinc-400/50 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        disabled={importing}
        onClick={onDelete}
        type="button"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>

      {/* Import progress runs along the bottom of the row. */}
      <AnimatePresence>
        {importing && (
          <motion.span
            animate={{ scaleX: 1 }}
            aria-hidden="true"
            className="absolute inset-x-2 bottom-0 h-[2px] origin-left rounded-full"
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            initial={{ scaleX: 0 }}
            style={{ background: TILE }}
            transition={{
              duration: IMPORT_MS / 1000,
              ease: [0.33, 0.6, 0.4, 1],
            }}
          />
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** A count that rolls up when it grows and down when it shrinks. */
function Roll({ value }: { value: number }) {
  const previous = useRef(value);
  const up = value >= previous.current;
  useEffect(() => {
    previous.current = value;
  }, [value]);
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: up ? "-70%" : "70%", opacity: 0 }}
          initial={{ y: up ? "70%" : "-70%", opacity: 0 }}
          key={value}
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
