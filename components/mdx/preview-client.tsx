"use client";

import * as React from "react";
import { Preview } from "./preview";
import { RefreshButton } from "./refresh-button";

interface PreviewClientProps {
  children: React.ReactNode;
  className?: string;
  isPremium?: boolean;
  link: string;
  useIframe?: boolean;
  height?: string;
  compact?: boolean;
  comment?: string[];
}

export function PreviewClient({ children, ...props }: PreviewClientProps) {
  const [key, setKey] = React.useState(0);

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
  };

  return (
    <Preview {...props} action={<RefreshButton onRefresh={handleRefresh} />}>
      {/* Re-keying only the demo replays it without resetting the install bar. */}
      <React.Fragment key={key}>{children}</React.Fragment>
    </Preview>
  );
}
