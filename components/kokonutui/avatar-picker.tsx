"use client";

/**
 * @author: @dorianbaffier
 * @description: Avatar Picker
 * @version: 2.0.0
 * @date: 2026-02-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, ChevronRight, User2 } from "lucide-react";
import type { Variants } from "motion/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Avatar {
  id: number;
  svg: ReactNode;
  alt: string;
  /** "r, g, b" of the color ring shown around the selected avatar. */
  color: string;
}

const avatars: Avatar[] = [
  {
    id: 1,
    svg: (
      <svg
        aria-label="Avatar 1"
        fill="none"
        height="40"
        role="img"
        viewBox="0 0 36 36"
        width="40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Avatar 1</title>
        <g>
          <rect fill="#ff005b" height="36" width="36" />
          <rect
            fill="#ffb238"
            height="36"
            rx="6"
            transform="translate(9 -5) rotate(219 18 18) scale(1)"
            width="36"
            x="0"
            y="0"
          />
          <g transform="translate(4.5 -4) rotate(9 18 18)">
            <path
              d="M15 19c2 1 4 1 6 0"
              fill="none"
              stroke="#000000"
              strokeLinecap="round"
            />
            <rect
              fill="#000000"
              height="2"
              rx="1"
              stroke="none"
              width="1.5"
              x="10"
              y="14"
            />
            <rect
              fill="#000000"
              height="2"
              rx="1"
              stroke="none"
              width="1.5"
              x="24"
              y="14"
            />
          </g>
        </g>
      </svg>
    ),
    alt: "Avatar 1",
    color: "255, 0, 91",
  },
  {
    id: 2,
    svg: (
      <svg
        aria-label="Avatar 2"
        fill="none"
        height="40"
        role="img"
        viewBox="0 0 36 36"
        width="40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Avatar 2</title>
        <g>
          <rect fill="#ff7d10" height="36" width="36" />
          <rect
            fill="#0a0310"
            height="36"
            rx="6"
            transform="translate(5 -1) rotate(55 18 18) scale(1.1)"
            width="36"
            x="0"
            y="0"
          />
          <g transform="translate(7 -6) rotate(-5 18 18)">
            <path
              d="M15 20c2 1 4 1 6 0"
              fill="none"
              stroke="#FFFFFF"
              strokeLinecap="round"
            />
            <rect
              fill="#FFFFFF"
              height="2"
              rx="1"
              stroke="none"
              width="1.5"
              x="14"
              y="14"
            />
            <rect
              fill="#FFFFFF"
              height="2"
              rx="1"
              stroke="none"
              width="1.5"
              x="20"
              y="14"
            />
          </g>
        </g>
      </svg>
    ),
    alt: "Avatar 2",
    color: "255, 125, 16",
  },
  {
    id: 3,
    svg: (
      <svg
        aria-label="Avatar 3"
        fill="none"
        height="40"
        role="img"
        viewBox="0 0 36 36"
        width="40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Avatar 3</title>
        <g>
          <rect fill="#0a0310" height="36" width="36" />
          <rect
            fill="#ff005b"
            height="36"
            rx="36"
            transform="translate(-3 7) rotate(227 18 18) scale(1.2)"
            width="36"
            x="0"
            y="0"
          />
          <g transform="translate(-3 3.5) rotate(7 18 18)">
            <path d="M13,21 a1,0.75 0 0,0 10,0" fill="#FFFFFF" />
            <rect
              fill="#FFFFFF"
              height="2"
              rx="1"
              stroke="none"
              width="1.5"
              x="12"
              y="14"
            />
            <rect
              fill="#FFFFFF"
              height="2"
              rx="1"
              stroke="none"
              width="1.5"
              x="22"
              y="14"
            />
          </g>
        </g>
      </svg>
    ),
    alt: "Avatar 3",
    color: "255, 0, 91",
  },
  {
    id: 4,
    svg: (
      <svg
        aria-label="Avatar 4"
        fill="none"
        height="40"
        role="img"
        viewBox="0 0 36 36"
        width="40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Avatar 4</title>
        <g>
          <rect fill="#d8fcb3" height="36" width="36" />
          <rect
            fill="#89fcb3"
            height="36"
            rx="6"
            transform="translate(9 -5) rotate(219 18 18) scale(1)"
            width="36"
            x="0"
            y="0"
          />
          <g transform="translate(4.5 -4) rotate(9 18 18)">
            <path
              d="M15 19c2 1 4 1 6 0"
              fill="none"
              stroke="#000000"
              strokeLinecap="round"
            />
            <rect
              fill="#000000"
              height="2"
              rx="1"
              stroke="none"
              width="1.5"
              x="10"
              y="14"
            />
            <rect
              fill="#000000"
              height="2"
              rx="1"
              stroke="none"
              width="1.5"
              x="24"
              y="14"
            />
          </g>
        </g>
      </svg>
    ),
    alt: "Avatar 4",
    color: "137, 252, 179",
  },
];

interface AvatarPickerProps {
  onComplete?: (data: { username: string; avatarId: number }) => void;
  className?: string;
}

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const containerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

// Only `y` here: animating opacity would leave an inline `opacity: 1` that
// overrides the dimmed `opacity-50` of unselected thumbnails.
const thumbnailVariants: Variants = {
  initial: { y: 6 },
  animate: {
    y: 0,
    transition: { duration: 0.28, ease: EASE_OUT },
  },
};

