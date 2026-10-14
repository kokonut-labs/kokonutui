"use client";

/**
 * @author: @dorianbaffier
 * @description: Momentum Rail. A card rail you can flick with the mouse: the
 * release velocity projects an end point, a spring snaps to the nearest card
 * and the ends rubber-band. Scroll position drives a cover-flow depth, image
 * parallax and the centered card's details with CSS scroll-driven animations.
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type RailScene =
  | "city"
  | "mountains"
  | "dunes"
  | "lake"
  | "islands"
  | "skyline"
  | "terraces"
  | "coast";

export interface RailItem {
  id: string;
  title: string;
  location: string;
  /** Photo URL, rendered with a plain <img>. Falls back to `scene`. */
  image?: string;
  /** Alt text for `image`. Empty by default: the title already names it. */
  imageAlt?: string;
  /** Built-in drawn artwork, used when there is no `image`. */
  scene?: RailScene;
  badge?: string;
  dates?: string;
  price: number;
  currency?: string;
  priceLabel?: string;
  rating?: number;
  reviewCount?: number;
  href?: string;
}

export type ToggleFavorite = (id: string, favorite: boolean) => void;

export interface CarouselCardsProps {
  items?: RailItem[];
  title?: string;
  eyebrow?: string;
  /** Ids saved on first render. */
  defaultFavorites?: string[];
  /** Called when a card's heart is toggled, with the item id and new state. */
  onToggleFavorite?: ToggleFavorite;
  /** Called when a card without an `href` is clicked or activated. */
  onSelect?: (item: RailItem) => void;
  className?: string;
}

const DEFAULT_ITEMS: RailItem[] = [
  {
    id: "lisbon",
    title: "Weekend in Lisbon",
    location: "Lisbon, Portugal",
    scene: "city",
    badge: "2 nights",
    dates: "Oct 24 – 26",
    price: 340,
    rating: 4.92,
    reviewCount: 318,
  },
  {
    id: "dolomites",
    title: "Slow days in the Dolomites",
    location: "Val Gardena, Italy",
    scene: "mountains",
    badge: "4 nights",
    dates: "Nov 3 – 7",
    price: 610,
    rating: 4.97,
    reviewCount: 142,
  },
  {
    id: "dunes",
    title: "Two nights in the dunes",
    location: "Merzouga, Morocco",
    scene: "dunes",
    badge: "2 nights",
    dates: "Nov 14 – 16",
    price: 280,
    rating: 4.88,
    reviewCount: 96,
  },
  {
    id: "lapland",
    title: "Lake cabin under the aurora",
    location: "Inari, Finland",
    scene: "lake",
    badge: "3 nights",
    dates: "Dec 5 – 8",
    price: 520,
    rating: 4.95,
    reviewCount: 210,
  },
  {
    id: "naxos",
    title: "Island hopping by ferry",
    location: "Naxos, Greece",
    scene: "islands",
    badge: "5 nights",
    dates: "May 9 – 14",
    price: 740,
    rating: 4.9,
    reviewCount: 187,
  },
  {
    id: "tokyo",
    title: "Late trains and night markets",
    location: "Tokyo, Japan",
    scene: "skyline",
    badge: "4 nights",
    dates: "Mar 20 – 24",
    price: 890,
    rating: 4.96,
    reviewCount: 402,
  },
  {
    id: "ubud",
    title: "Rice terraces at dawn",
    location: "Ubud, Indonesia",
    scene: "terraces",
    badge: "3 nights",
    dates: "Jan 12 – 15",
    price: 390,
    rating: 4.91,
    reviewCount: 133,
  },
  {
    id: "coast-road",
    title: "Coast road, windows down",
    location: "Big Sur, United States",
    scene: "coast",
    badge: "3 nights",
    dates: "Apr 2 – 5",
    price: 560,
    rating: 4.89,
    reviewCount: 158,
  },
];

/*
 * Depth runs off the main thread: each card is a view timeline on the inline
 * axis (0% entering on the right, 50% centered, 100% leaving on the left).
 * Browsers without scroll-driven animations get flat cards with every
 * detail visible. Reduced motion keeps only the details fade.
 */
