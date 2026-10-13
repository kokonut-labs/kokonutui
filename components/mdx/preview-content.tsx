"use client";

import { CheckCheck, Copy } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { copyComponent } from "@/lib/action";
import { cn } from "@/lib/utils";
import { OpenInV0Button } from "../open-in-v0-button";

/** "Open in v0" and "Copy code" for a component preview. */
export default function PreviewActions({
  link,
  isBlock = false,
}: {
  link: string;
  isBlock?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState(copyComponent, {
    error: "",
    content: "",
    success: false,
  });
  const [isCopied, setIsCopied] = useState(false);

  const [folder, filename] = link.split("/");
  const componentName = filename ? filename : folder;

  const handleCopyClick = () => {
    startTransition(() => {
      const formData = new FormData();
      formData.append("folder", folder);
      formData.append("fileName", filename);

      formAction(formData);
    });
  };

  useEffect(() => {
    if (state.success && state.content) {
      setIsCopied(true);
      navigator.clipboard.writeText(state.content);

      const timeout = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [state]);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <OpenInV0Button name={componentName} />

      {!isBlock && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCopyClick();
          }}
        >
          <button
            aria-label={isCopied ? "Copied" : "Copy component source code"}
            className={cn(
              "relative h-7 overflow-hidden rounded-md px-2.5 font-medium text-xs",
              "bg-black text-white dark:bg-white dark:text-black",
              "hover:bg-zinc-800 dark:hover:bg-zinc-200",
              "transition-[background-color,scale] duration-150 ease-out active:scale-[0.97]"
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
  );
}
