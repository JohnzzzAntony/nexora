"use client";

import * as React from "react";
import type { Permission } from "@/lib/permissions/catalog";
import type { ShellData } from "@/components/shell/types";

type ShellContextValue = ShellData & {
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[] | undefined) => boolean;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
};

const ShellContext = React.createContext<ShellContextValue | null>(null);

export function ShellProvider({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const value = React.useMemo<ShellContextValue>(() => {
    const set = new Set(data.permissions);
    const can = (p: Permission) => set.has(p);
    return {
      ...data,
      can,
      canAny: perms => !perms || perms.length === 0 || perms.some(can),
      commandOpen,
      setCommandOpen,
    };
  }, [data, commandOpen]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/**
 * Current user / organization / permissions inside the (app) shell.
 * UI-only hints — the server always re-checks permissions.
 */
export function useShell() {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside the app shell");
  return ctx;
}
