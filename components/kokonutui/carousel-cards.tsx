"use client";

/**
 * @author: @dorianbaffier
 * @description: Carousel Cards
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronLeft, ChevronRight, Heart, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ExperienceItem {
  id: string;
  title: string;
  image: string;
  location: string;
  price: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  date?: string;
  href?: string;
}

export type ToggleFavorite = (id: string, favorite: boolean) => void;

export interface ExperienceSectionProps {
  title: string;
  items: ExperienceItem[];
  viewAllHref?: string;
  onToggleFavorite?: ToggleFavorite;
}

const sampleExperiences: ExperienceItem[] = [
  {
    id: "1",
    title: "Become an Otaku Hottie with Megan Thee Stallion",
    image:
      "https://images.unsplash.com/photo-1615571022219-eb45cf7faa9d?w=600&auto=format&fit=crop&q=80",
    location: "Los Angeles, United States",
    price: 120,
    currency: "€",
    rating: 4.97,
    reviewCount: 128,
    badge: "Original",
    date: "Closes May 21",
  },
  {
    id: "2",
    title: "Spend a Sunday Funday with Patrick Mahomes",
    image:
      "https://images.unsplash.com/photo-1622127922040-13cab637ee78?w=600&auto=format&fit=crop&q=80",
    location: "Kansas City, United States",
    price: 150,
    currency: "€",
    rating: 4.92,
    reviewCount: 86,
    badge: "Original",
    date: "Closes Today",
  },
  {
    id: "3",
    title: "Celebrate with SEVENTEEN on their 10th anniversary",
    image:
      "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=600&auto=format&fit=crop&q=80",
    location: "Seoul, South Korea",
    price: 200,
    currency: "€",
    rating: 4.98,
    reviewCount: 254,
    badge: "Original",
    date: "Closed May 17",
  },
  {
    id: "4",
    title: "Learn the secrets of French pastry with nonnas",
    image:
      "https://images.unsplash.com/photo-1604999333679-b86d54738315?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 70,
    currency: "€",
    rating: 4.97,
    reviewCount: 112,
    badge: "Original",
  },
  {
    id: "5",
    title: "Uncover the world of cabaret with a burlesque show",
    image:
      "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 92,
    currency: "€",
    rating: 4.9,
    reviewCount: 78,
    badge: "Original",
  },
  {
    id: "6",
    title: "The Super Powers of Art-family Game at the Louvre",
    image:
      "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 90,
    currency: "€",
    rating: 4.98,
    reviewCount: 146,
    badge: "Original",
  },
  {
    id: "7",
    title: "Savor tasty vegan pastries with a plant-based pro",
    image:
      "https://images.unsplash.com/photo-1608830597604-619220679440?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 75,
    currency: "€",
    rating: 4.95,
    reviewCount: 92,
    badge: "Original",
  },
];

const popularExperiences: ExperienceItem[] = [
  {
    id: "p1",
    title: "Learn to bake the French Croissant",
    image:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 95,
    currency: "€",
    rating: 4.95,
    reviewCount: 218,
    badge: "Popular",
  },
  {
    id: "p2",
    title: "Seek out hidden speakeasy bars in the city",
    image:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 74,
    currency: "€",
    rating: 4.9,
    reviewCount: 165,
    badge: "Popular",
  },
  {
    id: "p3",
    title: "Versailles Food and Palace Bike Tour",
    image:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
    location: "Versailles, France",
    price: 122,
    currency: "€",
    rating: 4.97,
    reviewCount: 89,
    badge: "Popular",
  },
  {
    id: "p4",
    title: "Haunted Paris Tour - Ghosts, Legends, True Crime",
    image:
      "https://images.unsplash.com/photo-1549144511-f099e773c147?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 25,
    currency: "€",
    rating: 4.98,
    reviewCount: 345,
    badge: "Popular",
  },
  {
    id: "p5",
    title: "Learn to make the French macarons with a chef",
    image:
      "https://images.unsplash.com/photo-1558326567-98ae2405596b?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 110,
    currency: "€",
    rating: 4.95,
    reviewCount: 203,
    badge: "Popular",
  },
  {
    id: "p6",
    title: "No Diet Club - Best food tour in Le Marais",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 65,
    currency: "€",
    rating: 4.92,
    reviewCount: 178,
    badge: "5 spots left",
  },
  {
    id: "p7",
    title: "Soak up the nightlife of Paris",
    image:
      "https://images.unsplash.com/photo-1546636889-ba9fdd63583e?w=600&auto=format&fit=crop&q=80",
    location: "Paris, France",
    price: 20,
    currency: "€",
    rating: 4.94,
    reviewCount: 112,
    badge: "Popular",
  },
];

const FavoriteButton = ({
  id,
  onToggleFavorite,
}: {
  id: string;
  onToggleFavorite?: ToggleFavorite;
}) => {
  const [isFavorite, setIsFavorite] = React.useState(false);

  const handleClick = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    onToggleFavorite?.(id, next);
  };

  return (
    <Button
      aria-pressed={isFavorite}
      className="absolute top-2 right-2 z-10 rounded-full bg-white/80 text-neutral-700 backdrop-blur-sm transition-[color,background-color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white/90 hover:text-black motion-safe:active:scale-[0.97]"
      onClick={handleClick}
      size="icon"
      variant="ghost"
    >
      <Heart
        className={cn(
          "h-4 w-4 stroke-[2px]",
          isFavorite && "fill-rose-500 text-rose-500"
        )}
      />
      <span className="sr-only">Favorite</span>
    </Button>
  );
};

// The title link is stretched over the whole card (`after:inset-0`), so the
// card stays clickable while the favorite button sits outside the link.
const ExperienceCard = ({
  experience,
  onToggleFavorite,
}: {
  experience: ExperienceItem;
  onToggleFavorite?: ToggleFavorite;
}) => (
  <Card className="group relative flex h-[320px] w-full flex-col overflow-hidden rounded-xl border-0 shadow-sm hover:shadow-md">
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl">
      <Image
        alt=""
        className="object-cover transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:group-hover:scale-105"
        fill
        sizes="(min-width: 768px) 260px, 240px"
        src={experience.image}
        unoptimized
      />
      <FavoriteButton id={experience.id} onToggleFavorite={onToggleFavorite} />
      {experience.badge && (
        <Badge className="absolute top-2 left-2 rounded-md bg-white/90 px-1.5 py-0.5 font-medium text-black text-xs">
          {experience.badge}
        </Badge>
      )}
    </div>

    <div className="flex flex-1 flex-col justify-between">
      <CardContent className="p-2 pt-3 pb-0">
        <h3 className="font-medium text-sm tracking-tight">
          <Link
            className="after:absolute after:inset-0 focus-visible:outline-hidden"
            href={experience.href ?? "#"}
          >
            {experience.title}
          </Link>
        </h3>
        <p className="text-muted-foreground text-xs tracking-tight">
          {experience.location}
        </p>
        {experience.date && (
          <p className="text-muted-foreground text-xs tracking-tight">
            {experience.date}
          </p>
        )}
      </CardContent>

      <CardFooter className="mt-auto flex items-center gap-0.5 p-2 pt-0 text-xs">
        {experience.rating !== undefined && (
          <span className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-current" />
            {experience.rating}
          </span>
        )}
        {experience.reviewCount !== undefined && experience.reviewCount > 0 && (
          <span className="text-muted-foreground text-xs tracking-tight">
            {experience.rating !== undefined && "·"}
            {` (${experience.reviewCount})`}
          </span>
        )}
        <span className="ml-auto text-xs tracking-tight">
          {experience.currency || "€"} {experience.price} / guest
        </span>
      </CardFooter>
    </div>
  </Card>
);

// `aria-disabled` rather than `disabled` at the ends, so a keyboard user who
// scrolls to the end keeps focus on the button.
const ARROW_BUTTON_CLASS =
  "h-7 w-7 rounded-full border-neutral-200 transition-[color,background-color,opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-neutral-100 motion-safe:active:scale-[0.97] aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-neutral-900";

export const ExperienceSection = ({
  title,
  items,
  viewAllHref = "#",
  onToggleFavorite,
}: ExperienceSectionProps) => {
  const scrollContainer = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const updateEdges = React.useCallback(() => {
    const el = scrollContainer.current;
    if (!el) {
      return;
    }
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = scrollContainer.current;
    if (!el) {
      return;
    }
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges]);

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollContainer.current;
    if (!el) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    el.scrollBy({
      left: direction * el.clientWidth * 0.9,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="w-full py-4">
      <div className="mx-auto max-w-[1760px] px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium text-lg tracking-tight md:text-xl">
            {title}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              aria-disabled={atStart}
              className={ARROW_BUTTON_CLASS}
              onClick={() => scrollByPage(-1)}
              size="icon"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Scroll left</span>
            </Button>
            <Button
              aria-disabled={atEnd}
              className={ARROW_BUTTON_CLASS}
              onClick={() => scrollByPage(1)}
              size="icon"
              variant="outline"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Scroll right</span>
            </Button>
            <Link
              className="ml-1 hidden font-medium text-xs hover:underline md:block"
              href={viewAllHref}
            >
              Show all
            </Link>
          </div>
        </div>

        <div
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={updateEdges}
          ref={scrollContainer}
        >
          {items.map((item) => (
            <div
              className="w-[240px] flex-none snap-start rounded-xl has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary has-[a:focus-visible]:ring-offset-2 md:w-[260px]"
              key={item.id}
            >
              <ExperienceCard
                experience={item}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function CarouselCards({
  onToggleFavorite,
}: {
  /** Called when a card's heart is toggled, with the item id and new state. */
  onToggleFavorite?: ToggleFavorite;
}) {
  return (
    <div className="mt-4 w-full space-y-4">
      <ExperienceSection
        items={sampleExperiences}
        onToggleFavorite={onToggleFavorite}
        title="Airbnb Originals ›"
        viewAllHref="#"
      />
      <ExperienceSection
        items={popularExperiences}
        onToggleFavorite={onToggleFavorite}
        title="Popular experiences in Paris"
        viewAllHref="#"
      />
    </div>
  );
}
