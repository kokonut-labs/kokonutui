import type { Registry } from "./schema";

export const component: Registry = [
  {
    name: "ai-prompt",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["textarea", "button", "dropdown-menu"],
    files: [
      {
        path: "components/kokonutui/ai-prompt.tsx",
        type: "registry:component",
      },
      {
        path: "hooks/use-auto-resize-textarea.ts",
        type: "registry:hook",
      },
      {
        path: "components/icons/anthropic.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/anthropic-dark.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "command-button",
    type: "registry:component",
    dependencies: ["lucide-react"],
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/command-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "card-flip",
    type: "registry:component",
    dependencies: ["lucide-react"],
    files: [
      {
        path: "components/kokonutui/card-flip.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "smooth-drawer",
    type: "registry:component",
    dependencies: ["motion"],
    registryDependencies: ["drawer", "button"],
    files: [
      {
        path: "components/kokonutui/smooth-drawer.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "shape-hero",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/shape-hero.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "ai-text-loading",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/ai-text-loading.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "shimmer-text",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/shimmer-text.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "carousel-cards",
    type: "registry:component",
    dependencies: ["lucide-react"],
    registryDependencies: ["card", "badge", "button"],
    files: [
      {
        path: "components/kokonutui/carousel-cards.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "file-upload",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    files: [
      {
        path: "components/kokonutui/file-upload.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "action-search-bar",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["input"],
    files: [
      {
        path: "components/kokonutui/action-search-bar.tsx",
        type: "registry:component",
      },
      {
        path: "hooks/use-debounce.ts",
        type: "registry:hook",
      },
    ],
  },
  {
    name: "action-search-bar-02",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    files: [
      {
        path: "components/kokonutui/action-search-bar-02.tsx",
        type: "registry:component",
      },
      {
        path: "hooks/use-debounce.ts",
        type: "registry:hook",
      },
    ],
  },
  {
    name: "ai-input-search",
    type: "registry:component",
    dependencies: ["motion"],
    registryDependencies: ["textarea"],
    files: [
      {
        path: "components/kokonutui/ai-input-search.tsx",
        type: "registry:component",
      },
      {
        path: "hooks/use-auto-resize-textarea.ts",
        type: "registry:hook",
      },
    ],
  },
  {
    name: "currency-transfer",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["card", "tooltip"],
    files: [
      {
        path: "components/kokonutui/currency-transfer.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "background-paths",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/background-paths.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "mouse-effect-card",
    type: "registry:component",
    dependencies: ["motion"],
    registryDependencies: ["card", "button"],
    files: [
      {
        path: "components/kokonutui/mouse-effect-card.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "beams-background",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/beams-background.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "apple-activity-card",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/apple-activity-card.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "ai-voice",
    type: "registry:component",
    dependencies: ["motion", "lucide-react"],
    files: [
      {
        path: "components/kokonutui/ai-voice.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "smooth-tab",
    type: "registry:component",
    dependencies: ["motion", "lucide-react"],
    files: [
      {
        path: "components/kokonutui/smooth-tab.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "team-selector",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/team-selector.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "switch-button",
    type: "registry:component",
    dependencies: ["lucide-react"],
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/switch-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "bento-grid",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    files: [
      {
        path: "components/kokonutui/bento-grid.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/anthropic.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/anthropic-dark.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/gemini.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/open-ai.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/open-ai-dark.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/mistral.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/deepseek.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "social-button",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/social-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "hold-button",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/hold-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "attract-button",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/attract-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "gradient-button",
    type: "registry:component",
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/gradient-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "v0-button",
    type: "registry:component",
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/v0-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "toolbar",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    files: [
      {
        path: "components/kokonutui/toolbar.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "ai-loading",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/ai-loading.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "card-stack",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/card-stack.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "avatar-picker",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["card", "button", "input"],
    files: [
      {
        path: "components/kokonutui/avatar-picker.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "type-writer",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/type-writer.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "swoosh-text",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/swoosh-text.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "sliced-text",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/sliced-text.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "glitch-text",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/glitch-text.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "matrix-text",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/matrix-text.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "dynamic-text",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/dynamic-text.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "particle-button",
    type: "registry:component",
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/particle-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "tweet-card",
    type: "registry:component",
    dependencies: ["lucide-react"],
    files: [
      {
        path: "components/kokonutui/tweet-card.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "scroll-text",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/scroll-text.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "liquid-glass-card",
    type: "registry:component",
    dependencies: ["lucide-react"],
    registryDependencies: ["card", "button"],
    files: [
      {
        path: "components/kokonutui/liquid-glass-card.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "profile-dropdown",
    type: "registry:component",
    dependencies: ["lucide-react"],
    registryDependencies: ["dropdown-menu"],
    files: [
      {
        path: "components/kokonutui/profile-dropdown.tsx",
        type: "registry:component",
      },
      {
        path: "components/icons/gemini.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "loader",
    type: "registry:component",
    dependencies: ["motion"],
    files: [
      {
        path: "components/kokonutui/loader.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "slide-text-button",
    type: "registry:component",
    dependencies: ["motion"],
    registryDependencies: ["button"],
    files: [
      {
        path: "components/kokonutui/slide-text-button.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "morphic-navbar",
    type: "registry:component",
    dependencies: ["clsx"],
    files: [
      {
        path: "components/kokonutui/morphic-navbar.tsx",
        type: "registry:component",
      },
    ],
  },
];
