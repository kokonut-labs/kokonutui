export interface NavItem {
    id: string | number;
    title: string;
    href: string;
    description?: string;
    count?: number | string;
    isComingSoon?: boolean;
    isNew?: boolean;
    isLab?: boolean;
}

export interface NavSection {
    title: string;
    items: NavItem[];
}

export const navigationSections: NavSection[] = [
    {
        title: "Getting Started",
        items: [
            {
                id: "intro",
                title: "Installation",
                href: "/docs",
                description: "Introduction and usage guidelines",
            },
        ],
    },
    {
        title: "Components",
        items: [
            {
                id: 1,
                title: "AI-Input",
                href: "/docs/components/ai-input",
                description: "Modern AI chat interface components",
                count: 16,
            },
            {
                id: 2,
                title: "Alerts",
                href: "/docs/components/alert",
                description: "Alert components and layouts",
                count: 7,
            },
            {
                id: 3,
                title: "Button",
                href: "/docs/components/button",
                description: "Interactive button components with animations",
                count: 10,
            },
            {
                id: 4,
                title: "Card",
                href: "/docs/components/card",
                description: "Versatile card components and layouts",
                count: 7,
            },
            {
                id: 5,
                title: "Faq",
                href: "/docs/components/faq",
                description: "Frequently asked questions",
                count: 4,
            },
            {
                id: 6,
                title: "Input",
                href: "/docs/components/input",
                description: "More components coming soon",
                count: "10",
            },
            {
                id: 7,
                title: "List",
                href: "/docs/components/list",
                description: "List components and layouts",
                count: 6,
            },
            {
                id: 8,
                title: "Pricing",
                href: "/docs/components/pricing",
                description: "Pricing components and layouts",
                count: 4,
                isNew: true,
            },
            {
                id: 9,
                title: "Profile",
                href: "/docs/components/profile",
                description: "Profile components and layouts",
                count: 5,
                isNew: true,
            },
            {
                id: 10,
                title: "Text",
                href: "/docs/components/text",
                description: "Typography and text animation components",
                count: 7,
            },
        ],
    },
    {
        title: "Hooks",
        items: [
            {
                id: 1,
                title: "Custom Hooks",
                href: "/docs/hooks",
            },
        ],
    },
    {
        title: "Blocks",
        items: [
            {
                id: 1,
                title: "Block - 01",
                href: "/docs/components/block",
                isLab: true,
            },
        ],
    },
];
