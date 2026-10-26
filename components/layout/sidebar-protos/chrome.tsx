"use client";

import { usePathname } from "fumadocs-core/framework";
import { SidebarTrigger } from "fumadocs-ui/components/sidebar/base";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { Moon, Search, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";
import {
  EASE_COLORS,
  FOCUS_INSET,
  LINE,
  MONO,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

/** Whether `url` is the page being read. */
export function useIsActive() {
  const pathname = usePathname();
  return (url: string) => pathname === url || pathname === `${url}/`;
}

/** Logo, the drawer's close button on phones, and nothing else. */
export function ProtoTitle({ className }: { className?: string }) {
  const { slots } = useDocsLayout();
  return (
    <div className={cn("flex h-14 shrink-0 items-center px-4", className)}>
      {slots.navTitle && (
        <slots.navTitle className="me-auto inline-flex items-center gap-2.5 font-medium text-[15px]" />
      )}
      <SidebarTrigger
        className={cn(
          "-me-1.5 grid size-8 place-items-center text-black/50 hover:text-black md:hidden dark:text-white/50 dark:hover:text-white",
          EASE_COLORS,
          FOCUS_INSET
        )}
      >
        <X aria-hidden className="size-4" />
      </SidebarTrigger>
    </div>
  );
}

/** Opens the search dialog. Square, hairline, the shortcut in mono. */
export function SearchRow({
  className,
  label = "Search",
}: {
  className?: string;
  label?: ReactNode;
}) {
  const { setOpenSearch, hotKey } = useSearchContext();
  return (
    <button
      className={cn(
        "flex h-9 w-full items-center gap-2 border px-2.5 text-[13.5px] text-black/50 hover:border-black/25 hover:text-black/80 dark:text-white/50 dark:hover:border-white/30 dark:hover:text-white/80",
        LINE,
        EASE_COLORS,
        FOCUS_INSET,
        className
      )}
      onClick={() => setOpenSearch(true)}
      type="button"
    >
      <Search aria-hidden className="size-3.5" />
      <span className="me-auto">{label}</span>
      <span className={cn(MONO, "flex gap-1 text-[10.5px]")}>
        {hotKey.map((key, i) => (
          <kbd key={typeof key.key === "string" ? key.key : i}>
            {key.display}
          </kbd>
        ))}
      </span>
    </button>
  );
}

function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const options = [
    { id: "light", label: "Light theme", Icon: Sun },
    { id: "dark", label: "Dark theme", Icon: Moon },
  ] as const;
  return (
    <div className={cn("flex border", LINE)}>
      {options.map(({ id, label, Icon }) => {
        const active = mounted && resolvedTheme === id;
        return (
          <button
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "grid size-7 place-items-center",
              active
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white",
              EASE_COLORS,
              FOCUS_INSET
            )}
            key={id}
            onClick={() => setTheme(id)}
            type="button"
          >
            <Icon aria-hidden className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

/** Social links and the theme on one hairline row, then the Pro card. */
export function ProtoFooter({ footer }: { footer?: ReactNode }) {
  const { menuItems } = useDocsLayout();
  const icons = menuItems.filter((item) => item.type === "icon");
  return (
    <div className={cn("shrink-0 border-t p-4 pt-3", LINE)}>
      <div className="flex items-center gap-1">
        {icons.map((item) =>
          item.type === "icon" ? (
            <a
              aria-label={item.label ?? item.text?.toString()}
              className={cn(
                "grid size-7 place-items-center text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white [&_svg]:size-3.5",
                EASE_COLORS,
                FOCUS_INSET
              )}
              href={item.url}
              key={item.url}
              rel="noopener"
              target="_blank"
            >
              {item.icon}
            </a>
          ) : null
        )}
        <span className="ms-auto">
          <ThemeSwitch />
        </span>
      </div>
      {footer}
    </div>
  );
}
