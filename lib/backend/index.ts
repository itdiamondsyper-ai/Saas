import "server-only";
import { isDemoMode } from "@/lib/env";
import { demoBackend } from "./demo";
import { supabaseBackend } from "./supabase";
import type { Backend } from "./types";

export function getBackend(): Backend {
  return isDemoMode() ? demoBackend : supabaseBackend;
}

export * from "./types";
