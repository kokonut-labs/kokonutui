"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
}

interface MorphicNavbarProps {
  items?: Record<string, NavItem>;
  /**
   * Initially active path. Defaults to the first item's path. When an item's
   * path matches the current route, that item is active instead.
   */
  defaultPath?: string;
  className?: string;
}

// The demo links to in-page anchors so it never navigates away. Use route
// paths ("/", "/works", ...) as keys in a real app.
const DEFAULT_NAV_ITEMS: Record<string, NavItem> = {
  "#home": { name: "home" },
  "#works": { name: "works" },
  "#blog": { name: "blog" },
  "#about": { name: "about" },
};

const matchesPath = (path: string, current: string) =>
  path === current || (path !== "/" && current.startsWith(`${path}/`));

/** The longest item path that matches, so "/docs/a" beats "/docs". */
const findItemPath = (paths: string[], current: string | null) => {
  let match: string | undefined;
  for (const path of paths) {
    if (
      current &&
      matchesPath(path, current) &&
      (!match || path.length > match.length)
    ) {
      match = path;
    }
  }
  return match;
};

export function MorphicNavbar({
  items = DEFAULT_NAV_ITEMS,
  defaultPath,
  className,
}: MorphicNavbarProps) {
  const entries = Object.entries(items);
  const paths = entries.map(([path]) => path);
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(
    () => findItemPath(paths, pathname) ?? defaultPath ?? paths[0] ?? "/"
  );

  // Follow the route when it changes to one of the items, so the active link
  // stays right after the back button or navigation from elsewhere. Clicks
  // still update it right away. In-page anchors (the demo) never match.
  const [syncedPathname, setSyncedPathname] = useState(pathname);
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname);
    const routePath = findItemPath(paths, pathname);
    if (routePath) {
      setActivePath(routePath);
    }
  }

  const activeIndex = paths.indexOf(findItemPath(paths, activePath) ?? "");

  return (
    <nav className={cn("mx-auto max-w-4xl px-4 py-2", className)}>
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-between overflow-hidden rounded-xl">
          {entries.map(([path, { name }], index) => {
            const isActive = index === activeIndex;
            const isFirst = index === 0;
            const isLast = index === entries.length - 1;
            // Next's Link scrolls the page when a hash matches no element, so
            // in-page anchors use a plain <a> and keep the browser's behaviour.
            const NavLink = path.startsWith("#") ? "a" : Link;

            return (
              <NavLink
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center bg-black p-1.5 px-4 text-sm text-white outline-hidden transition-[margin,border-radius,font-weight] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset motion-reduce:transition-none dark:bg-white dark:text-black dark:focus-visible:ring-black/80",
                  isActive
                    ? "mx-2 rounded-xl font-semibold"
                    : cn(
                        (isFirst || index === activeIndex + 1) &&
                          "rounded-l-xl",
                        (isLast || index === activeIndex - 1) && "rounded-r-xl"
                      )
                )}
                href={path}
                key={path}
                onClick={() => setActivePath(path)}
              >
                {/* The hidden bold copy reserves the active width, so the
                    weight change does not resize the link. */}
                <span className="grid text-center">
                  <span className="col-start-1 row-start-1">{name}</span>
                  <span
                    aria-hidden="true"
                    className="invisible col-start-1 row-start-1 font-semibold"
                  >
                    {name}
                  </span>
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default MorphicNavbar;
