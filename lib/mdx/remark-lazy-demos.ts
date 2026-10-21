import type { ImportDeclaration, Program, Statement } from "estree";
import type { Root } from "mdast";

/**
 * Turns a docs page's demo imports into lazy ones.
 *
 * `lib/source.ts` imports every MDX file, and the bundler gives each page
 * every client component it can reach, so a plain
 * `import ReceiptPrinter from "@/components/kokonutui/receipt-printer"` put
 * every demo on every page. This rewrites such an import into
 * `const ReceiptPrinter = demo("kokonutui/receipt-printer")` (see `lib/demo.tsx`), a stand-in that
 * loads the component only where it renders. The MDX stays as written.
 */
const DEMO_SOURCE = /^@\/components\/((?:kokonutui|mdx\/demos)\/[a-z0-9-]+)$/;
const HELPER = "__lazyDemo";

interface EsmNode {
  type: "mdxjsEsm";
  value: string;
  data?: { estree?: Program | null };
}

function demoPath(statement: Program["body"][number]) {
  if (statement.type !== "ImportDeclaration") {
    return;
  }
  const match = DEMO_SOURCE.exec(String(statement.source.value));
  const [specifier] = statement.specifiers;
  if (
    !match ||
    statement.specifiers.length !== 1 ||
    specifier.type !== "ImportDefaultSpecifier"
  ) {
    return;
  }
  return { path: match[1], local: specifier.local.name };
}

function lazyConst(local: string, path: string): Statement {
  return {
    type: "VariableDeclaration",
    kind: "const",
    declarations: [
      {
        type: "VariableDeclarator",
        id: { type: "Identifier", name: local },
        init: {
          type: "CallExpression",
          callee: { type: "Identifier", name: HELPER },
          arguments: [{ type: "Literal", value: path }],
          optional: false,
        },
      },
    ],
  };
}

function helperImport(): ImportDeclaration {
  return {
    type: "ImportDeclaration",
    specifiers: [
      {
        type: "ImportSpecifier",
        imported: { type: "Identifier", name: "demo" },
        local: { type: "Identifier", name: HELPER },
      },
    ],
    source: { type: "Literal", value: "@/lib/demo" },
    attributes: [],
  };
}

export function remarkLazyDemos() {
  return (tree: Root) => {
    let helperAdded = false;

    for (const child of tree.children) {
      if (child.type !== "mdxjsEsm") {
        continue;
      }
      const program = (child as unknown as EsmNode).data?.estree;
      if (!program) {
        continue;
      }

      let changed = false;
      const body = program.body.map((statement) => {
        const found = demoPath(statement);
        if (!found) {
          return statement;
        }
        changed = true;
        return lazyConst(found.local, found.path);
      });
      if (!changed) {
        continue;
      }
      // The source text (`value`) keeps the real import, which is what the
      // page's Markdown version should show; only the compiled code changes.
      program.body = helperAdded ? body : [helperImport(), ...body];
      helperAdded = true;
    }
  };
}
