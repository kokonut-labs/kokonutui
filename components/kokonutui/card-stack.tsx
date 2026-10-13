"use client";

/**
 * @author: @dorianbaffier
 * @description: Card Stack
 * @version: 1.1.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Specification {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  specs: Specification[];
}

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "instant-pay",
    title: "Quick Pay",
    subtitle: "Instant Transfers",
    description:
      "Move money in seconds with bank-grade security and zero surprises.",
    image: "https://kokonutui.com/undraw.svg",
    specs: [
      { label: "Speed", value: "Instant" },
      { label: "Security", value: "256-bit" },
      { label: "Limit", value: "$50,000" },
      { label: "Fee", value: "0.5%" },
    ],
  },
  {
    id: "crypto-pay",
    title: "Crypto Pay",
    subtitle: "Web3 Payments",
    description:
      "Accept crypto across every major chain with optimized gas routing.",
    image:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80",
    specs: [
      { label: "Network", value: "Multi-chain" },
      { label: "Gas", value: "Optimized" },
      { label: "Support", value: "24/7" },
      { label: "Security", value: "Top-tier" },
    ],
  },
  {
    id: "business-pay",
    title: "Business Pay",
    subtitle: "Enterprise Solutions",
    description:
      "Built for high-volume teams with custom APIs and premium support.",
    image:
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop&q=80",
    specs: [
      { label: "Volume", value: "Unlimited" },
      { label: "API", value: "REST/SDK" },
      { label: "Support", value: "Premium" },
      { label: "Features", value: "Custom" },
    ],
  },
  {
    id: "global-pay",
    title: "Global Pay",
    subtitle: "International Transfers",
    description:
      "Send to 180+ countries with real-time FX and same-day settlement.",
    image:
      "https://images.unsplash.com/photo-1629131726692-1accd0c53ce0?w=800&auto=format&fit=crop&q=80",
    specs: [
      { label: "Countries", value: "180+" },
      { label: "FX Rate", value: "Real-time" },
      { label: "Speed", value: "Same-day" },
      { label: "Support", value: "Local" },
    ],
  },
];

const CARD_WIDTH = 320;
const CARD_OVERLAP = 240;
const SPREAD_STEP = CARD_WIDTH - CARD_OVERLAP;

interface CardProps {
  product: Product;
  index: number;
  totalCards: number;
  isExpanded: boolean;
  reducedMotion: boolean;
  spreadStep: number;
}

const Card = ({
  product,
  index,
  totalCards,
  isExpanded,
  reducedMotion,
  spreadStep,
}: CardProps) => {
  const centerOffset = (totalCards - 1) * 5;
  const defaultX = index * 10 - centerOffset;
  const defaultY = index * 2;
  const defaultRotate = index * 1.5;

  const spreadX = (index - (totalCards - 1) / 2) * spreadStep;
  const spreadRotate = index * 5 - (totalCards - 1) * 2.5;

  const collapsedPose = {
    x: defaultX,
    y: defaultY,
    rotate: defaultRotate,
    scale: 1,
  };

  const expandedPose = {
    x: spreadX,
    y: 0,
    rotate: spreadRotate,
    scale: 1,
  };

  return (
    <motion.div
      animate={isExpanded ? expandedPose : collapsedPose}
      className={cn(
        // Centred with auto margins, so it stays centred in parents narrower
        // than the card; at least as tall as the stack, taller if the copy is.
        "absolute inset-x-0 top-0 mx-auto min-h-full w-full rounded-2xl p-6",
        // Opaque: blurring the cards beneath every frame of the spring is
        // expensive and turns the overlapping text into mush.
        "bg-white dark:bg-neutral-900",
        "border border-white/20 dark:border-neutral-800/40",
        "shadow-[0_8px_20px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_20px_rgb(0,0,0,0.3)]",
        "group-hover/stack:border-white/30 dark:group-hover/stack:border-neutral-700/30",
        "group-hover/stack:shadow-[0_12px_40px_rgb(0,0,0,0.12)] dark:group-hover/stack:shadow-[0_12px_40px_rgb(0,0,0,0.4)]",
        "transition-[border-color] duration-150 ease-out",
        "overflow-hidden"
      )}
      initial={collapsedPose}
      style={{
        maxWidth: `${CARD_WIDTH}px`,
        zIndex: totalCards - index,
      }}
      transition={
        reducedMotion
          ? { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
          : {
              type: "spring",
              stiffness: 220,
              damping: 28,
              mass: 1,
              delay: isExpanded ? index * 0.04 : 0,
            }
      }
    >
      <div className="relative z-10">
        <dl className="mb-4 grid grid-cols-4 justify-center gap-2">
          {product.specs.map((spec) => (
            <div
              className="flex flex-col items-start text-left text-[10px]"
              key={spec.label}
            >
              {/* `dt` must come first; `order-last` keeps the value on top */}
              <dt className="order-last mb-0.5 w-full text-left text-gray-900 dark:text-gray-100">
                {spec.label}
              </dt>
              <dd className="w-full text-left font-medium text-gray-500 dark:text-gray-400">
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>

        <div
          className={cn(
            "relative aspect-[16/11] w-full overflow-hidden rounded-lg",
            "bg-neutral-100 dark:bg-neutral-900",
            "border border-neutral-200/50 dark:border-neutral-700/50",
            "shadow-inner"
          )}
        >
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="320px"
            src={product.image}
            unoptimized
          />
        </div>

        <div className="mt-4">
          <div className="space-y-1">
            <span className="block text-left font-bold text-3xl text-gray-900 tracking-tight dark:text-white">
              {product.title}
            </span>
            <span className="block text-left font-semibold text-3xl text-gray-500 tracking-tight dark:text-gray-400">
              {product.subtitle}
            </span>
          </div>
          <p className="mt-2 text-left text-gray-500 text-sm dark:text-gray-400">
            {product.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

interface CardStackProps {
  className?: string;
  /** Cards, top first. Defaults to sample products. */
  items?: Product[];
}

export default function CardStackExample({
  className,
  items = SAMPLE_PRODUCTS,
}: CardStackProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  // Unknown until measured; only the expanded pose uses it, after a click.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Narrow the fan so the expanded stack fits its container on small screens.
  const spreadStep =
    containerWidth === null || items.length < 2
      ? SPREAD_STEP
      : Math.max(
          0,
          Math.min(
            SPREAD_STEP,
            (containerWidth - CARD_WIDTH) / (items.length - 1)
          )
        );

  const handleToggle = () => setIsExpanded((prev) => !prev);

  return (
    <div
      className={cn(
        "group/stack relative mx-auto",
        "min-h-[440px] w-full max-w-[90vw]",
        "md:max-w-[1200px]",
        "flex items-center justify-center",
        // Press feedback on the stack: the toggle on top of it is transparent.
        "transition-[scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:has-[>button:active]:scale-[0.99]",
        className
      )}
      ref={containerRef}
    >
      {/* Transparent toggle over the whole stack: clicking anywhere toggles, and
          the cards stay outside the button so their text is readable */}
      <button
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse card stack" : "Expand card stack"}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-400"
        onClick={handleToggle}
        type="button"
      />
      {items.map((product, index) => (
        <Card
          index={index}
          isExpanded={isExpanded}
          key={product.id}
          product={product}
          reducedMotion={reducedMotion}
          spreadStep={spreadStep}
          totalCards={items.length}
        />
      ))}
    </div>
  );
}
