"use client";

import AISchedule, {
  type ScheduleSlot,
} from "@/components/kokonutui/ai-schedule";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

/** What a `find_times` tool would return from both calendars. */
const SLOTS: ScheduleSlot[] = [
  {
    id: "mon",
    weekday: "Mon",
    month: "Nov",
    day: 17,
    time: "11:00 – 11:45",
    at: [11, 11.75],
    you: [[9, 10.5]],
    them: [
      [12, 13],
      [15, 17],
    ],
  },
  {
    id: "wed",
    weekday: "Wed",
    month: "Nov",
    day: 19,
    time: "15:00 – 15:45",
    at: [15, 15.75],
    you: [[10, 12]],
    them: [
      [8.5, 9.5],
      [13, 14.5],
    ],
    note: "After his design review",
  },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AIScheduleStream() {
  const { play, run, key } = useScript([0]);

  // Your calendar API creates the event; a throw puts the times back.
  const book = async () => {
    await wait(1100);
    if (run === "error") {
      throw new Error("Leo just took that time. Pick another.");
    }
  };

  return (
    <StreamPlate
      label="Booked through your own handler. Press Book."
      play={play}
      run={run}
    >
      <AISchedule
        confirmation={(slot) =>
          `Done, ${slot.weekday} at ${slot.time.split(" ")[0]}. Leo has the invite.`
        }
        duration="45 min"
        key={key}
        onBook={book}
        slots={SLOTS}
        title="Hiring debrief"
        with={{ name: "Leo Marsh", initials: "LM" }}
      />
    </StreamPlate>
  );
}
