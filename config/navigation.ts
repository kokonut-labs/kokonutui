export interface NavItem {
    id: string | number;
    title: string;
    href: string;
    description?: string;
    count?: number | string;
    isComingSoon?: boolean;
    isNew?: boolean;
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
                count: 6,
                isNew: true,
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
                count: 6,
            },
            {
                id: 6,
                title: "Pricing",
                href: "/docs/components/pricing",
                description: "Pricing components and layouts",
                count: 5,
            },
            {
                id: 7,
                title: "Text",
                href: "/docs/components/text",
                description: "Typography and text animation components",
                count: 6,
            },
            {
                id: 5,
                title: "Input",
                href: "/docs/components/input",
                description: "More components coming soon",
                count: "?",
                isComingSoon: true,
            },
        ],
    },
];