const RAIL_CSS = `
@keyframes kokonutui-rail-tilt {
  0% { transform: perspective(900px) translateZ(-180px) rotateY(-14deg); }
  50% { transform: perspective(900px) translateZ(0) rotateY(0deg); }
  100% { transform: perspective(900px) translateZ(-180px) rotateY(14deg); }
}
@keyframes kokonutui-rail-parallax {
  from { transform: translate3d(calc(var(--rail-depth) * -1), 0, 0); }
  to { transform: translate3d(var(--rail-depth), 0, 0); }
}
@keyframes kokonutui-rail-details {
  0%, 32% { opacity: 0; transform: translate3d(0, 6px, 0); }
  45%, 55% { opacity: 1; transform: translate3d(0, 0, 0); }
  68%, 100% { opacity: 0; transform: translate3d(0, 6px, 0); }
}
@supports (animation-timeline: view()) {
  .kokonutui-rail-card { view-timeline: --kokonutui-rail inline; }
  .kokonutui-rail-details {
    animation: kokonutui-rail-details linear both;
    animation-timeline: --kokonutui-rail;
  }
  @media (prefers-reduced-motion: no-preference) {
    .kokonutui-rail-tilt {
      animation: kokonutui-rail-tilt linear both;
      animation-timeline: --kokonutui-rail;
    }
    .kokonutui-rail-layer {
      animation: kokonutui-rail-parallax linear both;
      animation-timeline: --kokonutui-rail;
    }
  }
}
`;

/* ------------------------------------------------------------------ */
/* Drawn scenes: flat zinc layers, each parallaxing by its own depth.  */
/* ------------------------------------------------------------------ */

const TONE = {
  sun: "fill-white dark:fill-zinc-400",
  far: "fill-zinc-300 dark:fill-zinc-800",
  mid: "fill-zinc-400 dark:fill-zinc-900",
  near: "fill-zinc-600 dark:fill-zinc-950",
  sky: "fill-zinc-200 dark:fill-zinc-700",
} as const;

interface SceneLayer {
  /** Parallax travel each way, as a share of the layer width. */
  depth: number;
  content: ReactNode;
}

const pines = (xs: number[], base: number, height: number) =>
  xs
    .map(
      (x, i) =>
        `M${x - 5} ${base}L${x} ${base - height - (i % 3) * 4}L${x + 5} ${base}Z`
    )
    .join("");

const windows = (
  x: number,
  y: number,
  cols: number,
  rows: number
): ReactNode[] => {
  const out: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r * 7 + c * 3) % 4 !== 0) {
        out.push(
          <rect
            className={TONE.sky}
            height="3"
            key={`${x}-${r}-${c}`}
            width="3"
            x={x + c * 7}
            y={y + r * 9}
          />
        );
      }
    }
  }
  return out;
};

