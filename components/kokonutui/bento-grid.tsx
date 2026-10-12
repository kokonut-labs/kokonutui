"use client";

/**
 * @author: @dorianbaffier
 * @description: Bento Grid
 * @version: 2.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowUpRight, CheckCircle2, Mic, Plus } from "lucide-react";
import {
  MotionConfig,
  motion,
  useInView,
  useReducedMotion,
  useSpring,
  type Variants,
} from "motion/react";
import Link from "next/link";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import Anthropic from "@/components/icons/anthropic";
import AnthropicDark from "@/components/icons/anthropic-dark";
import DeepSeek from "@/components/icons/deepseek";
import Google from "@/components/icons/gemini";
import MistralAI from "@/components/icons/mistral";
import OpenAI from "@/components/icons/open-ai";
import OpenAIDark from "@/components/icons/open-ai-dark";
import { cn } from "@/lib/utils";

export interface BentoLogo {
  name: string;
  icon: ReactNode;
}

export interface BentoTimelineEvent {
  year: string;
  event: string;
}

export type BentoFeature =
  | { type: "spotlight"; items: string[] }
  | { type: "typing"; code: string; filename?: string }
  | { type: "logos"; logos: BentoLogo[] }
  | { type: "timeline"; events: BentoTimelineEvent[] }
  | { type: "voice" };

export interface BentoItem {
  id: string;
  title: string;
  description: string;
  /** When set, the whole card becomes a link. */
  href?: string;
  feature?: BentoFeature;
  /**
   * Applied to the grid cell. The grid is 6 columns from `md` up, so use
   * `md:col-span-*` / `lg:col-span-*` to size cards (defaults to `md:col-span-2`).
   */
  className?: string;
}

export interface BentoGridProps {
  items?: BentoItem[];
  className?: string;
}

const iconClass = "h-5 w-5";

export const defaultBentoItems: BentoItem[] = [
  {
    id: "main",
    title: "Building tomorrow's technology",
    description:
      "We architect and develop enterprise-grade applications that scale seamlessly with cloud-native technologies and microservices.",
    href: "#",
    feature: {
      type: "spotlight",
      items: [
        "Microservices architecture",
        "Serverless computing",
        "Container orchestration",
        "API-first design",
        "Event-driven systems",
      ],
    },
    className: "md:col-span-2",
  },
  {
    id: "agents",
    title: "AI Agents & Automation",
    description:
      "Intelligent agents that learn, adapt, and automate complex workflows",
    href: "#",
    feature: {
      type: "typing",
      filename: "server.ts",
      code: "const createAgent = async () => {\n  const agent = new AIAgent({\n    model: 'gpt-4-turbo',\n    tools: [codeAnalysis, dataProcessing],\n    memory: new ConversationalMemory()\n  });\n\n  // Train on domain knowledge\n  await agent.learn(domainData);\n\n  return agent;\n};",
    },
    className: "md:col-span-4",
  },
  {
    id: "partners",
    title: "Trusted partners",
    description:
      "Working with the leading AI and cloud providers to deliver cutting-edge solutions",
    href: "#",
    feature: {
      type: "logos",
      logos: [
        {
          name: "OpenAI",
          icon: (
            <>
              <OpenAI className={cn(iconClass, "dark:hidden")} />
              <OpenAIDark className={cn(iconClass, "hidden dark:block")} />
            </>
          ),
        },
        {
          name: "Anthropic",
          icon: (
            <>
              <Anthropic className={cn(iconClass, "dark:hidden")} />
              <AnthropicDark className={cn(iconClass, "hidden dark:block")} />
            </>
          ),
        },
        { name: "Google", icon: <Google className={iconClass} /> },
        { name: "Mistral", icon: <MistralAI className={iconClass} /> },
        { name: "DeepSeek", icon: <DeepSeek className={iconClass} /> },
        {
          name: "More",
          icon: (
            <Plus className="h-6 w-6 text-neutral-600 dark:text-neutral-400" />
          ),
        },
      ],
    },
    className: "md:col-span-3 lg:col-span-2",
  },
  {
    id: "innovation",
    title: "Innovation timeline",
    description:
      "Pioneering the future of AI and cloud computing with breakthrough innovations",
    href: "#",
    feature: {
      type: "timeline",
      events: [
        { year: "2020", event: "Launch of Cloud-Native Platform" },
        { year: "2021", event: "Advanced AI Integration & LLM APIs" },
        { year: "2022", event: "Multi-Agent Systems & RAG Architecture" },
        { year: "2023", event: "Autonomous AI Agents & Neural Networks" },
        { year: "2024", event: "AGI-Ready Infrastructure & Edge Computing" },
      ],
    },
    className: "md:col-span-3 lg:col-span-2",
  },
  {
    id: "voice",
    title: "Voice Assistant",
    description:
      "Interact with our AI using natural voice commands. Experience seamless voice-driven interactions with advanced speech recognition.",
    feature: { type: "voice" },
    className: "md:col-span-6 lg:col-span-2",
  },
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const gridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const cellVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.25 } },
};

