<p align="center">
  <a href="https://kokonutui.com">
    <img alt="Kokonut UI: AI components that feel right" src="app/opengraph-image.png" width="800">
  </a>
</p>

<h1 align="center">Kokonut UI</h1>

<p align="center">
  Open-source React components for AI apps, and the inputs, cards and buttons around them.<br>
  100+ components built with Tailwind CSS, Motion and shadcn/ui. Your agent or the shadcn CLI installs them, and they live in your codebase.
</p>

<p align="center">
  <a href="https://kokonutui.com/docs">Docs</a> ·
  <a href="https://kokonutui.com/docs/changelog">Changelog</a> ·
  <a href="https://kokonutui.com/docs/agents">Agents</a> ·
  <a href="https://kokonutui.pro">Pro</a>
</p>

<p align="center">
  <a href="https://www.producthunt.com/products/kokonutui?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-kokonut-ui-2">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1300330&amp;theme=dark">
      <img alt="Kokonut UI - Open-source UI components for your AI agent | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1300330&amp;theme=light">
    </picture>
  </a>
</p>

## Quick start

Kokonut UI is a [shadcn/ui registry](https://ui.shadcn.com/docs/registry). Add the namespace to your `components.json`:

```json
{
  "registries": {
    "@kokonutui": "https://kokonutui.com/r/{name}.json"
  }
}
```

Then add any component by name:

```bash
npx shadcn@latest add @kokonutui/ai-tool-approval
```

```tsx
import AIToolApproval from "@/components/kokonutui/ai-tool-approval";

export default function Page() {
  return <AIToolApproval />;
}
```

The CLI writes the source to `components/kokonutui/` and installs its dependencies. You own the code from there. Full setup, including monorepos, is in the [installation guide](https://kokonutui.com/docs).

You can also install straight from this repo, with no `components.json` changes:

```bash
npx shadcn@latest add kokonut-labs/kokonutui/ai-tool-approval
```

## Components

| Category | Examples |
| --- | --- |
| [AI](https://kokonutui.com/docs/ai) | Tool Calls, Tool Approval, Checkout, Diff Review, Model Selector, Inline Citations, Voice |
| [Buttons](https://kokonutui.com/docs/buttons) | Slide to Confirm, Hold Button, Pay Button, Undo Button, Magnet Button |
| [Cards](https://kokonutui.com/docs/cards) | Apple Activity Card, Boarding Pass, Currency Transfer, Uptime Card, Receipt Printer |
| [Inputs](https://kokonutui.com/docs/inputs) | Seat Map, Wheel Picker, Signature Pad, Time Zone Planner, Amount Pad |
| [Navigation](https://kokonutui.com/docs/navigation) | Command Palette, Marking Menu, Smooth Drawer, Swipe Tabs, Status Island |
| [Media](https://kokonutui.com/docs/media) | Clip Trimmer, Synced Transcript, Photo Straighten, Focal Point Picker |
| [Feedback](https://kokonutui.com/docs/feedback) | Promise Toast, Inline Alert, Save Status, Empty State, Helpful Rating |
| [Text](https://kokonutui.com/docs/texts) | Split Flap Text, Spoiler Text, Typing Text, Marker Text |
| [Backgrounds](https://kokonutui.com/docs/backgrounds) | Dither Reveal Hero, Caustics, Halftone, Topo, Rain Glass |

Every component has a live demo, its source, and the packages it installs on its docs page. New ones land in the [changelog](https://kokonutui.com/docs/changelog).

## Use with AI agents

Claude Code, Cursor, VS Code and Codex can search and install Kokonut UI components through the [shadcn MCP server](https://ui.shadcn.com/docs/mcp). The [Agents page](https://kokonutui.com/docs/agents) has the one-line setup for each editor and a rules file to drop in. The docs are also available as plain text at [kokonutui.com/llms.txt](https://kokonutui.com/llms.txt).

## Kokonut UI Pro

[Kokonut UI Pro](https://kokonutui.pro) adds premium components, blocks and full Next.js [templates](https://kokonutui.com/docs/templates). Pro components install through the same shadcn CLI.

## Contributing

Issues and pull requests are welcome. To run the site locally:

```bash
git clone https://github.com/kokonut-labs/kokonutui.git
cd kokonutui
bun install
bun run dev
```

Components live in `components/kokonutui/`, their docs in `content/docs/<category>/`, and their registry entries in `registry/registry-components.ts`. Run `bun x ultracite fix` before committing. The registry JSON in `public/r/` is rebuilt by CI on merge, so you don't need to commit it.

## Sponsor

Thanks to [Vercel](https://vercel.com/oss) for sponsoring this project through the Vercel OSS Program.

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>

## License

[MIT](LICENSE)