const SCENES: Record<RailScene, SceneLayer[]> = {
  city: [
    {
      depth: 2,
      content: <circle className={TONE.sun} cx="150" cy="56" r="16" />,
    },
    {
      depth: 4,
      content: (
        <path className={TONE.far} d="M0 128Q60 98 120 116T208 106V200H0Z" />
      ),
    },
    {
      depth: 7,
      content: (
        <path
          className={TONE.mid}
          d="M0 152H18V138L26 130L34 138V146H48V128H62V140H76V132L84 124L92 132V150H110V136H126V146H140V126L150 118L160 126V148H176V138H192V150H208V200H0Z"
        />
      ),
    },
    {
      depth: 11,
      content: (
        <>
          <path className={TONE.near} d="M0 180Q104 164 208 178V200H0Z" />
          <path
            className={TONE.near}
            d="M74 170V152Q74 148 78 148H118Q122 148 122 152V168Z"
          />
          <rect className={TONE.sky} height="7" width="8" x="80" y="152" />
          <rect className={TONE.sky} height="7" width="8" x="94" y="152" />
          <rect className={TONE.sky} height="7" width="8" x="108" y="152" />
        </>
      ),
    },
  ],
  mountains: [
    {
      depth: 2,
      content: <circle className={TONE.sun} cx="54" cy="48" r="12" />,
    },
    {
      depth: 4,
      content: (
        <>
          <path
            className={TONE.far}
            d="M0 122L30 92L52 108L84 60L112 100L140 72L172 110L208 86V200H0Z"
          />
          <path className={TONE.sun} d="M74 75L84 60L94 75L88 71L83 77Z" />
          <path className={TONE.sun} d="M133 82L140 72L148 82L143 79Z" />
        </>
      ),
    },
    {
      depth: 7,
      content: (
        <path
          className={TONE.mid}
          d="M0 152L40 118L70 140L104 110L140 146L176 120L208 140V200H0Z"
        />
      ),
    },
    {
      depth: 11,
      content: (
        <path
          className={TONE.near}
          d={`M0 182Q60 164 120 174T208 168V200H0Z${pines([18, 30, 42, 162, 176, 190], 178, 20)}`}
        />
      ),
    },
  ],
  dunes: [
    {
      depth: 2,
      content: <circle className={TONE.sun} cx="128" cy="66" r="22" />,
    },
    {
      depth: 4,
      content: (
        <path
          className={TONE.far}
          d="M0 128Q50 104 100 124Q150 142 208 112V200H0Z"
        />
      ),
    },
    {
      depth: 7,
      content: (
        <path
          className={TONE.mid}
          d="M0 158Q70 120 130 150Q170 168 208 146V200H0Z"
        />
      ),
    },
    {
      depth: 11,
      content: (
        <path
          className={TONE.near}
          d="M0 188Q40 160 96 176Q150 194 208 170V200H0Z"
        />
      ),
    },
  ],
  lake: [
    {
      depth: 2,
      content: <circle className={TONE.sun} cx="160" cy="42" r="8" />,
    },
    {
      depth: 4,
      content: (
        <path
          className={TONE.far}
          d={`M0 142V130H208V142Z${pines([8, 20, 32, 44, 56, 68, 80, 92, 104, 116, 128, 140, 152, 164, 176, 188, 200], 132, 14)}`}
        />
      ),
    },
    {
      depth: 7,
      content: (
        <>
          <rect className={TONE.mid} height="58" width="208" x="0" y="142" />
          <path
            className={TONE.sky}
            d="M40 156H96V158H40ZM120 166H184V168H120ZM24 176H76V178H24Z"
          />
        </>
      ),
    },
    {
      depth: 11,
      content: (
        <>
          <path
            className={TONE.near}
            d="M0 184Q60 172 120 182T208 178V200H0Z"
          />
          <path className={TONE.near} d="M132 180V162L148 148L164 162V180Z" />
          <rect className={TONE.sun} height="6" width="6" x="145" y="166" />
        </>
      ),
    },
  ],
  islands: [
    {
      depth: 2,
      content: <circle className={TONE.sun} cx="52" cy="54" r="14" />,
    },
    {
      depth: 4,
      content: (
        <>
          <rect className={TONE.mid} height="70" width="208" x="0" y="130" />
          <path className={TONE.far} d="M96 131Q130 104 176 126L188 131Z" />
          <path className={TONE.far} d="M10 131Q30 120 52 131Z" />
        </>
      ),
    },
    {
      depth: 7,
      content: (
        <>
          <path className={TONE.near} d="M52 160H88L82 167H58Z" />
          <path className={TONE.sun} d="M70 157V122L90 157Z" />
          <path className={TONE.sky} d="M66 157V130L54 157Z" />
          <path
            className={TONE.far}
            d="M20 178H60V180H20ZM110 172H170V174H110Z"
          />
        </>
      ),
    },
    {
      depth: 11,
      content: (
        <path
          className={TONE.near}
          d="M0 200V182Q20 170 44 180Q60 187 70 200ZM150 200Q170 176 208 176V200Z"
        />
      ),
    },
  ],
  skyline: [
    {
      depth: 2,
      content: <circle className={TONE.sun} cx="40" cy="40" r="9" />,
    },
    {
      depth: 4,
      content: (
        <path
          className={TONE.far}
          d="M0 200V120H16V96H30V120H44V80H58V112H76V60H82V40H86V60H92V110H110V90H128V118H150V70H166V112H180V96H196V124H208V200Z"
        />
      ),
    },
    {
      depth: 7,
      content: (
        <>
          <path
            className={TONE.mid}
            d="M0 200V140H24V118H50V146H70V108H100V150H120V126H148V134H170V112H196V144H208V200Z"
          />
          {windows(74, 116, 3, 4)}
          {windows(174, 120, 3, 3)}
          {windows(28, 126, 3, 2)}
        </>
      ),
    },
    {
      depth: 11,
      content: (
        <path
          className={TONE.near}
          d="M0 170H208V178H0ZM10 178H18V200H10ZM70 178H78V200H70ZM130 178H138V200H130ZM190 178H198V200H190Z"
        />
      ),
    },
  ],
  terraces: [
    {
      depth: 2,
      content: <circle className={TONE.sun} cx="104" cy="58" r="15" />,
    },
    {
      depth: 4,
      content: <path className={TONE.far} d="M0 108Q104 76 208 102V200H0Z" />,
    },
    {
      depth: 7,
      content: (
        <path
          className={TONE.mid}
          d="M0 136Q104 112 208 132V200H0ZM0 148Q104 126 208 146V150Q104 130 0 152ZM0 164Q104 142 208 162V166Q104 146 0 168Z"
        />
      ),
    },
    {
      depth: 11,
      content: (
        <path
          className={TONE.near}
          d="M0 184Q104 162 208 180V200H0ZM24 184Q20 166 27 148H30Q24 166 28 184ZM28 148Q15 140 6 148Q16 143 28 151ZM28 148Q41 138 51 146Q39 142 28 151ZM28 148Q23 134 12 132Q24 136 29 149ZM28 148Q35 134 45 132Q33 138 29 149Z"
        />
      ),
    },
  ],
  coast: [
    {
      depth: 2,
      content: <circle className={TONE.sun} cx="56" cy="92" r="13" />,
    },
    {
      depth: 4,
      content: (
        <>
          <rect className={TONE.mid} height="88" width="208" x="0" y="112" />
          <path className={TONE.far} d="M118 200V122Q150 96 208 98V200Z" />
        </>
      ),
    },
    {
      depth: 7,
      content: (
        <>
          <path
            className={TONE.near}
            d="M208 200V128Q172 132 150 160Q136 182 112 200Z"
          />
          <path
            className={TONE.sun}
            d="M208 146Q178 150 162 170Q150 186 136 200H140Q154 188 166 172Q182 154 208 150Z"
          />
        </>
      ),
    },
    {
      depth: 11,
      content: <path className={TONE.near} d="M0 200V172Q50 156 100 200Z" />,
    },
  ],
};

