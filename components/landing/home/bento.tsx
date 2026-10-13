"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import AIPrompt from "@/components/kokonutui/ai-prompt";
import AppleActivityCard from "@/components/kokonutui/apple-activity-card";
import CardFlip from "@/components/kokonutui/card-flip";
import FileUpload from "@/components/kokonutui/file-upload";
import HoldButton from "@/components/kokonutui/hold-button";
import ParticleButton from "@/components/kokonutui/particle-button";
import Toolbar from "@/components/kokonutui/toolbar";
import { cn } from "@/lib/utils";
import { CopyIconSwap, useCopy } from "./client";
import { type Category, docsUrl, installCommand } from "./data";
import { EASE_COLORS, enter, FOCUS } from "./styles";

const HOLD_MS = 2000;

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

const titleCase = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

type HoldState = "idle" | "holding" | "done";

const HOLD_HINTS: Record<HoldState, string> = {
  idle: "Press and hold",
  holding: "Keep holding…",
  done: "Deleted. Not really.",
};

export function Bento({ categories }: { categories: Category[] }) {
  const [sent, setSent] = useState<{ text: string; model: string } | null>(
    null
  );
  const [bursts, setBursts] = useState(0);
  const [upload, setUpload] = useState<string | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [hold, setHold] = useState<HoldState>("idle");
  const holdTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current);
      }
    },
    []
  );

  const startHold = () => {
    // A second finger can press again mid-hold; restart rather than leak.
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
    }
    setHold("holding");
    holdTimer.current = window.setTimeout(() => setHold("done"), HOLD_MS);
  };

  const endHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    // A finished hold keeps its punchline; an early release resets.
    setHold((state) => (state === "holding" ? "idle" : state));
  };

  const href = (name: string) => docsUrl(categories, name);

  return (
    <section
      aria-label="Live components"
      className="grid grid-cols-1 gap-3 md:grid-cols-12"
    >
      <Tile
        className="md:col-span-7"
        hint={
          sent
            ? `Sent “${truncate(sent.text, 28)}” to ${sent.model}`
            : "Type, then press Enter"
        }
        href={href("ai-prompt")}
        index={4}
        name="ai-prompt"
      >
        <AIPrompt
          className="w-full max-w-[520px]"
          onSubmit={(text, model) => {
            // The send button has no handler yet; Enter is the only submit.
            if (text.trim()) {
              setSent({ text: text.trim(), model });
            }
          }}
        />
      </Tile>
      <Tile
        className="md:col-span-5"
        hint="Rings fill as it mounts"
        href={href("apple-activity-card")}
        index={5}
        name="apple-activity-card"
      >
        {/* Zoom, not scale, so the tile shrinks with the card. */}
        <AppleActivityCard className="p-0 [zoom:0.78]" title="Today" />
      </Tile>
      <Tile
        className="md:col-span-4 md:row-span-2"
        hint={
          <>
            <span className="pointer-coarse:hidden">Hover to flip</span>
            <span className="pointer-coarse:inline hidden">Tap to flip</span>
          </>
        }
        href={href("card-flip")}
        index={6}
        name="card-flip"
      >
        {/* Zoomed down so this column doesn't set the height of the row. */}
        <div className="w-[280px] max-w-full [zoom:0.8]">
          <CardFlip />
        </div>
      </Tile>
      <Tile
        className="md:col-span-4 md:row-span-2"
        hint={upload ?? "Drop any image"}
        href={href("file-upload")}
        index={7}
        name="file-upload"
      >
        <FileUpload
          className="w-full"
          onFileRemove={() => setUpload(null)}
          onUploadError={(error) => setUpload(error.message)}
          onUploadSuccess={(file) =>
            setUpload(`Uploaded ${truncate(file.name, 24)}`)
          }
        />
      </Tile>
      <Tile
        className="md:col-span-4"
        hint={HOLD_HINTS[hold]}
        href={href("hold-button")}
        index={8}
        name="hold-button"
        stageClassName="min-h-[128px]"
      >
        <HoldButton
          holdDuration={HOLD_MS}
          onPointerCancel={endHold}
          onPointerDown={startHold}
          onPointerLeave={endHold}
          onPointerUp={endHold}
        />
      </Tile>
      <Tile
        className="md:col-span-4"
        hint={
          bursts > 0
            ? `Sent ${bursts} ${bursts === 1 ? "time" : "times"}`
            : "Click to send"
        }
        href={href("particle-button")}
        index={9}
        name="particle-button"
        stageClassName="min-h-[128px]"
      >
        <ParticleButton onSuccess={() => setBursts((n) => n + 1)}>
          Send
        </ParticleButton>
      </Tile>
      <Tile
        className="hidden md:col-span-12 md:flex"
        hint={tool ? `${titleCase(tool)} selected` : "Pick a tool"}
        href={href("toolbar")}
        index={10}
        name="toolbar"
        stageClassName="min-h-[104px]"
      >
        <Toolbar onSelect={setTool} />
      </Tile>
    </section>
  );
}

function Tile({
  name,
  hint,
  href,
  index,
  className,
  stageClassName,
  children,
}: {
  name: string;
  hint: ReactNode;
  href: string;
  index: number;
  className?: string;
  stageClassName?: string;
  children: ReactNode;
}) {
  const { copied, copy } = useCopy();

  return (
    <figure
      className={cn(
        "home-enter flex flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white transition-[border-color] duration-200 ease-out focus-within:border-black/[0.13] hover:border-black/[0.13] dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/[0.16] dark:focus-within:border-white/[0.16]",
        className
      )}
      style={enter(index)}
    >
      <div
        className={cn(
          "relative isolate flex flex-1 items-center justify-center p-4 sm:p-5",
          stageClassName
        )}
      >
        {children}
      </div>
      <figcaption className="flex h-10 items-center gap-3 border-black/[0.06] border-t px-4 dark:border-white/[0.07]">
        <Link
          className={cn(
            "rounded-sm font-mono text-[12px] text-black/70 underline-offset-4 hover:text-black hover:underline dark:text-white/70 dark:hover:text-white",
            FOCUS
          )}
          href={href}
        >
          {name}
        </Link>
        <span
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-[12px] text-black/55 dark:text-white/55"
        >
          {hint}
        </span>
        <button
          aria-label={copied ? "Copied" : `Copy install command for ${name}`}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 font-mono text-[11px] text-black/55 hover:bg-black/[0.05] hover:text-black active:bg-black/[0.08] dark:text-white/55 dark:active:bg-white/[0.1] dark:hover:bg-white/[0.07] dark:hover:text-white",
            EASE_COLORS,
            FOCUS
          )}
          onClick={() => copy(installCommand(name))}
          title={installCommand(name)}
          type="button"
        >
          <CopyIconSwap className="size-3" copied={copied} />
          {/* Fixed width, so "Copied" doesn't nudge the hint beside it. */}
          <span className="inline-block w-[7ch] text-left">
            {copied ? "Copied" : "Install"}
          </span>
        </button>
      </figcaption>
    </figure>
  );
}
