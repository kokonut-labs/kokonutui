import { SETUP_GUIDE } from "@/lib/agents";

/** The setup steps an agent follows when given the docs' setup prompt. */
export function GET() {
  return new Response(SETUP_GUIDE, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
