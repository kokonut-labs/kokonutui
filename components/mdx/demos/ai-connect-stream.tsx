"use client";

import { useEffect, useState } from "react";
import AIConnect, {
  type ConnectStatus,
} from "@/components/kokonutui/ai-connect";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One run of the tool: it needs GitHub, you connect, it retries. */
function Run({ fails }: { fails: boolean }) {
  const [status, setStatus] = useState<ConnectStatus>("running");

  // The tool comes back asking for access.
  useEffect(() => {
    const t = setTimeout(() => setStatus("needs-access"), 900);
    return () => clearTimeout(t);
  }, []);

  // Your OAuth popup; then the app retries the tool call.
  const connect = async () => {
    await wait(1400);
    if (fails) {
      throw new Error("The GitHub window was closed before you approved.");
    }
    retry();
  };

  const retry = async () => {
    await wait(900);
    setStatus("running");
    await wait(1400);
    setStatus("done");
  };

  return (
    <AIConnect
      answer="Opened #87 against main. CI is running."
      done="Opened a pull request"
      onConnect={connect}
      onSkip={() => undefined}
      reason="to open a pull request on acme/web"
      result="#87"
      running="Opening a pull request"
      scopes={[
        { label: "Read code in acme/web" },
        { label: "Open pull requests" },
        { label: "Push to main", denied: true },
      ]}
      status={status}
      target="acme/web"
    />
  );
}

export default function AIConnectStream() {
  const { play, run, key } = useScript([0]);

  return (
    <StreamPlate
      label="Driven by your tool call. Press Continue."
      play={play}
      run={run}
    >
      <Run fails={run === "error"} key={key} />
    </StreamPlate>
  );
}
