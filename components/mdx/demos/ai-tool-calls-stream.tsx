"use client";

import AIToolCalls, {
  type ToolCallItem,
  type ToolCallState,
} from "@/components/kokonutui/ai-tool-calls";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

/** The shape of an AI SDK tool part, trimmed to what this demo uses. */
interface ToolPart {
  type: `tool-${string}`;
  toolCallId: string;
  state: ToolCallState;
  input?: { query?: string; url?: string; hotel?: string };
  output?: { count?: number; price?: string };
  errorText?: string;
}

const LABELS: Record<string, { running: string; done: string }> = {
  web_search: { running: "Searching the web", done: "Searched the web" },
  read_page: { running: "Reading", done: "Read" },
  check_availability: { running: "Checking rooms", done: "Checked rooms" },
};

/** The same mapping the docs show for `message.parts`. */
function toCall(part: ToolPart): ToolCallItem {
  const tool = part.type.slice("tool-".length);
  return {
    id: part.toolCallId,
    tool,
    ...LABELS[tool],
    state: part.state,
    detail: part.input?.query ?? part.input?.url ?? part.input?.hotel,
    result:
      part.output?.price ??
      (part.output?.count === undefined
        ? undefined
        : `${part.output.count} results`),
    error: part.errorText,
  };
}

const search = (state: ToolCallState, query?: string): ToolPart => ({
  type: "tool-web_search",
  toolCallId: "call_1",
  state,
  input: query ? { query } : undefined,
  output: state === "output-available" ? { count: 8 } : undefined,
});
const read = (state: ToolCallState): ToolPart => ({
  type: "tool-read_page",
  toolCallId: "call_2",
  state,
  input: { url: "memmo-alfama.com/rooms" },
  output: state === "output-available" ? { count: 1 } : undefined,
});
const rooms = (state: ToolCallState, errorText?: string): ToolPart => ({
  type: "tool-check_availability",
  toolCallId: "call_3",
  state,
  input: { hotel: "Memmo Alfama · Nov 14–16" },
  output: state === "output-available" ? { price: "€184 / night" } : undefined,
  errorText,
});

interface Frame {
  parts: ToolPart[];
  text?: string;
}

const START: Frame[] = [
  { parts: [] },
  { parts: [search("input-streaming", "quiet hotels")] },
  { parts: [search("input-available", "quiet hotels Alfama Lisbon")] },
  { parts: [search("output-available", "quiet hotels Alfama Lisbon")] },
  {
    parts: [
      search("output-available", "quiet hotels Alfama Lisbon"),
      read("input-available"),
    ],
  },
  {
    parts: [
      search("output-available", "quiet hotels Alfama Lisbon"),
      read("output-available"),
      rooms("input-available"),
    ],
  },
  {
    parts: [
      search("output-available", "quiet hotels Alfama Lisbon"),
      read("output-available"),
      rooms("input-available"),
    ],
  },
];

const done = [
  search("output-available", "quiet hotels Alfama Lisbon"),
  read("output-available"),
];

const SCRIPTS: Record<"ok" | "error", Frame[]> = {
  ok: [
    ...START,
    { parts: [...done, rooms("output-available")] },
    {
      parts: [...done, rooms("output-available")],
      text: "Memmo Alfama has a terrace room free for Nov 14–16 at €184 a night.",
    },
  ],
  error: [
    ...START,
    { parts: [...done, rooms("output-error", "Timed out")] },
    {
      parts: [...done, rooms("output-error", "Timed out")],
      text: "I couldn't check rooms in time. Memmo Alfama is the best match so far; want me to try again?",
    },
  ],
};

export default function AIToolCallsStream() {
  const { frame, play, run, key } = useScript(SCRIPTS);

  return (
    <StreamPlate play={play} run={run}>
      <AIToolCalls
        answer={frame.text}
        calls={frame.parts.map(toCall)}
        key={key}
      />
    </StreamPlate>
  );
}
