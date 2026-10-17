import { expect, test } from "@playwright/test";
import { login, signUpAndOnboard } from "./helpers";

test.describe("Access control", () => {
  test("unauthenticated dashboard access redirects to login", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fclients/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("after login the user returns to the page they asked for", async ({ page }) => {
    await page.goto("/dashboard/invoices");
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Email").fill("alex@vertex-demo.com");
    await page.getByLabel("Password").fill("demo1234");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard\/invoices/);
  });

  test("protected API routes reject anonymous requests", async ({ request }) => {
    const res = await request.get("/api/activity/export");
    expect(res.status()).toBe(401);
  });

  test("a user can't open records from another workspace", async ({ page }) => {
    // Grab a Vertex Creative client URL as a member of that workspace...
    await login(page);
    await page.goto("/dashboard/clients?q=Northstar");
    const href = await page.getByRole("link", { name: "Olivia Chen" }).getAttribute("href");
    expect(href).toBeTruthy();
    await page.context().clearCookies();

    // ...then try it as a brand-new user from a different workspace.
    await signUpAndOnboard(page, { name: "Morgan Outsider", workspace: "Outsider LLC" });
    await page.goto(href!);
    await expect(page.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
    await page.goto("/dashboard/clients");
    await expect(page.getByText("No clients yet")).toBeVisible();
  });
});
