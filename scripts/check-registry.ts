/**
 * Checks every registry entry against the imports of the files it ships.
 *
 * Dependencies are written by hand in `registry/`, and the docs site has
 * every package installed, so a missing one only shows up as a build error
 * in someone else's project after `shadcn add`. This fails when:
 *
 * - a file imports an npm package the entry doesn't list, or the entry lists
 *   one nothing imports,
 * - a file imports a shadcn/ui primitive the entry doesn't list in
 *   `registryDependencies`, or the entry lists one nothing imports,
 * - a file imports another `@/` file the entry doesn't ship,
 * - a file uses a relative import (the shadcn CLI only rewrites `@/`).
 */
import { readFileSync } from "node:fs";
import { registry } from "../registry/index";

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXTENSION_RE = /\.tsx?$/;
const UI_PREFIX = "@/components/ui/";

// React and Next come with the project, and `cn` comes with shadcn init.
const PROVIDED = new Set(["react", "react-dom", "next"]);
const PROVIDED_FILES = new Set(["@/lib/utils"]);

const packageName = (specifier: string) =>
  specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];

const problems: string[] = [];

for (const entry of registry) {
  const paths = (entry.files ?? []).map((file) =>
    typeof file === "string" ? file : file.path
  );
  const shipped = new Set(
    paths.map((path) => `@/${path.replace(EXTENSION_RE, "")}`)
  );
  const declared = new Set(entry.dependencies ?? []);
  const declaredUi = new Set(entry.registryDependencies ?? []);
  const usedPackages = new Set<string>();
  const usedUi = new Set<string>();

  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (specifier.startsWith(".")) {
        problems.push(`${entry.name}: relative import "${specifier}"`);
      } else if (specifier.startsWith(UI_PREFIX)) {
        usedUi.add(specifier.slice(UI_PREFIX.length));
      } else if (specifier.startsWith("@/")) {
        if (!(shipped.has(specifier) || PROVIDED_FILES.has(specifier))) {
          problems.push(
            `${entry.name}: imports ${specifier} but doesn't ship it`
          );
        }
      } else if (!PROVIDED.has(packageName(specifier))) {
        usedPackages.add(packageName(specifier));
      }
    }
  }

  for (const name of usedPackages) {
    if (!declared.has(name)) {
      problems.push(`${entry.name}: imports "${name}" but doesn't list it`);
    }
  }
  for (const name of declared) {
    if (!usedPackages.has(name)) {
      problems.push(`${entry.name}: lists "${name}" but never imports it`);
    }
  }
  for (const name of usedUi) {
    if (!declaredUi.has(name)) {
      problems.push(
        `${entry.name}: imports ui/${name} but doesn't list it in registryDependencies`
      );
    }
  }
  for (const name of declaredUi) {
    if (!usedUi.has(name)) {
      problems.push(
        `${entry.name}: lists ui/${name} in registryDependencies but never imports it`
      );
    }
  }
}

if (problems.length > 0) {
  process.stderr.write(
    `Registry entries don't match their imports:\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}\n`
  );
  process.exit(1);
}

process.stdout.write(
  `Registry entries match their imports (${registry.length} entries).\n`
);
