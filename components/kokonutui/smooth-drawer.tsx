"use client";

/**
 * @author: @dorianbaffier
 * @description: Smooth Drawer
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Fingerprint } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface PriceTagProps {
  price: number;
  discountedPrice: number;
}

function PriceTag({ price, discountedPrice }: PriceTagProps) {
  return (
    <div className="mx-auto flex max-w-fit items-center justify-around gap-4">
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-4xl text-zinc-900 dark:text-white">
          ${discountedPrice}
        </span>
        <span className="text-lg text-zinc-400 line-through dark:text-zinc-500">
          ${price}
        </span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          Lifetime access
        </span>
        <span className="text-xs text-zinc-700 dark:text-zinc-300">
          One-time payment
        </span>
      </div>
    </div>
  );
}

interface SmoothDrawerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onPrimaryAction?: () => void;
  /** Link for the primary button. Defaults to the demo's pricing page. */
  primaryHref?: string;
  onSecondaryAction?: () => void;
  price?: number;
  discountedPrice?: number;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// vaul already slides the sheet in, so the content only staggers a short
// fade-up instead of sliding in a second time.
const drawerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04 },
  },
} satisfies Variants;

const itemVariants = {
  hidden: { y: 8, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
} satisfies Variants;

const reducedItemVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
} satisfies Variants;

// Hovering the CTA sweeps the shine across once and wiggles the icon once;
// leaving snaps the shine back out of view instead of sweeping it back.
const shineVariants = {
  rest: { x: "-100%", transition: { duration: 0 } },
  hover: { x: "100%", transition: { duration: 1.5, ease: "easeInOut" } },
} satisfies Variants;

const fingerprintVariants = {
  rest: { rotate: 0, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  hover: {
    rotate: [0, 15, -15, 0],
    y: [0, -2, 2, 0],
    transition: { duration: 0.6, ease: "easeInOut" },
  },
} satisfies Variants;

export default function SmoothDrawer({
  title = "KokonutUI - Pro",
  description = "100+ collection of UI Components and templates built for React, Next.js, and Tailwind CSS. Spend no time on design and focus on shipping.",
  primaryButtonText = "Buy Now",
  secondaryButtonText = "Maybe Later",
  onPrimaryAction,
  primaryHref = "https://kokonutui.pro/#pricing",
  onSecondaryAction,
  price = 169,
  discountedPrice = 99,
}: SmoothDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const item = shouldReduceMotion ? reducedItemVariants : itemVariants;

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open Drawer</Button>
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-fit rounded-2xl p-6 shadow-xl data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
        <motion.div
          animate="visible"
          className="mx-auto w-full max-w-[340px] space-y-6"
          initial="hidden"
          variants={drawerVariants}
        >
          <motion.div variants={item}>
            <DrawerHeader className="space-y-2.5 px-0">
              <DrawerTitle className="flex items-center gap-2.5 font-semibold text-2xl tracking-tighter">
                {/* Spans: a heading only allows phrasing content. */}
                <motion.span className="block" variants={item}>
                  <span className="block rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 p-1.5 shadow-inner dark:from-zinc-800 dark:to-zinc-900">
                    <Image
                      alt=""
                      height={32}
                      src="https://kokonutui.com/logo.svg"
                      unoptimized
                      width={32}
                    />
                  </span>
                </motion.span>
                <motion.span variants={item}>{title}</motion.span>
              </DrawerTitle>
              <motion.div variants={item}>
                <DrawerDescription className="text-sm text-zinc-600 leading-relaxed dark:text-zinc-400">
                  {description}
                </DrawerDescription>
              </motion.div>
            </DrawerHeader>
          </motion.div>

          <motion.div variants={item}>
            <PriceTag discountedPrice={discountedPrice} price={price} />
          </motion.div>

          <motion.div variants={item}>
            <DrawerFooter className="flex flex-col gap-3 px-0">
              <motion.div
                animate="rest"
                className="w-full"
                initial="rest"
                whileHover={shouldReduceMotion ? undefined : "hover"}
              >
                <Link
                  className="group relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 font-semibold text-sm text-white shadow-lg shadow-rose-500/20 transition-[--tw-gradient-from,--tw-gradient-to,box-shadow,scale] duration-200 ease-out hover:from-rose-600 hover:to-pink-600 hover:shadow-rose-500/30 hover:shadow-xl motion-safe:active:scale-[0.97] dark:from-rose-600 dark:to-pink-600 dark:hover:from-rose-500 dark:hover:to-pink-500"
                  href={primaryHref}
                  onClick={onPrimaryAction}
                  target="_blank"
                >
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    variants={shineVariants}
                  />
                  <div className="relative flex items-center gap-2">
                    {primaryButtonText}
                    <motion.div variants={fingerprintVariants}>
                      <Fingerprint className="h-4 w-4" />
                    </motion.div>
                  </div>
                </Link>
              </motion.div>
              <DrawerClose asChild>
                <Button
                  className="h-11 w-full rounded-xl border-zinc-200 font-semibold text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800/80"
                  onClick={onSecondaryAction}
                  variant="outline"
                >
                  {secondaryButtonText}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </motion.div>
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
}
