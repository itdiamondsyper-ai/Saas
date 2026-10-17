"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { PlanTier, WorkspaceRole } from "@/types/database";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface AppWorkspace {
  id: string;
  name: string;
  logoUrl: string | null;
  role: WorkspaceRole;
}

export interface AppContextValue {
  user: AppUser;
  workspace: AppWorkspace;
  workspaces: AppWorkspace[];
  plan: PlanTier;
  demoMode: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);
const BreadcrumbContext = createContext<{ label: string | null; setLabel: (label: string | null) => void } | null>(null);

export function AppProvider({ value, children }: { value: AppContextValue; children: React.ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  return (
    <AppContext value={value}>
      <BreadcrumbContext value={{ label, setLabel }}>{children}</BreadcrumbContext>
    </AppContext>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function useBreadcrumbLabel() {
  return useContext(BreadcrumbContext)?.label ?? null;
}

/** Lets a detail page show its record name in the top-bar breadcrumb. */
export function BreadcrumbLabel({ label }: { label: string }) {
  const ctx = useContext(BreadcrumbContext);
  const setLabel = ctx?.setLabel;
  useEffect(() => {
    setLabel?.(label);
    return () => setLabel?.(null);
  }, [label, setLabel]);
  return null;
}
