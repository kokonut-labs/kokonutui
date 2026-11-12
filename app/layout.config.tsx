import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import GithubIcon from "@/components/icons/github-icon";
import XIcon from "@/components/icons/x-icon";
import { siteConfig } from "@/config/site";

export const baseOptions = (): BaseLayoutProps => ({
  nav: {
    transparentMode: "top",
    title: (
      <div className="flex items-center">
        <Image alt="" className="mr-2" height={24} src="/logo.svg" width={24} />
        <span className="hidden items-center font-bold text-black text-lg tracking-tight md:inline-flex dark:text-white">
          Kokonut UI
        </span>
        <span className="sr-only md:hidden">Kokonut UI</span>
      </div>
    ),
  },
  // Each icon link carries its name in `label`. GitHub is listed here rather
  // than through `githubUrl`, whose built-in icon is an unnamed image.
  links: [
    {
      type: "icon",
      url: siteConfig.links.twitter,
      icon: <XIcon className="h-4 w-4" />,
      text: "X",
      label: "Kokonut UI on X",
      external: true,
    },
    {
      type: "icon",
      url: siteConfig.links.github,
      icon: <GithubIcon />,
      text: "GitHub",
      label: "Kokonut UI on GitHub",
      external: true,
    },
  ],
});
