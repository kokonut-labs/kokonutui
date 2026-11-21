---
name: install-kokonutui-component
description: Find and install a KokonutUI React component into a project using the shadcn CLI, and read its source and documentation.
---

# Installing a KokonutUI component

KokonutUI is a collection of 100+ open-source React components for AI chat and
agents (prompt inputs, tool calls, in-chat checkout and order tracking), plus
the inputs, cards and buttons around them, built with React, Tailwind CSS v4
and Motion. Components are not published as
an npm package — each one is copied into the target project as source code
via the shadcn CLI, so it can be edited freely afterwards.

## Discovering what exists

- `https://kokonutui.com/r/registry.json` — machine-readable index of every
  installable component, including its dependencies and file list.
- `https://kokonutui.com/llms.txt` — documentation index with one line per
  component and a link to its Markdown source.
- `https://kokonutui.com/r/{name}.json` — the full registry entry for a single
  component, with the complete source of every file it ships.

To search the docs, request any docs page with `Accept: text/markdown` (or
append `.md` to the URL) to get clean Markdown instead of HTML. For example,
`https://kokonutui.com/docs/cards/card-flip.md`.

## Installing

If a shadcn MCP server is available, use it to browse and install components
directly — it works with the `@kokonutui` registry out of the box. Setup:
`https://kokonutui.com/docs/agents`.

Otherwise, use the shadcn CLI with the `@kokonutui` namespace:

```bash
npx shadcn@latest add @kokonutui/card-flip
```

Replace `card-flip` with any `name` from `registry.json`. The CLI resolves the
component's `registryDependencies` (shadcn/ui primitives such as `button` or
`textarea`) and its npm `dependencies` (such as `motion` or `lucide-react`)
automatically.

## Prerequisites in the target project

- Tailwind CSS v4 configured.
- shadcn/ui initialised (`npx shadcn@latest init`), so `components.json` and
  the `cn` utility in `lib/utils.ts` exist.
- React 19 or later for components that use modern React features.

## After installing

The component lands in `components/kokonutui/{name}.tsx` by default. It is
plain source code — edit it directly rather than wrapping it. Check the
component's docs page for props and usage examples.

## Licence

MIT. The components may be used, modified, and shipped in commercial work.
