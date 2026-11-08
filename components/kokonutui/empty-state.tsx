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

export default function EmptyState({
  title = "No projects yet",
  description = "A project keeps your pages, assets and deploys in one place.",
  onCreate,
  className,
}: EmptyStateProps) {
  const uid = useId();
  const [projects, setProjects] = useState<EmptyProject[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const nextId = useRef(1);

  const add = (from: EmptyProject["from"]) => {
    const project: EmptyProject = {
      id: nextId.current++,
      name: from === "github" ? "kokonutui" : "Untitled project",
      from,
    };
    setProjects((all) => [project, ...all]);
    if (from === "new") {
      setEditing(project.id);
    }
    onCreate?.(project);
  };

  const rename = (id: number, name: string) =>
    setProjects((all) =>
      all.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
    );

  const empty = projects.length === 0;
  // The card in the drawing turns into the first row, and back again.
  const morphId = `${uid}-card`;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={uid}>
        <div
          className={cn(
            "flex min-h-[380px] w-full max-w-md flex-col rounded-[24px] border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
            className
          )}
        >
          <div className="flex h-14 items-center justify-between border-zinc-200 border-b px-4 dark:border-zinc-800">
            <span className="font-medium text-[14px]">
              Projects
              <span className="ml-1.5 text-zinc-400 tabular-nums dark:text-zinc-500">
                {projects.length}
              </span>
            </span>
            <AnimatePresence initial={false}>
              {!empty && (
                <motion.button
                  animate={{ opacity: 1 }}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-zinc-900 px-3 font-medium text-[12.5px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  initial={{ opacity: 0 }}
                  onClick={() => add("new")}
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
                <Drawing morphId={morphId} />
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.3, delay: 0.1, ease: EASE_OUT }}
                >
                  <p className="mt-6 font-semibold text-[17px] tracking-tight">
                    {title}
                  </p>
                  <p className="mx-auto mt-1 max-w-[260px] text-[13.5px] text-zinc-500 leading-snug dark:text-zinc-400">
                    {description}
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      className="flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 font-medium text-[13px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                      onClick={() => add("new")}
                      type="button"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      New project
                    </button>
                    <button
                      className="flex h-9 items-center gap-1.5 rounded-full bg-zinc-100 px-4 font-medium text-[13px] outline-hidden transition-colors duration-150 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      onClick={() => add("github")}
                      type="button"
                    >
                      <FolderGit2 aria-hidden="true" className="size-4" />
                      Import
                    </button>
                  </div>
                </motion.div>
              </div>
            ) : (
              <ul className="flex flex-col gap-1 p-2">
                <AnimatePresence initial={false}>
                  {projects.map((project, index) => (
                    <Row
                      editing={editing === project.id}
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

/** Two blank cards fanned behind the one you're about to make. */
function Drawing({ morphId }: { morphId: string }) {
  return (
    <div className="relative h-[92px] w-[150px]">
      <motion.div
        animate={{ rotate: -8, x: -22, y: 6 }}
        className="absolute inset-x-4 top-2 h-[76px] rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        initial={{ rotate: 0, x: 0, y: 0 }}
        transition={{ ...MORPH, delay: 0.05 }}
      />
      <motion.div
        animate={{ rotate: 7, x: 22, y: 6 }}
        className="absolute inset-x-4 top-2 h-[76px] rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        initial={{ rotate: 0, x: 0, y: 0 }}
        transition={{ ...MORPH, delay: 0.05 }}
      />
      <motion.div
        className="absolute inset-x-4 top-0 flex h-[80px] flex-col justify-between border border-zinc-300 border-dashed bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950"
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
  layoutId,
  onRename,
  onDelete,
}: {
  project: EmptyProject;
  editing: boolean;
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

  return (
    <motion.li
      animate={{ opacity: 1 }}
      className="group flex h-14 items-center gap-3 border border-transparent px-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      initial={layoutId ? false : { opacity: 0 }}
      layout
      layoutId={layoutId}
      style={{ borderRadius: 14 }}
      transition={MORPH}
    >
      <motion.span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
        layout="position"
        style={{ background: TILE }}
      >
        {project.from === "github" ? (
          <FolderGit2 aria-hidden="true" className="size-4" />
        ) : (
          <span className="font-semibold text-[14px]">
            {project.name.charAt(0).toUpperCase()}
          </span>
        )}
      </motion.span>
      <motion.span className="min-w-0 flex-1" layout="position">
        {editing ? (
          <input
            aria-label="Project name"
            className="w-full rounded-md bg-transparent font-medium text-[14px] outline-hidden ring-1 ring-zinc-300 ring-offset-2 ring-offset-white dark:ring-zinc-700 dark:ring-offset-zinc-950"
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
        <span className="block text-[12px] text-zinc-500 dark:text-zinc-400">
          {project.from === "github"
            ? "Imported from GitHub · just now"
            : "Created just now"}
        </span>
      </motion.span>
      <button
        aria-label={`Delete ${project.name}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 outline-hidden transition-[opacity,color] duration-150 hover:text-rose-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-zinc-400/50 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        onClick={onDelete}
        type="button"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </motion.li>
  );
}
