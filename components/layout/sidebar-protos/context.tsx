"use client";

import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SidebarModel } from "./model";

export const VARIANTS = [
  { id: "current", label: "Current" },
  { id: "a", label: "A · Terminal" },
  { id: "b", label: "B · Ledger" },
  { id: "c", label: "C · Atlas" },
] as const;

export type Variant = (typeof VARIANTS)[number]["id"];

const STORAGE_KEY = "sidebar-prototype";

interface ProtoContext {
  model: SidebarModel;
  variant: Variant;
  setVariant: (variant: Variant) => void;
}

const Context = createContext<ProtoContext | null>(null);

const isVariant = (value: string | null): value is Variant =>
  VARIANTS.some((variant) => variant.id === value);

export function SidebarProtoProvider({
  model,
  children,
}: {
  model: SidebarModel;
  children: ReactNode;
}) {
  const [variant, setVariantState] = useState<Variant>("a");

  // `?sidebar=b` picks a prototype and the choice sticks across pages.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("sidebar");
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const next = isVariant(fromUrl) ? fromUrl : stored;
    if (isVariant(next)) {
      setVariantState(next);
    }
  }, []);

  const setVariant = useCallback((next: Variant) => {
    setVariantState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private windows: the choice lasts for this page only.
    }
  }, []);

  const value = useMemo(
    () => ({ model, variant, setVariant }),
    [model, variant, setVariant]
  );

  return <Context value={value}>{children}</Context>;
}

export function useSidebarProto() {
  const context = use(Context);
  if (!context) {
    throw new Error("useSidebarProto needs <SidebarProtoProvider>.");
  }
  return context;
}
