"use client";

import {
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  Suspense,
} from "react";

type Demo = LazyExoticComponent<ComponentType<Record<string, unknown>>>;

const KOKONUTUI = "kokonutui/";
const DEMOS = "mdx/demos/";

// One lazy component per demo, so each loads once however often it renders.
const loaded = new Map<string, Demo>();

function load(path: string): Demo {
  let Component = loaded.get(path);
  if (!Component) {
    // Template imports give every file in the folder its own chunk, loaded
    // on first render instead of shipping with the page.
    Component = lazy(() =>
      path.startsWith(DEMOS)
        ? import(`@/components/mdx/demos/${path.slice(DEMOS.length)}`)
        : import(`@/components/kokonutui/${path.slice(KOKONUTUI.length)}`)
    );
    loaded.set(path, Component);
  }
  return Component;
}

/** A docs demo's component, loaded where it renders. See `lib/demo.tsx`. */
export function LazyDemo({
  demo,
  ...props
}: { demo: string } & Record<string, unknown>) {
  const Component = load(demo);
  return (
    <Suspense fallback={null}>
      <Component {...props} />
    </Suspense>
  );
}
