"use client";

import { CheckCheck, Copy } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { copyComponent } from "@/lib/action";
import { cn } from "@/lib/utils";
import { OpenInV0Button } from "../open-in-v0-button";
import { PackageManagerTabs } from "./package-manager-tabs";

export default function PreviewContent({
  link,
  prePath,
  isBlock = false,
}: {
  link: string;
  prePath: string;
  isBlock?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState(copyComponent, {
    error: "",
    content: "",
    success: false,
  });
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyClick = () => {
    const [folder, filename] = link.split("/");

    startTransition(() => {
      const formData = new FormData();
      formData.append("folder", folder);
      formData.append("fileName", filename);

      formAction(formData);
    });
  };

  const getFileName = () => {
    const [folder, filename] = link.split("/");
    return filename ? filename : folder;
  };

  const handleTerminalClick = (packageManager: string) => {
    const [folder, filename] = link.split("/");
    const componentName = filename ? filename : folder;

    let commandToCopy: string;
    const componentAddCommand = `shadcn@latest add ${prePath}/${componentName}`;

    if (packageManager === "pnpm") {
      commandToCopy = `pnpm dlx ${componentAddCommand}`;
    } else if (packageManager === "npm") {
      commandToCopy = `npx ${componentAddCommand}`;
    } else {
      commandToCopy = `bunx --bun ${componentAddCommand}`;
    }

    navigator.clipboard.writeText(commandToCopy);
  };

  const openInV0 = () => {
    const [folder, filename] = link.split("/");

    return filename ? filename : folder;
  };

  useEffect(() => {
    if (state.success && state.content) {
      setIsCopied(true);
      navigator.clipboard.writeText(state.content);

      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  }, [state]);

  return (
    <div className="relative flex w-full flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-2">
      <div className="w-full sm:w-auto">
        <PackageManagerTabs
          commandName={getFileName()}
          onSelect={handleTerminalClick}
          prePath={prePath}
        />
      </div>
      <div className="mt-1 flex w-full items-center justify-end gap-2 sm:mt-0 sm:w-auto">
        <OpenInV0Button name={openInV0()} />

        {!isBlock && (
          <form
            className="w-full sm:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              handleCopyClick();
            }}
          >
            <button
              aria-label={isCopied ? "Copied" : "Copy component source code"}
              className={cn(
                "relative h-7 overflow-hidden rounded-sm px-2.5 font-medium text-xs",
                "bg-black text-white dark:bg-white dark:text-black",
                "hover:bg-zinc-800 dark:hover:bg-zinc-200",
                "transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]",
                "w-fit md:w-full"
              )}
              disabled={isPending}
              type="submit"
            >
              {/*
                Both labels stay mounted and crossfade with a light blur, so
                rapid clicks retarget the transition instead of restarting it.
              */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex items-center justify-center gap-1 transition-[opacity,filter] duration-150 ease-out",
                  isCopied ? "opacity-0 blur-[2px]" : "opacity-100 blur-0"
                )}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy code
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-1 transition-[opacity,filter] duration-150 ease-out",
                  isCopied ? "opacity-100 blur-0" : "opacity-0 blur-[2px]"
                )}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Copied
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