const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

function SpotlightFeature({ items }: { items: string[] }) {
  return (
    <motion.ul className="mt-2 space-y-1.5" variants={listVariants}>
      {items.map((item) => (
        <motion.li
          className="flex items-center gap-2"
          key={item}
          variants={listItemVariants}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
          <span className="text-neutral-700 text-sm dark:text-neutral-300">
            {item}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  );
}

function LogosFeature({ logos }: { logos: BentoLogo[] }) {
  return (
    <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
      {logos.map((logo) => (
        <li
          className="flex min-w-0 items-center gap-2.5 rounded-xl border border-neutral-200/50 bg-gradient-to-b from-neutral-100/80 to-neutral-100 px-2.5 py-2 transition-colors duration-200 group-hover:border-neutral-300/70 dark:border-neutral-700/50 dark:from-neutral-800/80 dark:to-neutral-800 dark:group-hover:border-neutral-600/70"
          key={logo.name}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center">
            {logo.icon}
          </div>
          <span className="min-w-0 truncate font-medium text-neutral-600 text-xs dark:text-neutral-400">
            {logo.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TimelineFeature({ events }: { events: BentoTimelineEvent[] }) {
  return (
    <div className="relative mt-3">
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-[9px] w-0.5 bg-neutral-200 dark:bg-neutral-700"
      />
      <motion.ol className="relative space-y-3" variants={listVariants}>
        {events.map((item) => (
          <motion.li
            className="relative flex gap-3"
            key={`${item.year}-${item.event}`}
            variants={listItemVariants}
          >
            <div className="z-10 mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800" />
            <div>
              <div className="font-medium text-neutral-900 text-sm dark:text-neutral-100">
                {item.year}
              </div>
              <div className="text-neutral-600 text-xs dark:text-neutral-400">
                {item.event}
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}

const TYPING_INTERVAL_MS = 20;

function TypingFeature({
  code,
  filename = "index.ts",
}: {
  code: string;
  filename?: string;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inView = useInView(terminalRef, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion || typed >= code.length) {
      return;
    }
    const timeout = setTimeout(() => {
      setTyped((count) => count + 1);
      const el = terminalRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, TYPING_INTERVAL_MS);
    return () => clearTimeout(timeout);
  }, [inView, reduceMotion, typed, code.length]);

  return (
    <div className="mt-3">
      <div className="mb-2 text-neutral-500 text-xs dark:text-neutral-400">
        {filename}
      </div>
      <div
        className="relative z-10 h-[150px] overflow-y-auto rounded-md bg-neutral-900 p-3 font-mono text-neutral-100 text-xs dark:bg-black"
        ref={terminalRef}
      >
        <span className="sr-only">{code}</span>
        <pre aria-hidden="true" className="whitespace-pre-wrap">
          {reduceMotion ? code : code.slice(0, typed)}
          <span className="animate-pulse motion-reduce:animate-none">|</span>
        </pre>
      </div>
    </div>
  );
}

const VOICE_BARS = Array.from({ length: 48 }, (_, i) => ({
  id: `bar-${i}`,
  // Deterministic "waveform" so server and client render the same thing.
  scale: 0.2 + 0.8 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45)),
  delay: `${(i % 12) * 60}ms`,
}));

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

function VoiceFeature() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-40px" });
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isDemo, setIsDemo] = useState(true);

  // Elapsed-time counter while recording.
  useEffect(() => {
    if (!recording) {
      return;
    }
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);

  // Self-running demo loop (record 3s, pause 1s) while visible, until the
  // user takes over by clicking. Leaving the viewport mid-loop stops the
  // demo recording so the counter above doesn't keep ticking off-screen.
  useEffect(() => {
    if (!isDemo) {
      return;
    }
    if (!inView) {
      setRecording(false);
      setSeconds(0);
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    const start = () => {
      setRecording(true);
      setSeconds(0);
      timeout = setTimeout(() => {
        setRecording(false);
        setSeconds(0);
        timeout = setTimeout(start, 1000);
      }, 3000);
    };
    timeout = setTimeout(start, 300);
    return () => clearTimeout(timeout);
  }, [isDemo, inView]);

  const handleClick = () => {
    setIsDemo(false);
    setRecording(!recording);
    setSeconds(0);
  };

  return (
    <div className="flex w-full flex-col items-center gap-2 py-4" ref={rootRef}>
      <button
        aria-label={recording ? "Stop recording" : "Start recording"}
        aria-pressed={recording}
        className="relative z-10 flex h-16 w-16 items-center justify-center rounded-xl transition-[background-color,transform] duration-150 ease-out hover:bg-black/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-400 active:scale-[0.97] dark:hover:bg-white/10"
        onClick={handleClick}
        type="button"
      >
        {recording ? (
          <span className="h-6 w-6 animate-spin rounded-sm bg-black [animation-duration:3s] motion-reduce:animate-none dark:bg-white" />
        ) : (
          <Mic className="h-6 w-6 text-black/70 dark:text-white/70" />
        )}
      </button>

      <span
        className={cn(
          "font-mono text-sm tabular-nums transition-colors duration-200",
          recording
            ? "text-black/70 dark:text-white/70"
            : "text-black/30 dark:text-white/30"
        )}
      >
        {formatTime(seconds)}
      </span>

      <div
        aria-hidden="true"
        className="flex h-4 w-64 max-w-full items-center justify-center gap-0.5"
      >
        {VOICE_BARS.map((bar) => (
          <span
            className={cn(
              "h-full w-0.5 rounded-full transition-[transform,background-color] duration-300 ease-out motion-reduce:transition-none",
              recording
                ? "animate-pulse bg-black/50 motion-reduce:animate-none dark:bg-white/50"
                : "bg-black/10 dark:bg-white/10"
            )}
            key={bar.id}
            style={{
              transform: `scaleY(${recording ? bar.scale : 0.25})`,
              animationDelay: bar.delay,
            }}
          />
        ))}
      </div>

      <p
        aria-live="polite"
        className="h-4 text-black/70 text-xs dark:text-white/70"
      >
        {recording ? "Listening..." : "Click to speak"}
      </p>
    </div>
  );
}

function FeatureContent({ feature }: { feature: BentoFeature }) {
  switch (feature.type) {
    case "spotlight":
      return <SpotlightFeature items={feature.items} />;
    case "typing":
      return <TypingFeature code={feature.code} filename={feature.filename} />;
    case "logos":
      return <LogosFeature logos={feature.logos} />;
    case "timeline":
      return <TimelineFeature events={feature.events} />;
    case "voice":
      return <VoiceFeature />;
    default:
      return null;
  }
}

const TILT_SPRING = { stiffness: 300, damping: 30 };
const MAX_TILT_DEG = 2;

export function BentoCard({ item }: { item: BentoItem }) {
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType !== "mouse") {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = (event.clientX - rect.left) / rect.width - 0.5;
    const yPct = (event.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-yPct * 2 * MAX_TILT_DEG);
    rotateY.set(xPct * 2 * MAX_TILT_DEG);
  };

  const resetTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      className="h-full"
      onPointerLeave={resetTilt}
      onPointerMove={handlePointerMove}
      style={
        reduceMotion
          ? undefined
          : { rotateX, rotateY, transformPerspective: 1200 }
      }
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      whileHover={reduceMotion || !item.href ? undefined : { y: -4 }}
    >
      <div
        className={cn(
          "group relative flex h-full flex-col gap-2 rounded-xl border border-neutral-200/60 bg-gradient-to-b from-neutral-50/80 to-neutral-50 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)]",
          "transition-[border-color,box-shadow,transform] duration-200 ease-out",
          "hover:border-neutral-300/70 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]",
          "dark:border-neutral-800/60 dark:from-neutral-900/80 dark:to-neutral-900 dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] dark:hover:border-neutral-700/60 dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)]",
          item.href &&
            "has-[a:active]:scale-[0.98] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-neutral-400 motion-reduce:has-[a:active]:scale-100"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-neutral-900 text-xl tracking-tight dark:text-neutral-100">
            {item.href ? (
              <Link
                className="outline-hidden after:absolute after:inset-0 after:rounded-xl"
                href={item.href}
              >
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h3>
          {item.href && (
            <ArrowUpRight
              aria-hidden="true"
              className="h-5 w-5 shrink-0 -translate-x-1 translate-y-1 text-neutral-400 opacity-0 transition-[opacity,transform] duration-200 ease-out group-focus-within:translate-x-0 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:translate-x-0 motion-reduce:translate-y-0 dark:text-neutral-500"
            />
          )}
        </div>

        <p className="text-neutral-600 text-sm tracking-tight dark:text-neutral-400">
          {item.description}
        </p>

        {item.feature && <FeatureContent feature={item.feature} />}
      </div>
    </motion.div>
  );
}

export default function BentoGrid({
  items = defaultBentoItems,
  className,
}: BentoGridProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-white py-24 sm:py-32 dark:bg-black",
        className
      )}
    >
      <MotionConfig reducedMotion="user">
        <motion.ul
          className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 md:grid-cols-6 lg:px-8"
          initial="hidden"
          variants={gridVariants}
          viewport={{ once: true, margin: "-80px" }}
          whileInView="visible"
        >
          {items.map((item) => (
            <motion.li
              className={cn("min-w-0", item.className ?? "md:col-span-2")}
              key={item.id}
              variants={cellVariants}
            >
              <BentoCard item={item} />
            </motion.li>
          ))}
        </motion.ul>
      </MotionConfig>
    </section>
  );
}
