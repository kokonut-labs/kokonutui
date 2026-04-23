"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT, STAGGER } from "@/lib/animation-presets";
import Motion from "../icons/motion";
import Nextjs from "../icons/nextjs";
import ReactIcon from "../icons/react";
import ShadcnIcon from "../icons/shadcn";
import TailwindCSS from "../icons/tailwindcss";
import FeatureCard from "./feature-card";

type FeatureCardData = {
  image?: {
    src: string;
    alt: string;
  };
  video?: {
    src: string;
    poster?: string;
  };
  title: string;
  number?: string;
  description: string;
  href: string;
  tags?: string[];
};

type FeatureCardsGridProps = {
  title: string;
  description: string;
  cards: FeatureCardData[];
};

const FeatureCardsGrid = ({
  title,
  description,
  cards,
}: FeatureCardsGridProps) => {
  const reduceMotion = useReducedMotion();
  const fadeUpInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <motion.div
        className="mb-12 space-y-4 text-left sm:mb-16"
        initial={fadeUpInitial}
        transition={{ duration: DURATION.marketing, ease: EASE_OUT }}
        viewport={{ once: true, margin: "-100px" }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <motion.h2
          className="max-w-5xl font-bold text-2xl text-black tracking-tight sm:text-3xl lg:text-4xl dark:text-white"
          initial={fadeUpInitial}
          transition={{
            duration: DURATION.marketing,
            delay: STAGGER.base,
            ease: EASE_OUT,
          }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {title}
        </motion.h2>
        <motion.p
          className="max-w-5xl text-base text-black/70 tracking-tight sm:text-lg dark:text-white/70"
          initial={fadeUpInitial}
          transition={{
            duration: DURATION.marketing,
            delay: STAGGER.base * 2,
            ease: EASE_OUT,
          }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {description}
        </motion.p>
        <motion.div
          className="mb-6 flex items-center justify-start pt-2 sm:justify-end"
          initial={fadeUpInitial}
          transition={{
            duration: DURATION.marketing,
            delay: STAGGER.base * 3,
            ease: EASE_OUT,
          }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-wrap items-center gap-3 text-black/60 text-sm tracking-tight dark:text-white/60">
            <span className="flex items-center gap-2 font-medium">
              Built with
            </span>
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <Nextjs className="h-4 w-4" />
              <span className="hidden sm:inline">Next.js</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <ReactIcon className="h-4 w-4" />
              <span className="hidden sm:inline">React</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <TailwindCSS className="h-4 w-4" />
              <span className="hidden sm:inline">Tailwind</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <Motion className="h-4 w-4" />
              <span className="hidden sm:inline">Motion</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <ShadcnIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Shadcn</span>
            </span>
          </div>
        </motion.div>
      </motion.div>
      <div className="relative">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {cards.map((card, index) => (
              <motion.div
                className="relative h-full"
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -12, scale: 0.97 }
                }
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 24, scale: 0.97 }
                }
                key={`${card.title}-${index}`}
                layout
                style={{ zIndex: 10 }}
                transition={{
                  duration: DURATION.marketing,
                  delay: index * STAGGER.relaxed,
                  ease: EASE_OUT,
                }}
                viewport={{ once: true, margin: "-50px" }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
              >
                <FeatureCard
                  description={card.description}
                  href={card.href}
                  image={card.image}
                  number={card.number}
                  tags={card.tags}
                  title={card.title}
                  video={card.video}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default FeatureCardsGrid;
