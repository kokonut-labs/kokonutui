import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { type NextRequest, NextResponse, userAgent } from "next/server";
import {
  CANVAS_SHARE,
  HOME_TEST_COOKIE,
  HOME_VERSIONS,
  type HomeVersion,
} from "@/lib/home-test";

const { rewrite: rewriteLLM } = rewritePath(
  "/docs{/*path}",
  "/llms.mdx/docs{/*path}"
);

const MONTH = 60 * 60 * 24 * 30;

/**
 * The homepage test. A new desktop visitor is dealt a version and keeps it;
 * the canvas is served at / from /canvas. Phones, tablets and crawlers get
 * the current homepage and stay out of the test, as "off". `?home=canvas`
 * or `?home=current` picks a version by hand.
 */
function homeTest(request: NextRequest) {
  if (CANVAS_SHARE <= 0) {
    return NextResponse.next();
  }
  const asked = request.nextUrl.searchParams.get("home");
  const kept = request.cookies.get(HOME_TEST_COOKIE)?.value;
  let version: HomeVersion | "off" | undefined;
  if (HOME_VERSIONS.includes(asked as HomeVersion)) {
    version = asked as HomeVersion;
  } else if (kept === "off" || HOME_VERSIONS.includes(kept as HomeVersion)) {
    version = kept as HomeVersion | "off";
  } else {
    const { isBot, device } = userAgent(request);
    if (isBot) {
      return NextResponse.next();
    }
    if (device.type === "mobile" || device.type === "tablet") {
      version = "off";
    } else {
      version = Math.random() < CANVAS_SHARE ? "canvas" : "current";
    }
  }

  const response =
    version === "canvas"
      ? NextResponse.rewrite(new URL("/canvas", request.url))
      : NextResponse.next();
  if (version !== kept) {
    response.cookies.set(HOME_TEST_COOKIE, version, {
      maxAge: MONTH,
      path: "/",
      sameSite: "lax",
    });
  }
  return response;
}

/**
 * Content negotiation for AI agents: a client that asks for `text/markdown`
 * on a normal docs URL gets the clean Markdown version, without needing to
 * know about the `.md` suffix convention.
 */
export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return homeTest(request);
  }

  if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);

    if (result) {
      // No `Vary: Accept` here: Next overwrites `Vary` on App Router page
      // responses with its own router values, and it does the same to a
      // `headers()` entry in next.config.mjs. The HTML variant is prerendered
      // and always answers without `Accept` in its `Vary`, so a shared cache
      // keyed only on the URL could reuse it for a Markdown request. Vercel's
      // own routing distinguishes the two, so this only affects intermediary
      // caches — the `.md` suffix is the cache-safe path for those.
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  return NextResponse.next();
}

// Only requests that ask for Markdown run the proxy. Without the `has`, every
// docs page view and every sidebar click paid for a proxy invocation before
// the prerendered page could be served. On /, only visitors who still need a
// version, or who see the canvas, run it; the rest get the prerendered page.
export const config = {
  matcher: [
    {
      source: "/",
      missing: [{ type: "cookie", key: "home-test", value: "(current|off)" }],
    },
    { source: "/", has: [{ type: "query", key: "home" }] },
    {
      source: "/docs/:path*",
      has: [{ type: "header", key: "accept", value: "(.*)text/markdown(.*)" }],
    },
  ],
};
