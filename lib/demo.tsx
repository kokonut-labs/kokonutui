import type { ComponentProps } from "react";
import { LazyDemo } from "@/components/mdx/lazy-demo";

/**
 * A docs demo that loads its component only where it renders. MDX imports of
 * `@/components/kokonutui/*` and `@/components/mdx/demos/*` are rewritten to
 * this at build time by `lib/mdx/remark-lazy-demos.ts`.
 */
export function demo(path: string) {
  function Demo(props: Omit<ComponentProps<typeof LazyDemo>, "demo">) {
    return <LazyDemo demo={path} {...props} />;
  }
  Demo.displayName = `Demo(${path})`;
  return Demo;
}
