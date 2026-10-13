"use client";

import { CreditCard, FileText, LogOut, Settings, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type HTMLAttributes,
  type ReactNode,
  type SVGProps,
  useId,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Profile {
  name: string;
  email: string;
  avatar: string;
  subscription?: string;
  model?: string;
}

export interface ProfileMenuItem {
  label: string;
  value?: string;
  /** Renders the item as a link. Without it the item is a button. */
  href?: string;
  /** Opens `href` in a new tab. */
  external?: boolean;
  onSelect?: () => void;
  icon: ReactNode;
  /** Colour of the `value` badge. */
  tone?: "blue" | "purple";
}

const SAMPLE_PROFILE_DATA: Profile = {
  name: "Eugene An",
  email: "eugene@kokonutui.com",
  avatar:
    "https://ferf1mheo22r9ira.public.blob.vercel-storage.com/profile-mjss82WnWBRO86MHHGxvJ2TVZuyrDv.jpeg",
  subscription: "PRO",
  model: "Gemini 2.0 Flash",
};

const TONE_CLASSES = {
  blue: "border border-blue-500/10 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  purple:
    "border border-purple-500/10 bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
};

// Item classes go on DropdownMenuItem, not its child, so they are merged with
// the base item classes instead of competing with them in CSS order. Radix
// focuses an item on pointer move, so `focus:` styles cover hover too.
const ITEM_CLASS =
  "group flex w-full cursor-pointer items-center rounded-xl border border-transparent px-2 py-1.5 transition-none focus:border-zinc-200/50 focus:bg-zinc-100/80 focus:shadow-sm dark:focus:border-zinc-700/50 dark:focus:bg-zinc-800/60";

const SIGN_OUT_CLASS =
  "group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-red-500/10 px-2 py-1.5 transition-none focus:border-red-500/30 focus:bg-red-500/20 focus:shadow-sm dark:focus:bg-red-500/20";

// Inlined so the component has no cross-file import to break on install.
function GeminiIcon(props: SVGProps<SVGSVGElement>) {
  const gradientId = useId();
  return (
    <svg
      aria-hidden="true"
      height="1em"
      viewBox="0 0 24 24"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          x2="68.73%"
          y1="100%"
          y2="30.395%"
        >
          <stop offset="0%" stopColor="#1C7DFF" />
          <stop offset="52.021%" stopColor="#1C69FF" />
          <stop offset="100%" stopColor="#F0DCD6" />
        </linearGradient>
      </defs>
      <path
        d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12"
        fill={`url(#${gradientId})`}
        fillRule="nonzero"
      />
    </svg>
  );
}

const sampleMenuItems = (data: Profile): ProfileMenuItem[] => [
  {
    label: "Profile",
    href: "#",
    icon: <User className="h-4 w-4" />,
  },
  {
    label: "Model",
    value: data.model,
    href: "#",
    icon: <GeminiIcon className="h-4 w-4" />,
    tone: "blue",
  },
  {
    label: "Subscription",
    value: data.subscription,
    href: "#",
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    label: "Settings",
    href: "#",
    icon: <Settings className="h-4 w-4" />,
  },
  {
    label: "Terms & Policies",
    href: "#",
    icon: <FileText className="h-4 w-4" />,
    external: true,
  },
];

interface ProfileDropdownProps extends HTMLAttributes<HTMLDivElement> {
  data?: Profile;
  /** Menu entries. Defaults to a sample menu built from `data`. */
  items?: ProfileMenuItem[];
  onSignOut?: () => void;
  /** Has no effect. Kept so existing callers keep type-checking. */
  showTopbar?: boolean;
}

export default function ProfileDropdown({
  data = SAMPLE_PROFILE_DATA,
  items,
  onSignOut,
  className,
  showTopbar: _showTopbar,
  ...props
}: ProfileDropdownProps) {
  const menuItems = items ?? sampleMenuItems(data);

  return (
    <div className={cn("relative", className)} {...props}>
      <DropdownMenu>
        <div className="group relative">
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-16 rounded-2xl border border-zinc-200/60 bg-white p-3 outline-hidden transition-[background-color,border-color,box-shadow,scale] duration-200 hover:border-zinc-300 hover:bg-zinc-50/80 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-safe:active:scale-[0.97] dark:border-zinc-800/60 dark:bg-zinc-900 dark:focus-visible:ring-zinc-400 dark:focus-visible:ring-offset-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/40"
              type="button"
            >
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-zinc-900 leading-tight tracking-tight dark:text-zinc-100">
                  {data.name}
                </div>
                <div className="text-xs text-zinc-500 leading-tight tracking-tight dark:text-zinc-400">
                  {data.email}
                </div>
              </div>
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
                  <div className="h-full w-full overflow-hidden rounded-full bg-white dark:bg-zinc-900">
                    <Image
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                      height={36}
                      src={data.avatar}
                      unoptimized
                      width={36}
                    />
                  </div>
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>

          {/* Bending line indicator, styled from the trigger's data-state */}
          <div className="absolute top-1/2 -right-3 -translate-y-1/2 opacity-60 transition-opacity duration-200 group-hover:opacity-100 group-has-data-[state=open]:opacity-100">
            <svg
              aria-hidden="true"
              className="text-zinc-400 transition-[color,scale] duration-200 group-hover:text-zinc-600 group-has-data-[state=open]:scale-110 group-has-data-[state=open]:text-blue-500 motion-reduce:scale-100 dark:text-zinc-500 dark:group-has-data-[state=open]:text-blue-400 dark:group-hover:text-zinc-300"
              fill="none"
              height="24"
              viewBox="0 0 12 24"
              width="12"
            >
              <path
                d="M2 4C6 8 6 16 2 20"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          <DropdownMenuContent
            align="end"
            className="motion-reduce:data-[side=bottom]:slide-in-from-top-0 motion-reduce:data-[side=top]:slide-in-from-bottom-0 motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[state=open]:zoom-in-100 w-64 origin-(--radix-dropdown-menu-content-transform-origin) rounded-2xl border border-zinc-200/60 bg-white/95 p-2 shadow-xl shadow-zinc-900/5 dark:border-zinc-800/60 dark:bg-zinc-900/95 dark:shadow-zinc-950/20"
            sideOffset={4}
          >
            <div className="space-y-1">
              {menuItems.map((item) => {
                const content = (
                  <>
                    <span className="flex flex-1 items-center gap-2">
                      {item.icon}
                      <span className="whitespace-nowrap font-medium text-sm text-zinc-900 leading-tight tracking-tight group-focus:text-zinc-950 dark:text-zinc-100 dark:group-focus:text-zinc-50">
                        {item.label}
                      </span>
                    </span>
                    {item.value && (
                      <span
                        className={cn(
                          "ml-auto flex-shrink-0 rounded-md px-2 py-1 font-medium text-xs tracking-tight",
                          TONE_CLASSES[item.tone ?? "purple"]
                        )}
                      >
                        {item.value}
                      </span>
                    )}
                  </>
                );
                return (
                  <DropdownMenuItem
                    asChild
                    className={ITEM_CLASS}
                    key={item.label}
                    onSelect={item.onSelect}
                  >
                    {item.href ? (
                      <Link
                        href={item.href}
                        {...(item.external && {
                          rel: "noopener noreferrer",
                          target: "_blank",
                        })}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button type="button">{content}</button>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>

            <DropdownMenuSeparator className="my-3 bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />

            <DropdownMenuItem
              asChild
              className={SIGN_OUT_CLASS}
              onSelect={onSignOut}
            >
              <button type="button">
                <LogOut className="h-4 w-4 text-red-500 group-focus:text-red-600" />
                <span className="font-medium text-red-500 text-sm group-focus:text-red-600">
                  Sign Out
                </span>
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
    </div>
  );
}
