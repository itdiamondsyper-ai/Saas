import { expect, test } from "@playwright/test";
import { DEMO, login, signUpAndOnboard } from "./helpers";

test.describe("Authentication", () => {
  test("a new user can sign up, finish onboarding, log out and log back in", async ({ page }) => {
    const email = await signUpAndOnboard(page, { name: "Taylor Quinn", workspace: "Quinn Studio" });
    await expect(page.getByRole("heading", { name: "Welcome back, Taylor" })).toBeVisible();
    await expect(page.getByText("Quinn Studio").first()).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).first().click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("You've been signed out.")).toBeVisible();

    await login(page, email, "supersecret1");
    await expect(page.getByRole("heading", { name: "Welcome back, Taylor" })).toBeVisible();
  });

  test("signup validates input", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Full name is required")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
  });

  test("wrong password shows a helpful error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password." })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("password reset flow works in demo mode", async ({ page }) => {
    const email = await signUpAndOnboard(page, { name: "Riley Park", workspace: "Park & Co" });
    await page.context().clearCookies();
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.getByRole("link", { name: "Open reset link" }).click();
    await page.getByLabel("New password", { exact: true }).fill("brandnewpass1");
    await page.getByLabel("Confirm new password").fill("brandnewpass1");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Your password was updated.")).toBeVisible();
    await login(page, email, "brandnewpass1");
  });

  test("the demo button opens the seeded workspace", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "View Demo" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Welcome back, Alex" })).toBeVisible();
  });
});
