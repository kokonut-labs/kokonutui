"use client";

import {
  SidebarContent,
  SidebarDrawerContent,
  SidebarDrawerOverlay,
} from "fumadocs-ui/components/sidebar/base";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The frame every prototype shares: a sticky column on desktop and a drawer
 * on phones, both drawn on the page's own white with one hairline, like the
 * catalog. `wide` makes room for the rail prototype.
 */
export function ProtoShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <>
      <SidebarContent>
        {({ ref, collapsed: _collapsed, hovered: _hovered, ...rest }) => (
          <div
            className={cn(
              "pointer-events-none sticky top-(--fd-docs-row-1) z-20 h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] [grid-area:sidebar] *:pointer-events-auto max-md:hidden",
              wide
                ? "md:layout:[--fd-sidebar-width:296px]"
                : "md:layout:[--fd-sidebar-width:268px]"
            )}
            data-sidebar-placeholder=""
          >
            <aside
              className="absolute inset-y-0 start-0 flex w-full flex-col border-black/[0.13] border-e bg-white text-sm dark:border-white/[0.14] dark:bg-black"
              id="nd-sidebar"
              ref={ref}
              {...rest}
            >
              {children}
            </aside>
          </div>
        )}
      </SidebarContent>
      <SidebarDrawerOverlay className="fixed inset-0 z-40 bg-black/20 data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in dark:bg-black/50" />
      <SidebarDrawerContent className="fixed inset-y-0 end-0 z-40 flex w-[88%] max-w-[380px] flex-col border-black/[0.13] border-s bg-white text-[15px] data-[state=closed]:animate-fd-sidebar-out data-[state=open]:animate-fd-sidebar-in dark:border-white/[0.14] dark:bg-black">
        {children}
      </SidebarDrawerContent>
    </>
  );
}