const LAYER_CLASS =
  "kokonutui-rail-layer absolute inset-y-0 -left-[15%] w-[130%]";

const Scene = ({ scene }: { scene: RailScene }) => (
  <div
    aria-hidden="true"
    className="absolute inset-0 bg-zinc-200 dark:bg-zinc-700"
  >
    {SCENES[scene].map((layer) => (
      <div
        className={LAYER_CLASS}
        key={layer.depth}
        style={{ "--rail-depth": `${layer.depth}%` } as CSSProperties}
      >
        <svg
          aria-hidden="true"
          className="h-full w-full"
          preserveAspectRatio="xMidYMax slice"
          viewBox="0 0 208 200"
        >
          {layer.content}
        </svg>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/* Heart: the fill rises from the base through a clip, no scale.       */
/* ------------------------------------------------------------------ */

const HEART =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

const FavoriteButton = ({
  label,
  saved,
  onToggle,
}: {
  label: string;
  saved: boolean;
  onToggle: () => void;
}) => (
  <button
    aria-label={`Save ${label}`}
    aria-pressed={saved}
    className="absolute top-2.5 right-2.5 z-10 grid size-9 cursor-pointer place-items-center rounded-full bg-white text-zinc-900 shadow-sm ring-1 ring-black/5 transition-colors duration-150 ease-out hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-zinc-900 focus-visible:outline-offset-2 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-white/10 dark:focus-visible:outline-zinc-100 dark:hover:bg-zinc-900"
    onClick={onToggle}
    type="button"
  >
    <span className="relative size-[18px]">
      <svg
        aria-hidden="true"
        className={cn(
          "absolute inset-0 size-full transition-colors duration-200",
          saved && "text-rose-500"
        )}
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d={HEART} />
      </svg>
      <span
        className="absolute inset-0 transition-[clip-path] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{ clipPath: saved ? "inset(0 0 0 0)" : "inset(100% 0 0 0)" }}
      >
        <svg
          aria-hidden="true"
          className="size-full fill-rose-500 stroke-rose-500"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d={HEART} />
        </svg>
      </span>
    </span>
  </button>
);

/* ------------------------------------------------------------------ */
/* Card                                                               */
/* ------------------------------------------------------------------ */

const CardDetails = ({ item }: { item: RailItem }) => (
  <div className="kokonutui-rail-details mt-2 flex items-center gap-1.5 text-xs">
    {item.rating !== undefined && (
      <span className="flex items-center gap-0.5 text-zinc-900 tabular-nums dark:text-zinc-100">
        <Star aria-hidden="true" className="size-3 fill-current" />
        {item.rating.toFixed(2)}
        {item.reviewCount !== undefined && (
          <span className="text-zinc-500 dark:text-zinc-400">
            ({item.reviewCount})
          </span>
        )}
      </span>
    )}
    {item.dates && (
      <span className="truncate text-zinc-500 dark:text-zinc-400">
        · {item.dates}
      </span>
    )}
    <span className="ml-auto shrink-0 font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
      {item.currency ?? "€"}
      {item.price}
      <span className="font-normal text-zinc-500 dark:text-zinc-400">
        {" "}
        {item.priceLabel ?? "total"}
      </span>
    </span>
  </div>
);

const STRETCHED =
  "outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']";

const RailCard = ({
  item,
  saved,
  onToggleSaved,
  onSelect,
}: {
  item: RailItem;
  saved: boolean;
  onToggleSaved: (id: string) => void;
  onSelect?: (item: RailItem) => void;
}) => (
  <li className="kokonutui-rail-card w-(--rail-card) flex-none snap-center">
    <div className="kokonutui-rail-tilt group/rail-card relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-zinc-200 ring-zinc-900 ring-offset-2 ring-offset-white group-has-[[data-rail-link]:focus-visible]/rail-card:ring-2 dark:bg-zinc-800 dark:ring-zinc-100 dark:ring-offset-zinc-950">
        {item.image ? (
          <div className={cn(LAYER_CLASS, "[--rail-depth:8%]")}>
            {/* biome-ignore lint/performance/noImgElement: a plain img keeps the component free of next/image config */}
            <img
              alt={item.imageAlt ?? ""}
              className="h-full w-full object-cover"
              decoding="async"
              draggable={false}
              height={500}
              loading="lazy"
              src={item.image}
              width={520}
            />
          </div>
        ) : (
          <Scene scene={item.scene ?? "mountains"} />
        )}
        {item.badge && (
          <span className="absolute top-3 left-3 rounded-md bg-white px-1.5 py-0.5 font-medium text-[11px] text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
            {item.badge}
          </span>
        )}
        <FavoriteButton
          label={item.title}
          onToggle={() => onToggleSaved(item.id)}
          saved={saved}
        />
      </div>

      <div className="px-0.5 pt-3">
        <h3 className="truncate font-medium text-sm text-zinc-900 tracking-tight dark:text-zinc-100">
          {/* The link is stretched over the card; the heart sits above it. */}
          {/* Without an href this is a button: a bare "#" link would navigate. */}
          {item.href ? (
            <a
              className={STRETCHED}
              data-rail-link=""
              draggable={false}
              href={item.href}
            >
              {item.title}
            </a>
          ) : (
            <button
              className={cn(STRETCHED, "cursor-pointer text-left")}
              data-rail-link=""
              onClick={() => onSelect?.(item)}
              type="button"
            >
              {item.title}
            </button>
          )}
        </h3>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {item.location}
        </p>
        <CardDetails item={item} />
      </div>
    </div>
  </li>
);

/* ------------------------------------------------------------------ */
/* Momentum: drag, project, spring to a card, rubber-band at the ends. */
/* ------------------------------------------------------------------ */

const STIFFNESS = 170;
const DAMPING = 26; // about 2·√170: critically damped, so no bounce at the card
const DECELERATION = 0.997; // UIScrollView's normal rate, per ms
const DRAG_THRESHOLD = 4;

const rubber = (overshoot: number, size: number) =>
  Math.sign(overshoot) *
  (1 - 1 / ((Math.abs(overshoot) * 0.55) / size + 1)) *
  size;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

interface RailState {
  mode: "idle" | "pressing" | "dragging" | "spring";
  pointerId: number;
  startX: number;
  startPos: number;
  pos: number;
  vel: number;
  target: number;
  samples: { t: number; x: number }[];
  raf: number;
  last: number;
  suppressClick: boolean;
}

const maxScroll = (scroller: HTMLElement) =>
  scroller.scrollWidth - scroller.clientWidth;

const snapPoints = (scroller: HTMLElement, track: HTMLUListElement) => {
  const max = maxScroll(scroller);
  return Array.from(track.children, (child) => {
    const card = child as HTMLElement;
    const center = track.offsetLeft + card.offsetLeft + card.offsetWidth / 2;
    return clamp(center - scroller.clientWidth / 2, 0, max);
  });
};

const nearestIndex = (points: number[], pos: number) => {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i] - pos) < Math.abs(points[best] - pos)) {
      best = i;
    }
  }
  return best;
};

