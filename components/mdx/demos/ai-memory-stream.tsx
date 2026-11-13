"use client";

import AIMemory, {
  type MemoryChange,
  type MemoryItem,
} from "@/components/kokonutui/ai-memory";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const MEMORIES: MemoryItem[] = [
  { id: "team", text: "Leads the mobile team", group: "Work", saved: "Oct 2" },
  { id: "stand", text: "Stand-up at 9:30", group: "Work", saved: "Oct 9" },
];

/** What a `save_memory` tool call would decide, per message. */
const ANSWERS: Record<string, MemoryChange> = {
  "Stand-up moved to 10": {
    reply: "Noted. I'll keep your mornings clear until 10.",
    memory: { text: "Stand-up at 10:00", group: "Work", replaces: "stand" },
  },
  "I'm vegetarian": {
    reply: "Good to know. I'll only suggest vegetarian places from now on.",
    memory: { text: "Vegetarian", group: "Preferences" },
  },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AIMemoryStream() {
  const { play, run, key } = useScript([0]);

  // Your model's answer, after a round trip.
  const remember = async (text: string) => {
    await wait(900);
    if (run === "error") {
      throw new Error("I couldn’t reach the model. Nothing was saved.");
    }
    return ANSWERS[text] ?? { reply: "Got it." };
  };

  return (
    <StreamPlate
      label="Answered by your model. Tap a reply."
      play={play}
      run={run}
    >
      <AIMemory
        greeting="Morning, Kai. Anything I should know?"
        initialMemories={MEMORIES}
        key={key}
        remember={remember}
        suggestions={Object.keys(ANSWERS)}
        title="Assistant"
      />
    </StreamPlate>
  );
}