export default function AvatarPicker({
  onComplete,
  className,
}: AvatarPickerProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar>(avatars[0]);
  const [username, setUsername] = useState("");
  const shouldReduceMotion = useReducedMotion();
  const inputId = useId();

  const handleAvatarSelect = (avatar: Avatar) => {
    if (avatar.id === selectedAvatar.id) {
      return;
    }
    setSelectedAvatar(avatar);
  };

  const handleSubmit = () => {
    if (username.trim() && onComplete) {
      onComplete({
        username: username.trim(),
        avatarId: selectedAvatar.id,
      });
    }
  };

  const isValid = username.trim().length >= USERNAME_MIN_LENGTH;
  const showError =
    username.trim().length > 0 && username.trim().length < USERNAME_MIN_LENGTH;

  return (
    <Card
      className={cn(
        "relative mx-auto w-full max-w-[400px] border-border bg-card",
        className
      )}
    >
      <CardContent className="p-8">
        <div className="space-y-8">
          <div className="space-y-1 text-center">
            <h2 className="font-semibold text-xl tracking-tight">
              Pick Your Avatar
            </h2>
            <p className="text-muted-foreground text-sm">
              Choose one to get started
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            {/*
             * The color rings sit outside the clipping circle so their
             * box-shadow isn't cut off. Each avatar has its own static ring
             * and only its opacity transitions, so no box-shadow animates.
             */}
            <div className="relative h-40 w-40">
              {avatars.map((avatar) => (
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-full transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    avatar.id === selectedAvatar.id
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                  key={avatar.id}
                  style={{
                    boxShadow: `0 0 0 2px rgba(${avatar.color}, 0.55), 0 6px 24px rgba(${avatar.color}, 0.18)`,
                  }}
                />
              ))}

              <div className="relative h-full w-full overflow-hidden rounded-full">
                <AnimatePresence>
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    key={selectedAvatar.id}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { duration: 0.18, ease: EASE_OUT }
                    }
                  >
                    {/* scale-[4]: 40px SVG × 4 = 160px, fills the circle */}
                    <div className="scale-[4]">{selectedAvatar.svg}</div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="grid place-items-center">
              <AnimatePresence>
                <motion.span
                  animate={{ opacity: 1 }}
                  className="col-start-1 row-start-1 text-[11px] text-muted-foreground uppercase tracking-[0.12em]"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key={selectedAvatar.id}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.16, ease: EASE_OUT }
                  }
                >
                  {selectedAvatar.alt}
                </motion.span>
              </AnimatePresence>
            </div>

            <motion.div
              animate="animate"
              className="flex gap-3"
              initial="initial"
              variants={containerVariants}
            >
              {avatars.map((avatar) => {
                const isSelected = selectedAvatar.id === avatar.id;
                return (
                  <motion.button
                    aria-label={`Select ${avatar.alt}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative h-14 w-14 overflow-hidden rounded-xl border bg-muted transition-[opacity,box-shadow] duration-200 ease-out",
                      isSelected
                        ? "border-foreground/20 opacity-100 ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
                        : "border-border opacity-50 hover:opacity-100"
                    )}
                    key={avatar.id}
                    onClick={() => handleAvatarSelect(avatar)}
                    type="button"
                    variants={thumbnailVariants}
                    whileHover={shouldReduceMotion ? {} : { scale: 1.06 }}
                    whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="scale-[2.3]">{avatar.svg}</div>
                    </div>
                    {isSelected && (
                      <div className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                        <Check
                          aria-hidden="true"
                          className="h-3 w-3 text-background"
                        />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-medium text-sm" htmlFor={inputId}>
                  Username
                </label>
                <span
                  className={cn(
                    "text-xs tabular-nums transition-colors duration-200 ease-out",
                    username.length >= USERNAME_MAX_LENGTH - 2
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-muted-foreground/50"
                  )}
                >
                  {username.length}/{USERNAME_MAX_LENGTH}
                </span>
              </div>

              <div className="group relative">
                <Input
                  autoComplete="username"
                  className={cn(
                    "h-10 pl-9 text-sm",
                    showError &&
                      "border-destructive/50 focus-visible:ring-destructive"
                  )}
                  id={inputId}
                  maxLength={USERNAME_MAX_LENGTH}
                  name="username"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username…"
                  spellCheck={false}
                  type="text"
                  value={username}
                />
                <User2
                  aria-hidden="true"
                  className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200 ease-out group-focus-within:text-foreground"
                />
              </div>

              <AnimatePresence>
                {showError && (
                  <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="ml-0.5 text-destructive text-xs"
                    exit={{ opacity: 0, y: -4 }}
                    initial={{ opacity: 0, y: -4 }}
                    role="alert"
                    transition={{ duration: 0.15, ease: EASE_OUT }}
                  >
                    Username must be at least {USERNAME_MIN_LENGTH} characters
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <Button
              className="group h-10 w-full text-sm"
              disabled={!isValid}
              onClick={handleSubmit}
              type="button"
            >
              Get Started
              <ChevronRight
                aria-hidden="true"
                className="ml-1 h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
              />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