// Release velocity in px/ms from the last 100ms of samples; a pause before
// letting go means no flick.
const releaseVelocity = (samples: RailState["samples"], now: number) => {
  const first = samples[0];
  const last = samples.at(-1) ?? first;
  const dt = last.t - first.t;
  if (dt <= 0 || now - last.t > 60) {
    return 0;
  }
  return -(last.x - first.x) / dt;
};

function useMomentumRail(
  scrollerRef: RefObject<HTMLElement | null>,
  trackRef: RefObject<HTMLUListElement | null>,
  onIndex: (index: number) => void
) {
  const state = useRef<RailState>({
    mode: "idle",
    pointerId: -1,
    startX: 0,
    startPos: 0,
    pos: 0,
    vel: 0,
    target: 0,
    samples: [],
    raf: 0,
    last: 0,
    suppressClick: false,
  });
  const onIndexRef = useRef(onIndex);
  onIndexRef.current = onIndex;

  // Write a virtual position: the in-range part scrolls natively, the rest
  // becomes a damped translate on the track (the rubber band).
  const apply = useCallback(
    (pos: number) => {
      const scroller = scrollerRef.current;
      const track = trackRef.current;
      if (!(scroller && track)) {
        return;
      }
      const inRange = clamp(pos, 0, maxScroll(scroller));
      scroller.scrollLeft = inRange;
      const over = pos - inRange;
      track.style.transform =
        Math.abs(over) > 0.1
          ? `translate3d(${(-rubber(over, scroller.clientWidth)).toFixed(2)}px,0,0)`
          : "";
    },
    [scrollerRef, trackRef]
  );

  // Native scroll snap is off while JS owns the position.
  const setFree = useCallback(
    (free: boolean) => {
      const scroller = scrollerRef.current;
      if (scroller) {
        scroller.dataset.free = String(free);
      }
    },
    [scrollerRef]
  );

  const step = useCallback(
    (now: number) => {
      const s = state.current;
      const dt = Math.min((now - s.last) / 1000, 1 / 30);
      s.last = now;
      // Semi-implicit Euler substeps keep the spring stable at any frame rate.
      const h = dt / 4;
      for (let i = 0; i < 4; i++) {
        const accel = -STIFFNESS * (s.pos - s.target) - DAMPING * s.vel;
        s.vel += accel * h;
        s.pos += s.vel * h;
      }
      if (Math.abs(s.pos - s.target) < 0.5 && Math.abs(s.vel) < 8) {
        s.pos = s.target;
        s.vel = 0;
        s.mode = "idle";
        apply(s.target);
        setFree(false);
        return;
      }
      apply(s.pos);
      s.raf = requestAnimationFrame(step);
    },
    [apply, setFree]
  );

  const springTo = useCallback(
    (target: number, velocity: number) => {
      const s = state.current;
      const scroller = scrollerRef.current;
      if (!scroller) {
        return;
      }
      cancelAnimationFrame(s.raf);
      if (s.mode !== "spring" && s.mode !== "dragging") {
        s.pos = scroller.scrollLeft;
      }
      s.target = target;
      s.vel = velocity;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        s.mode = "idle";
        s.pos = target;
        apply(target);
        setFree(false);
        return;
      }
      s.mode = "spring";
      setFree(true);
      s.last = performance.now();
      s.raf = requestAnimationFrame(step);
    },
    [apply, scrollerRef, setFree, step]
  );

  const goTo = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      const track = trackRef.current;
      if (!(scroller && track)) {
        return;
      }
      const s = state.current;
      const points = snapPoints(scroller, track);
      const i = clamp(index, 0, points.length - 1);
      springTo(points[i], s.mode === "spring" ? s.vel : 0);
    },
    [scrollerRef, springTo, trackRef]
  );

  const currentIndex = useCallback(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!(scroller && track)) {
      return 0;
    }
    const s = state.current;
    const pos = s.mode === "spring" ? s.target : scroller.scrollLeft;
    return nearestIndex(snapPoints(scroller, track), pos);
  }, [scrollerRef, trackRef]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!(scroller && track)) {
      return;
    }
    const s = state.current;
    let scrollRaf = 0;

    const onScroll = () => {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        onIndexRef.current(
          nearestIndex(snapPoints(scroller, track), scroller.scrollLeft)
        );
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) {
        return;
      }
      if ((e.target as Element).closest("button:not([data-rail-link])")) {
        return;
      }
      cancelAnimationFrame(s.raf);
      // Catching a moving rail keeps its virtual position, overshoot included.
      s.pos = s.mode === "spring" ? s.pos : scroller.scrollLeft;
      s.mode = "pressing";
      s.pointerId = e.pointerId;
      s.startX = e.clientX;
      s.startPos = s.pos;
      s.samples = [{ t: e.timeStamp, x: e.clientX }];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== s.pointerId) {
        return;
      }
      const dx = e.clientX - s.startX;
      if (s.mode === "pressing" && Math.abs(dx) > DRAG_THRESHOLD) {
        s.mode = "dragging";
        scroller.setPointerCapture(e.pointerId);
        scroller.dataset.dragging = "true";
        setFree(true);
      }
      if (s.mode !== "dragging") {
        return;
      }
      s.pos = s.startPos - dx;
      apply(s.pos);
      s.samples.push({ t: e.timeStamp, x: e.clientX });
      while (s.samples.length > 2 && e.timeStamp - s.samples[0].t > 100) {
        s.samples.shift();
      }
    };

    const onRelease = (e: PointerEvent) => {
      if (e.pointerId !== s.pointerId) {
        return;
      }
      s.pointerId = -1;
      if (s.mode !== "dragging") {
        // A press that never became a drag hands back to native snapping.
        s.mode = "idle";
        setFree(false);
        return;
      }
      scroller.dataset.dragging = "false";
      s.suppressClick = true;
      setTimeout(() => {
        s.suppressClick = false;
      }, 0);
      const v = releaseVelocity(s.samples, e.timeStamp);
      const projected = s.pos + (v * DECELERATION) / (1 - DECELERATION);
      const points = snapPoints(scroller, track);
      springTo(points[nearestIndex(points, projected)], v * 1000);
    };

    // A drag that ends over a card must not follow its link.
    const onClickCapture = (e: MouseEvent) => {
      if (s.suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        s.suppressClick = false;
      }
    };

    // Wheel or touch takes over from a running spring.
    const onNativeInput = () => {
      if (s.mode !== "spring") {
        return;
      }
      cancelAnimationFrame(s.raf);
      s.mode = "idle";
      apply(clamp(s.pos, 0, maxScroll(scroller)));
      setFree(false);
    };

    // Arrow keys step one card; Home and End jump to the ends.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== scroller) {
        return;
      }
      const last = track.children.length - 1;
      const index = nearestIndex(
        snapPoints(scroller, track),
        s.mode === "spring" ? s.target : scroller.scrollLeft
      );
      let next = -1;
      switch (e.key) {
        case "ArrowLeft":
          next = index - 1;
          break;
        case "ArrowRight":
          next = index + 1;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = last;
          break;
        default:
          return;
      }
      e.preventDefault();
      goTo(next);
    };

    scroller.addEventListener("keydown", onKeyDown);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerup", onRelease);
    scroller.addEventListener("pointercancel", onRelease);
    scroller.addEventListener("lostpointercapture", onRelease);
    scroller.addEventListener("click", onClickCapture, true);
    scroller.addEventListener("wheel", onNativeInput, { passive: true });
    scroller.addEventListener("touchstart", onNativeInput, { passive: true });
    return () => {
      cancelAnimationFrame(scrollRaf);
      cancelAnimationFrame(s.raf);
      scroller.removeEventListener("keydown", onKeyDown);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", onRelease);
      scroller.removeEventListener("pointercancel", onRelease);
      scroller.removeEventListener("lostpointercapture", onRelease);
      scroller.removeEventListener("click", onClickCapture, true);
      scroller.removeEventListener("wheel", onNativeInput);
      scroller.removeEventListener("touchstart", onNativeInput);
    };
  }, [apply, goTo, scrollerRef, setFree, springTo, trackRef]);

  return { goTo, currentIndex };
}

