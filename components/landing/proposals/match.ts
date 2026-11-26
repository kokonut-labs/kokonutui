import type { Part } from "@/components/landing/home/parts";

const STOP = new Set(
  "a an the and or for to of in on at by with my me i we you it its is are be that this these some something show want need needs build make give get how can could do does add use using like one our your from into when where what which there here just".split(
    " "
  )
);

/**
 * The words people use for a screen, and the parts that answer them, best
 * first. Tested against the start of each word, so "paying" finds "pay".
 */
const INTENTS: [RegExp, string[]][] = [
  [
    /^(pay|checkout|buy|purchas|order|stripe)/,
    ["ai-checkout", "slide-to-confirm", "card-field", "amount-pad"],
  ],
  [/^card$/, ["card-field", "ai-checkout", "card-stack", "card-flip"]],
  [/^cards$/, ["card-stack", "card-flip", "carousel-cards", "bento-grid"]],
  [
    /^(money|transfer|wallet|bank|send)/,
    ["currency-transfer", "amount-pad", "ai-send", "spending-ring"],
  ],
  [/^(receipt|invoice)/, ["receipt-printer", "ai-checkout"]],
  [/^tip/, ["tip-selector"]],
  [
    /^(date|calendar|booking|hotel|stay|night)/,
    ["stay-picker", "slot-picker", "ai-schedule"],
  ],
  [
    /^(meeting|schedul|slot|appointment|time)/,
    ["slot-picker", "ai-schedule", "timezone-planner"],
  ],
  [/^(timezone|zone)/, ["timezone-planner"]],
  [
    /^(deliver|courier|track|ship|map|location|address|place)/,
    ["ai-order-status", "location-picker"],
  ],
  [
    /^(flight|trip|travel|ticket|boarding|plane|airport)/,
    ["boarding-pass", "seat-map", "stay-picker"],
  ],
  [/^(seat|cinema|concert|venue)/, ["seat-map"]],
  [
    /^(agent|tool|step|workflow|task)/,
    ["ai-tool-calls", "ai-agent-lanes", "ai-tool-approval", "ai-handoff"],
  ],
  [
    /^(approv|permission|confirm|allow)/,
    ["ai-tool-approval", "slide-to-confirm", "hold-button"],
  ],
  [
    /^(chat|prompt|input|ask|message|composer|reply)/,
    ["ai-prompt", "ai-input-search", "ai-message-queue", "ai-attachment"],
  ],
  [/^(model|llm|gpt)/, ["ai-model-selector"]],
  [/^(voice|speak|mic|audio|dictat|talk)/, ["ai-voice", "synced-transcript"]],
  [/^(transcript|caption|lyric|podcast)/, ["synced-transcript"]],
  [/^(upload|file|attach|drop|drag)/, ["file-upload", "ai-attachment"]],
  [
    /^(toast|notif|alert|feedback|error|success)/,
    ["promise-toast", "notification-stack", "inline-alert", "save-status"],
  ],
  [/^sav/, ["save-status", "save-button", "promise-toast"]],
  [/^(undo|delet|remov|trash)/, ["undo-button", "tear-button"]],
  [
    /^(load|spinner|wait|progress|think|stream)/,
    ["ai-loading", "ai-text-loading", "loader"],
  ],
  [
    /^(chart|metric|stat|dashboard|analytic|kpi|graph|revenue)/,
    ["metric-card", "spending-ring", "uptime-card", "activity-terrain"],
  ],
  [/^(budget|spend|expense|finance)/, ["spending-ring", "metric-card"]],
  [/^(uptime|status|incident|server)/, ["uptime-card", "status-island"]],
  [
    /^(fitness|activity|health|workout|ring)/,
    ["apple-activity-card", "activity-terrain"],
  ],
  [
    /^(search|command|palette|find|filter)/,
    ["action-search-bar", "ai-input-search", "command-button"],
  ],
  [
    /^(menu|nav|tab|header|sidebar)/,
    ["morphic-navbar", "smooth-tab", "marking-menu", "toolbar"],
  ],
  [
    /^(profile|avatar|account|user|settings)/,
    ["profile-dropdown", "avatar-picker", "team-selector"],
  ],
  [/^(team|workspace|org)/, ["team-selector"]],
  [
    /^(drawer|sheet|modal|popover|dialog|panel)/,
    ["smooth-drawer", "morph-popover", "stack-panel"],
  ],
  [
    /^(photo|image|gallery|picture|crop|camera)/,
    [
      "lightbox-grid",
      "contact-sheet",
      "photo-straighten",
      "focal-point-picker",
    ],
  ],
  [/^(video|clip|trim|edit video)/, ["clip-trimmer"]],
  [/^(sign|signature|contract)/, ["signature-pad"]],
  [/^(rate|rating|review|helpful|vote)/, ["helpful-rating"]],
  [/^(empty|onboard|blank|first)/, ["empty-state"]],
  [/^(code|diff|run|terminal)/, ["ai-code-run", "ai-diff-review"]],
  [/^(edit|rewrite|improve)/, ["ai-inline-edit", "ai-diff-review"]],
  [/^(source|citation|cite|reference)/, ["ai-citations"]],
  [/^(memory|remember|recall)/, ["ai-memory"]],
  [/^(context|token|limit)/, ["ai-context-meter", "ai-token-alternatives"]],
  [/^(privacy|redact|secret|pii|sensitive)/, ["ai-redact"]],
  [/^(connect|integrat|oauth|app)/, ["ai-connect"]],
  [/^(branch|version|regenerat|retry)/, ["ai-branches"]],
  [/^(queue)/, ["ai-message-queue"]],
  [/^(handoff|human|support|operator)/, ["ai-handoff"]],
  [/^(autocomplet|suggest|complet)/, ["ai-autocomplete"]],
  [
    /^(button|cta)/,
    ["particle-button", "hold-button", "slide-text-button", "attract-button"],
  ],
  [/^(cart|shop|store|product|quantity)/, ["cart-button", "ai-checkout"]],
  [
    /^(background|hero|wallpaper|backdrop)/,
    ["background-paths", "shape-hero", "dot-field", "flow-field"],
  ],
  [
    /^(text|headline|title|typ|font|word)/,
    ["type-writer", "split-flap-text", "dynamic-text", "marker-text"],
  ],
  [
    /^(slider|range|volume|dial|gauge|knob)/,
    ["liquid-slider", "detent-dial", "liquid-gauge", "wheel-picker"],
  ],
  [/^(switch|toggle|dark|theme)/, ["switch-button"]],
  [/^(bell|subscrib|newsletter)/, ["bell-button"]],
  [/^(grid|bento|layout|feature)/, ["bento-grid", "lightbox-grid"]],
  [/^(spoiler|hide|reveal|blur)/, ["spoiler-text"]],
  [/^(scroll|index|toc|contents)/, ["scroll-index"]],
  [/^(island|live)/, ["status-island"]],
];

