import { expect, type Page } from "@playwright/test";

export const DEMO = { email: "alex@vertex-demo.com", password: "demo1234" };

export function uniqueEmail(prefix = "user") {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function login(page: Page, email = DEMO.email, password = DEMO.password) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Signs up a fresh user and finishes onboarding with the "skip" path. */
export async function signUpAndOnboard(page: Page, opts: { name?: string; workspace?: string } = {}) {
  const email = uniqueEmail();
  await page.goto("/signup");
  await page.getByLabel("Full name").fill(opts.name ?? "Taylor Quinn");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByLabel("Company or workspace name").fill(opts.workspace ?? "Quinn Studio");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Industry").selectOption({ label: "Design & creative agency" });
  await page.getByLabel("Team size").selectOption("2-10");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Manage clients/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "I'll do this later" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}