/* ------------------------------------------------------------------ */
/* Rail                                                               */
/* ------------------------------------------------------------------ */

// `aria-disabled` rather than `disabled` at the ends, so focus stays put.
const ARROW_CLASS =
  "grid size-8 cursor-pointer place-items-center rounded-full border border-zinc-200 bg-white text-zinc-900 transition-[background-color,opacity] duration-150 ease-out hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-zinc-900 focus-visible:outline-offset-2 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:aria-disabled:hover:bg-zinc-950 dark:focus-visible:outline-zinc-100 dark:hover:bg-zinc-900";

export default function CarouselCards({
  items = DEFAULT_ITEMS,
  title = "Weekend escapes",
  eyebrow = "Picked for this autumn",
  defaultFavorites = [],
  onToggleFavorite,
  onSelect,
  className,
}: CarouselCardsProps) {
  const scrollerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState<ReadonlySet<string>>(
    () => new Set(defaultFavorites)
  );
  const { goTo, currentIndex } = useMomentumRail(
    scrollerRef,
    trackRef,
    setActive
  );

  const toggleSaved = (id: string) => {
    const next = !saved.has(id);
    setSaved((prev) => {
      const copy = new Set(prev);
      if (next) {
        copy.add(id);
      } else {
        copy.delete(id);
      }
      return copy;
    });
    onToggleFavorite?.(id, next);
  };

  const step = (delta: number) => goTo(currentIndex() + delta);

  return (
    <section
      aria-label={title}
      aria-roledescription="carousel"
      className={cn(
        "@container/rail w-full py-4 @3xl/rail:[--rail-card:16rem] @md/rail:[--rail-card:15rem] [--rail-card:13.5rem]",
        className
      )}
    >
      <div className="mb-2 flex items-end justify-between gap-4 px-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{eyebrow}</p>
          <h2 className="truncate font-semibold text-lg text-zinc-900 tracking-tight dark:text-zinc-100">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            aria-live="polite"
            className="mr-1 text-xs text-zinc-500 tabular-nums dark:text-zinc-400"
          >
            <span className="sr-only">Card </span>
            {String(active + 1).padStart(2, "0")}
            <span aria-hidden="true"> / </span>
            <span className="sr-only"> of </span>
            {String(items.length).padStart(2, "0")}
          </span>
          <button
            aria-disabled={active === 0}
            aria-label="Previous"
            className={ARROW_CLASS}
            onClick={() => step(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-disabled={active === items.length - 1}
            aria-label="Next"
            className={ARROW_CLASS}
            onClick={() => step(1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <section
        aria-label={`${title}, use arrow keys to move`}
        className="relative snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-6 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-inset data-[dragging=true]:cursor-grabbing data-[free=true]:snap-none dark:focus-visible:ring-zinc-100 [&::-webkit-scrollbar]:hidden [@media(pointer:fine)]:cursor-grab [@media(pointer:fine)]:select-none"
        ref={scrollerRef}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a focusable scroller is how keyboard users reach the arrow keys
        tabIndex={0}
      >
        <ul
          className="relative flex w-max gap-4 px-[calc(50cqw-var(--rail-card)/2)]"
          ref={trackRef}
        >
          {items.map((item) => (
            <RailCard
              item={item}
              key={item.id}
              onSelect={onSelect}
              onToggleSaved={toggleSaved}
              saved={saved.has(item.id)}
            />
          ))}
        </ul>
      </section>

      <style href="kokonutui-carousel-cards" precedence="default">
        {RAIL_CSS}
      </style>
    </section>
  );
}
