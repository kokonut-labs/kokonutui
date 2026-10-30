import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import XIcon from "@/components/icons/x-icon";
import { LogoMark } from "@/components/landing/halloween/fright";
import { siteConfig } from "@/config/site";

export const baseOptions = (): BaseLayoutProps => ({
  githubUrl: siteConfig.links.github,
  nav: {
    transparentMode: "top",
    title: (
      <div className="flex items-center">
        <LogoMark className="mr-2" size={24} />
        <span className="hidden items-center font-bold text-black text-lg tracking-tight md:inline-flex dark:text-white">
          Kokonut UI
        </span>
      </div>
    ),
  },
  links: [
    {
      type: "icon",
      url: siteConfig.links.twitter,
      icon: <XIcon className="h-4 w-4" />,
      text: "Twitter",
      external: true,
    },
  ],
});
