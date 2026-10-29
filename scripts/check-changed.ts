/**
 * Runs the CI checks on what this branch changed, so a push doesn't wait on
 * CI to find a lint or type error.
 *
 * - Biome on every changed file it can read (generated files are ignored in
 *   biome.jsonc).
 * - The typecheck, when any TypeScript or MDX changed.
 * - knip, which is quick and catches files and packages nothing uses.
 *
 * "Changed" means against the merge base with origin/main, plus uncommitted
 * and untracked files.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const LINTABLE_RE = /\.(tsx?|jsx?|mjs|json|jsonc|css)$/;
const TYPED_RE = /\.(tsx?|mdx)$/;

const git = (...args: string[]) =>
  spawnSync("git", args, { encoding: "utf8" }).stdout.trim();

const run = (label: string, cmd: string, args: string[]) => {
  process.stdout.write(`\n▸ ${label}\n`);
  const { status } = spawnSync(cmd, args, { stdio: "inherit" });
  return status === 0;
};

const base = git("merge-base", "HEAD", "origin/main") || "HEAD";
const changed = [
  ...new Set(
    [
      git("diff", "--name-only", "--diff-filter=d", base),
      git("ls-files", "--others", "--exclude-standard"),
    ]
      .join("\n")
      .split("\n")
      .filter((file) => file && existsSync(file))
  ),
];

if (changed.length === 0) {
  process.stdout.write("Nothing changed against origin/main.\n");
  process.exit(0);
}

const results: boolean[] = [];

const lintable = changed.filter((file) => LINTABLE_RE.test(file));
if (lintable.length > 0) {
  results.push(
    run(`Biome (${lintable.length} files)`, "bunx", [
      "biome",
      "check",
      "--no-errors-on-unmatched",
      ...lintable,
    ])
  );
}

if (changed.some((file) => TYPED_RE.test(file))) {
  results.push(
    run("Typecheck", "sh", [
      "-c",
      "bunx next typegen >/dev/null && bunx fumadocs-mdx >/dev/null && bunx tsc --noEmit",
    ])
  );
}

results.push(run("knip", "bunx", ["knip", "--no-progress"]));

process.exit(results.every(Boolean) ? 0 : 1);