const NOT_WORD = /[^a-z0-9\s-]/g;
const SPACE = /\s+/;

function words(query: string) {
  return query
    .toLowerCase()
    .replace(NOT_WORD, " ")
    .split(SPACE)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** How well one part answers one word of the ask. */
function wordScore(p: Part, w: string) {
  let score = 0;
  if (
    p.title
      .toLowerCase()
      .split(SPACE)
      .some((t) => t.startsWith(w))
  ) {
    score += 6;
  } else if (p.name.includes(w)) {
    score += 4;
  }
  if (p.description?.toLowerCase().includes(w)) {
    score += 1.5;
  }
  if (p.categorySlug.startsWith(w) || p.category.toLowerCase().startsWith(w)) {
    score += 2.5;
  }
  return score;
}

/**
 * The parts that best answer a plain-language ask, best first. Matching runs
 * in the browser over the catalog itself (titles, names, descriptions,
 * categories), plus the intent list above for the words people actually use.
 */
export function matchParts(parts: Part[], query: string, limit = 4): Part[] {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const scores = new Map<string, number>();
  const add = (name: string, n: number) => {
    if (n > 0 && byName.has(name)) {
      scores.set(name, (scores.get(name) ?? 0) + n);
    }
  };
  const lower = query.toLowerCase();

  for (const p of parts) {
    if (lower.includes(p.title.toLowerCase()) || lower.includes(p.name)) {
      add(p.name, 40);
    }
  }

  for (const w of words(query)) {
    for (const [pattern, names] of INTENTS) {
      if (pattern.test(w)) {
        for (const [i, name] of names.entries()) {
          add(name, 10 - i * 1.5);
        }
      }
    }
    for (const p of parts) {
      add(p.name, wordScore(p, w));
    }
  }

  return [...scores]
    .sort((a, b) => b[1] - a[1])
    .flatMap(([name]) => byName.get(name) ?? [])
    .slice(0, limit);
}
