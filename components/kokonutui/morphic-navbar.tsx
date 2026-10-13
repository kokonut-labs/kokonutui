"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";

interface NavItem {
  name: string;
}

interface MorphicNavbarProps {
  items?: Record<string, NavItem>;
  /** Initially active path. Defaults to the first item's path. */
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

export function MorphicNavbar({
  items = DEFAULT_NAV_ITEMS,
  defaultPath,
  className,
}: MorphicNavbarProps) {
  const [activePath, setActivePath] = useState(
    defaultPath ?? Object.keys(items)[0] ?? "/"
  );

  const isActiveLink = (path: string) => {
    if (path === "/") {
      return activePath === "/";
    }
    return activePath.startsWith(path);
  };

  return (
    <nav className={clsx("mx-auto max-w-4xl px-4 py-2", className)}>
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-between overflow-hidden rounded-xl">
          {Object.entries(items).map(([path, { name }], index, array) => {
            const isActive = isActiveLink(path);
            const isFirst = index === 0;
            const isLast = index === array.length - 1;
            const prevPath = index > 0 ? array[index - 1][0] : null;
            const nextPath =
              index < array.length - 1 ? array[index + 1][0] : null;
            // Next's Link scrolls the page when a hash matches no element, so
            // in-page anchors use a plain <a> and keep the browser's behaviour.
            const NavLink = path.startsWith("#") ? "a" : Link;

            return (
              <NavLink
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex items-center justify-center bg-black p-1.5 px-4 text-sm text-white transition-[margin,border-radius,font-weight] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-white dark:text-black",
                  isActive
                    ? "mx-2 rounded-xl font-semibold"
                    : clsx(
                        (isActiveLink(prevPath || "") || isFirst) &&
                          "rounded-l-xl",
                        (isActiveLink(nextPath || "") || isLast) &&
                          "rounded-r-xl"
                      )
                )}
                href={path}
                key={path}
                onClick={() => setActivePath(path)}
              >
                {name}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default MorphicNavbar;
