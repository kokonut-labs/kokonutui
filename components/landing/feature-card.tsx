"use client";

import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DURATION } from "@/lib/animation-presets";
import { cn } from "@/lib/utils";

type FeatureCardProps = {
  icon?: React.ReactNode;
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
  className?: string;
};

const FeatureCard = ({
  image,
  video,
  title,
  number,
  description,
  href,
  tags,
  className,
}: FeatureCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    if (isHovered) {
      videoRef.current.play().catch(() => {
        // Handle any autoplay errors silently
      });
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered]);

  return (
    <motion.div
      className="h-full"
      id={`feature-card-${title}`}
      onHoverEnd={() => setIsHovered(false)}
      onHoverStart={() => setIsHovered(true)}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      whileHover={reduceMotion ? undefined : { y: -5 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
    >
      <Link
        aria-label={`${title} - ${description}${
          tags?.length ? `. Tags: ${tags.join(", ")}` : ""
        }`}
        className={cn(
          "group relative flex flex-col gap-4 rounded-xl p-4",
          "transition-[border-color,box-shadow,background-color] duration-200 ease-out",
          "bg-gradient-to-b from-card to-card",
          "border border-primary/5",
          "before:absolute before:inset-0 before:rounded-xl",
          "before:bg-gradient-to-b before:from-primary/5 before:to-transparent",
          "before:opacity-0 before:transition-opacity before:duration-200",
          "after:absolute after:inset-0 after:z-[-1] after:rounded-xl after:bg-card",
          "hover:border-primary/30",
          "hover:shadow-lg hover:shadow-primary/5",
          "hover:bg-primary/[0.02]",
          "before:hover:opacity-100",
          "flex h-full flex-col",
          className
        )}
        href={href}
        rel="noreferrer"
        tabIndex={0}
        target="_blank"
      >
        <div className="relative z-10 flex h-full flex-col gap-4">
          {video?.src ? (
            <div className="relative h-48 w-full overflow-hidden rounded-lg">
              <motion.div
                className="h-full w-full"
                transition={{ duration: DURATION.slow }}
                whileHover={reduceMotion ? undefined : { scale: 1.04 }}
              >
                <video
                  className="h-full w-full object-cover"
                  loop
                  muted
                  playsInline
                  poster={video.poster}
                  ref={videoRef}
                  src={video.src}
                />
              </motion.div>
            </div>
          ) : image?.src ? (
            <div className="relative h-48 w-full overflow-hidden rounded-lg">
              <motion.div
                className="relative h-full w-full"
                transition={{ duration: DURATION.slow }}
                whileHover={reduceMotion ? undefined : { scale: 1.04 }}
              >
                <Image
                  alt={image.alt}
                  className="object-contain p-2"
                  fill
                  loading="eager"
                  quality={90}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src={image.src || "/placeholder-image.jpg"}
                />
              </motion.div>
            </div>
          ) : (
            <div className="relative flex h-48 w-full items-center justify-center rounded-lg border border-primary/10 bg-primary/5">
              <span className="font-semibold text-2xl text-primary">
                {title}
              </span>
            </div>
          )}
          <div className="flex flex-1 flex-col space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="line-clamp-1 font-semibold tracking-tighter transition-colors duration-300 group-hover:text-primary">
                  {title}
                </h3>
                {number && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {number} components
                  </span>
                )}
              </div>
              <div className="text-black opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-white">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>
            <p className="line-clamp-2 text-muted-foreground text-sm tracking-tighter">
              {description}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default FeatureCard;
