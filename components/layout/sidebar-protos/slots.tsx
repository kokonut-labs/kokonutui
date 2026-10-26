"use client";

import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import {
  Sidebar,
  type SidebarProps,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "fumadocs-ui/layouts/docs/slots/sidebar";
import { useSidebarProto } from "./context";
import { FilterSidebar } from "./filter-sidebar";
import { IndexSidebar } from "./index-sidebar";
import { SidebarPicker } from "./picker";
import { RailSidebar } from "./rail-sidebar";

/** Draws whichever prototype is picked, or Fumadocs' own sidebar. */
function ProtoSidebar(props: SidebarProps) {
  const { variant } = useSidebarProto();
  let sidebar = <Sidebar {...props} />;
  if (variant === "a") {
    sidebar = <IndexSidebar footer={props.footer} />;
  } else if (variant === "b") {
    sidebar = <RailSidebar footer={props.footer} />;
  } else if (variant === "c") {
    sidebar = <FilterSidebar footer={props.footer} />;
  }
  return (
    <>
      {sidebar}
      <SidebarPicker />
    </>
  );
}

const slots = {
  sidebar: {
    provider: SidebarProvider,
    root: ProtoSidebar,
    trigger: SidebarTrigger,
    useSidebar,
  },
};

/** DocsLayout with the prototype sidebar slot (slots hold functions, so client). */
export function ProtoDocsLayout(props: Omit<DocsLayoutProps, "slots">) {
  return <DocsLayout {...props} slots={slots} />;
}
