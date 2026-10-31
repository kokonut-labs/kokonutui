"use client";

/**
 * @author: @kokonutui
 * @description: AI Translate
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowRight } from "lucide-react";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/** Plain text, or a phrase linked to its counterpart by a shared id. */
export type AlignedPiece = string | { id: string; text: string };

export interface TranslationOption {
  code: string;
  label: string;
  /** Same ids as the source. One id can appear more than once. */
  pieces: AlignedPiece[];
}

export interface AITranslateProps {
  sourceLabel?: string;
  source?: AlignedPiece[];
  translations?: TranslationOption[];
  defaultCode?: string;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const DEMO_SOURCE: AlignedPiece[] = [
  { id: "order", text: "Your order" },
  " ",
  { id: "ship", text: "shipped" },
  " ",
  { id: "morning", text: "this morning" },
  ". ",
  { id: "arrive", text: "It should arrive" },
  " ",
  { id: "thu", text: "on Thursday" },
  ", ",
  { id: "but", text: "but" },
  " ",
  { id: "courier", text: "the courier" },
  " ",
  { id: "need", text: "may need" },
  " ",
  { id: "sign", text: "a signature" },
  " ",
  { id: "door", text: "at the door" },
  ".",
];

const DEMO_TRANSLATIONS: TranslationOption[] = [
  {
    code: "fr",
    label: "French",
    pieces: [
      { id: "order", text: "Votre commande" },
      " ",
      { id: "ship", text: "est partie" },
      " ",
      { id: "morning", text: "ce matin" },
      ". ",
      { id: "arrive", text: "Elle devrait arriver" },
      " ",
      { id: "thu", text: "jeudi" },
      ", ",
      { id: "but", text: "mais" },
      " ",
      { id: "courier", text: "le livreur" },
      " ",
      { id: "need", text: "pourrait demander" },
      " ",
      { id: "sign", text: "une signature" },
      " ",
      { id: "door", text: "à la porte" },
      ".",
    ],
  },
  {
    code: "de",
    label: "German",
    pieces: [
      { id: "order", text: "Ihre Bestellung" },
      " ",
      { id: "ship", text: "wurde" },
      " ",
      { id: "morning", text: "heute Morgen" },
      " ",
      { id: "ship", text: "verschickt" },
      ". ",
      { id: "arrive", text: "Sie sollte" },
      " ",
      { id: "thu", text: "am Donnerstag" },
      " ",
      { id: "arrive", text: "ankommen" },
      ", ",
      { id: "but", text: "aber" },
      " ",
      { id: "courier", text: "der Kurier" },
      " ",
      { id: "need", text: "braucht vielleicht" },
      " ",
      { id: "sign", text: "eine Unterschrift" },
      " ",
      { id: "door", text: "an der Tür" },
      ".",
    ],
  },
  {
    code: "ja",
    label: "Japanese",
    pieces: [
      { id: "order", text: "ご注文の商品は" },
      { id: "morning", text: "今朝" },
      { id: "ship", text: "発送されました" },
      "。",
      { id: "thu", text: "木曜日に" },
      { id: "arrive", text: "届く予定です" },
      { id: "but", text: "が" },
      "、",
      { id: "courier", text: "配達員が" },
      { id: "door", text: "玄関で" },
      { id: "sign", text: "署名を" },
      { id: "need", text: "求める場合があります" },
      "。",
    ],
  },
];

export default function AITranslate({
  sourceLabel = "English",
  source = DEMO_SOURCE,
  translations = DEMO_TRANSLATIONS,
  defaultCode,
  className,
}: AITranslateProps) {
  const [code, setCode] = useState(defaultCode ?? translations[0]?.code);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = pinned ?? hover;
  const current = translations.find((t) => t.code === code) ?? translations[0];

  const handlers = {
    active,
    onEnter: (id: string) => setHover(id),
    onPin: (id: string) => setPinned((p) => (p === id ? null : id)),
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-2xl rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
        onPointerLeave={() => setHover(null)}
      >
        <div className="grid sm:grid-cols-2">
          <section className="flex flex-col border-black/[0.06] border-b sm:border-r sm:border-b-0 dark:border-white/[0.08]">
            <header className="flex h-12 items-center gap-2 px-4">
              <span className="font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
                {sourceLabel}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="ml-auto hidden size-3.5 text-zinc-300 sm:block dark:text-zinc-600"
              />
            </header>
            <Passage {...handlers} lang="en" pieces={source} />
          </section>

          <section className="flex flex-col">
            <header className="flex h-12 items-center px-2">
              <LanguageTabs
                code={current?.code}
                onPick={(next) => {
                  setCode(next);
                  setPinned(null);
                }}
                options={translations}
              />
            </header>
            {current && (
              <Passage
                {...handlers}
                key={current.code}
                lang={current.code}
                pieces={current.pieces}
                stream
              />
            )}
          </section>
        </div>

        <footer className="flex h-11 items-center border-black/[0.06] border-t px-4 text-[12px] text-zinc-500 dark:border-white/[0.08] dark:text-zinc-400">
          {pinned
            ? "Tap the phrase again to let go"
            : "Hover or tap a phrase to see what it became"}
        </footer>
      </div>
    </MotionConfig>
  );
}

function Passage({
  pieces,
  lang,
  active,
  stream = false,
  onEnter,
  onPin,
}: {
  pieces: AlignedPiece[];
  lang: string;
  active: string | null;
  stream?: boolean;
  onEnter: (id: string) => void;
  onPin: (id: string) => void;
}) {
  let order = 0;
  return (
    <p
      className={cn(
        "flex-1 px-4 pt-1 pb-5 text-[15px] leading-7",
        lang === "ja" && "leading-8"
      )}
      lang={lang}
    >
      {pieces.map((piece, i) => {
        const key = `${i}:${typeof piece === "string" ? piece : piece.id}`;
        if (typeof piece === "string") {
          return (
            <span
              className={cn(
                "text-zinc-800 transition-colors duration-200 dark:text-zinc-200",
                active && "text-zinc-300 dark:text-zinc-600"
              )}
              key={key}
            >
              {piece}
            </span>
          );
        }
        const lit = active === piece.id;
        order += 1;
        return (
          <motion.button
            animate={{ opacity: 1, filter: "blur(0px)" }}
            className={cn(
              "-mx-0.5 inline cursor-default rounded-[4px] px-0.5 text-left leading-snug outline-hidden transition-[color,background-color] duration-200 [box-decoration-break:clone]",
              lit
                ? "bg-violet-500/[0.13] text-violet-950 dark:bg-violet-400/20 dark:text-violet-50"
                : "text-zinc-800 dark:text-zinc-200",
              active && !lit && "text-zinc-300 dark:text-zinc-600"
            )}
            initial={stream ? { opacity: 0, filter: "blur(4px)" } : false}
            key={key}
            onClick={() => onPin(piece.id)}
            onFocus={() => onEnter(piece.id)}
            onPointerEnter={() => onEnter(piece.id)}
            tabIndex={-1}
            transition={{
              duration: 0.35,
              ease: EASE_OUT,
              delay: stream ? order * 0.045 : 0,
            }}
            type="button"
          >
            {piece.text}
          </motion.button>
        );
      })}
    </p>
  );
}

function LanguageTabs({
  options,
  code,
  onPick,
}: {
  options: TranslationOption[];
  code: string | undefined;
  onPick: (code: string) => void;
}) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <div
        aria-label="Translate to"
        className="flex items-center gap-0.5"
        role="tablist"
      >
        {options.map((option) => {
          const selected = option.code === code;
          return (
            <button
              aria-selected={selected}
              className={cn(
                "relative h-8 rounded-lg px-2.5 text-[13px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-violet-500/40",
                selected
                  ? "font-medium text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
              key={option.code}
              onClick={() => onPick(option.code)}
              role="tab"
              type="button"
            >
              {selected && (
                <motion.span
                  className="absolute inset-0 rounded-lg bg-zinc-100 dark:bg-white/[0.08]"
                  layoutId="ai-translate-tab"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
