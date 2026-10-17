"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBackend } from "@/lib/backend";
import { DEMO_OWNER_EMAIL, DEMO_PASSWORD } from "@/lib/demo/seed";
import { WORKSPACE_COOKIE } from "@/lib/server/context";

/**
 * "View Demo": signs the visitor into the shared demo account.
 * In demo mode that's the seeded Vertex Creative owner. With Supabase, it uses
 * DEMO_ACCOUNT_EMAIL / DEMO_ACCOUNT_PASSWORD if you created a demo user.
 */
export async function startDemoAction() {
  const backend = getBackend();
  const email = backend.mode === "demo" ? DEMO_OWNER_EMAIL : process.env.DEMO_ACCOUNT_EMAIL;
  const password = backend.mode === "demo" ? DEMO_PASSWORD : process.env.DEMO_ACCOUNT_PASSWORD;
  if (!email || !password) redirect("/login?demo=unavailable");
  try {
    await backend.auth.signIn(email, password);
  } catch {
    redirect("/login?demo=unavailable");
  }
  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/dashboard");
}
