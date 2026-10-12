"use client";

import { CreditCard, FileText, LogOut, Settings, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Gemini from "../icons/gemini";

interface Profile {
  name: string;
  email: string;
  avatar: string;
  subscription?: string;
  model?: string;
}

interface MenuItem {
  label: string;
  value?: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
}

const SAMPLE_PROFILE_DATA: Profile = {
  name: "Eugene An",
  email: "eugene@kokonutui.com",
  avatar:
    "https://ferf1mheo22r9ira.public.blob.vercel-storage.com/profile-mjss82WnWBRO86MHHGxvJ2TVZuyrDv.jpeg",
  subscription: "PRO",
  model: "Gemini 2.0 Flash",
};

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  data?: Profile;
  /** Has no effect. Kept so existing callers keep type-checking. */
  showTopbar?: boolean;
}

export default function ProfileDropdown({
  data = SAMPLE_PROFILE_DATA,
  className,
  showTopbar: _showTopbar,
  ...props
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuItems: MenuItem[] = [
    {
      label: "Profile",
      href: "#",
      icon: <User className="h-4 w-4" />,
    },
    {
      label: "Model",
      value: data.model,
      href: "#",
      icon: <Gemini className="h-4 w-4" />,
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

  return (
    <div className={cn("relative", className)} {...props}>
      <DropdownMenu onOpenChange={setIsOpen}>
        <div className="group relative">
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-16 rounded-2xl border border-zinc-200/60 bg-white p-3 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50/80 hover:shadow-sm focus:outline-none dark:border-zinc-800/60 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/40"
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
                      alt={data.name}
                      className="h-full w-full rounded-full object-cover"
                      height={36}
                      src={data.avatar}
                      width={36}
                    />
                  </div>
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>

          {/* Bending line indicator on the right */}
          <div
            className={cn(
              "absolute top-1/2 -right-3 -translate-y-1/2 transition-opacity duration-200",
              isOpen ? "opacity-100" : "opacity-60 group-hover:opacity-100"
            )}
          >
            <svg
              aria-hidden="true"
              className={cn(
                "transition-[color,scale] duration-200",
                isOpen
                  ? "scale-110 text-blue-500 motion-reduce:scale-100 dark:text-blue-400"
                  : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
              )}
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
              {menuItems.map((item) => (
                <DropdownMenuItem asChild key={item.label}>
                  <Link
                    className="group flex cursor-pointer items-center rounded-xl border border-transparent p-3 transition-none hover:border-zinc-200/50 hover:bg-zinc-100/80 hover:shadow-sm dark:hover:border-zinc-700/50 dark:hover:bg-zinc-800/60"
                    href={item.href}
                  >
                    <div className="flex flex-1 items-center gap-2">
                      {item.icon}
                      <span className="whitespace-nowrap font-medium text-sm text-zinc-900 leading-tight tracking-tight transition-colors group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-zinc-50">
                        {item.label}
                      </span>
                    </div>
                    <div className="ml-auto flex-shrink-0">
                      {item.value && (
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 font-medium text-xs tracking-tight",
                            item.label === "Model"
                              ? "border border-blue-500/10 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                              : "border border-purple-500/10 bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
                          )}
                        >
                          {item.value}
                        </span>
                      )}
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator className="my-3 bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />

            <DropdownMenuItem asChild>
              <button
                className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-red-500/10 p-3 transition-none hover:border-red-500/30 hover:bg-red-500/20 hover:shadow-sm"
                type="button"
              >
                <LogOut className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                <span className="font-medium text-red-500 text-sm group-hover:text-red-600">
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
