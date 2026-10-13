import type { CSSProperties, ReactNode } from "react";

// The craft notes. Every number here is read from the component's source in
// components/kokonutui/, so the page can't promise what the code doesn't do.

export interface Callout {
  text: string;
  /** Where the marker sits, relative to the component's own box. */
  at: CSSProperties;
}

export interface Note {
  name: string;
  /** For the table of contents. */
  short: string;
  title: string;
  body: ReactNode;
  callouts: Callout[];
  /** Figure height in px; tall components get more room so they aren't shrunk. */
  height?: number;
}

export const NOTES: Note[] = [
  {
    name: "particle-button",
    short: "Answering a click",
    title: "Answer every click.",
    body: (
      <>
        <p>
          A button that does something should say so the moment it’s pressed.
          Particle Button throws a few dots out of its top edge on every click,
          then gets out of the way.
        </p>
        <p>
          Click twice quickly and the burst starts over instead of piling up.
          With reduced motion turned on, there is no burst at all.
        </p>
      </>
    ),
    callouts: [
      {
        text: "Six 4 px dots, thrown 16–56 px to the side and 16–52 px up over 450 ms, 20 ms apart.",
        at: { left: "50%", top: "-70%" },
      },
      {
        text: "They sit behind the button, so they seem to come out of its top edge.",
        at: { left: "-14%", top: "50%" },
      },
      {
        text: "One curve for the whole burst, cubic-bezier(0.23, 1, 0.32, 1): quick to leave, soft to land.",
        at: { left: "114%", top: "50%" },
      },
    ],
  },
  {
    name: "hold-button",
    short: "Making intent take time",
    title: "Make intent take time.",
    body: (
      <>
        <p>
          Deleting something shouldn’t happen on a stray click. Hold Button asks
          for three seconds of pressure and shows them filling up, so the wait
          reads as a decision being made, not as lag.
        </p>
        <p>
          Three seconds is the default; <code>holdDuration</code> changes it.
        </p>
      </>
    ),
    callouts: [
      {
        text: "The fill is linear on purpose. It’s a timer, and a timer shouldn’t speed up or slow down.",
        at: { left: "6%", top: "-60%" },
      },
      {
        text: "Let go early and it drains in 100 ms. Backing out should be quicker than going in.",
        at: { left: "112%", top: "50%" },
      },
      {
        text: "The label reads “Release” while you hold, so you know what ends it.",
        at: { left: "50%", top: "160%" },
      },
    ],
  },
  {
    name: "team-selector",
    short: "Counting",
    title: "Count, don’t jump.",
    body: (
      <>
        <p>
          When a number changes, show which way it went. Team Selector rolls its
          count in the direction of the change and brings each new teammate in
          with a small spring.
        </p>
        <p>With reduced motion turned on, the roll becomes a fade.</p>
      </>
    ),
    callouts: [
      {
        text: "New faces spring in from 85% (stiffness 260, damping 22) and keep their place, so the row never shuffles.",
        at: { left: "100%", top: "30%" },
      },
      {
        text: "The number rolls like an odometer, up when you add and down when you remove: in over 200 ms, out over 140.",
        at: { left: "100%", top: "78%" },
      },
      {
        text: "− and + switch off at one and four, so there’s never a click that does nothing.",
        at: { left: "0%", top: "78%" },
      },
    ],
  },
  {
    name: "currency-transfer",
    short: "Waiting",
    height: 520,
    title: "Show the wait, then the result.",
    body: (
      <>
        <p>
          Money in flight makes people nervous, so the card shows progress and
          then settles. After a second and a half the spinner becomes a drawn
          check, the title changes and the two accounts join up.
        </p>
        <p>
          Each change is small and quick, so it reads as one card changing
          state. With reduced motion turned on, every change is a plain fade,
          and screen readers hear the new status.
        </p>
      </>
    ),
    callouts: [
      {
        text: "The status icon grows from 90%, never from zero, and the check draws itself in 300 ms.",
        at: { left: "66%", top: "13%" },
      },
      {
        text: "Text swaps move 6 px: the old line leaves in 150 ms, the new one arrives in 200.",
        at: { left: "92%", top: "35%" },
      },
      {
        text: "The two accounts close their 12 px gap by moving toward each other. Transforms only, so nothing reflows.",
        at: { left: "100%", top: "66%" },
      },
    ],
  },
];
