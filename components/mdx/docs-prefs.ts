"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  MCP_CLIENTS,
  type McpClient,
  PACKAGE_MANAGERS,
  type PackageManager,
} from "@/lib/agents";

// A reader picks their package manager or editor once, and every command on
// every docs page follows. Stored per browser; the server renders defaults.
// Component install bars lead with the agent prompt; the CLI is one tap away.
const DEFAULTS = { pm: "bun", editor: "claude", via: "agent" } as const;

interface Prefs {
  editor: McpClient;
  pm: PackageManager;
  via: "agent" | "cli";
}
type Key = keyof Prefs;

const ALLOWED: Record<Key, readonly string[]> = {
  pm: PACKAGE_MANAGERS.map((m) => m.id),
  editor: MCP_CLIENTS.map((c) => c.id),
  via: ["agent", "cli"],
};

const STORAGE_PREFIX = "kokonut-docs-";
const listeners = new Set<() => void>();

function read<K extends Key>(key: K): Prefs[K] {
  try {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + key);
    return stored && ALLOWED[key].includes(stored)
      ? (stored as Prefs[K])
      : DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(STORAGE_PREFIX)) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function useDocsPref<K extends Key>(key: K) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => DEFAULTS[key]
  );
  const set = useCallback(
    (next: Prefs[K]) => {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, next);
      } catch {
        // Storage can be blocked; the picker then simply doesn't stick.
      }
      for (const listener of listeners) {
        listener();
      }
    },
    [key]
  );
  return [value, set] as const;
}

export const usePackageManager = () => useDocsPref("pm");
export const useEditor = () => useDocsPref("editor");
export const useInstallVia = () => useDocsPref("via");
