import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("Mobile layout (375px)", () => {
  test("landing page fits the screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("sidebar collapses into a drawer and pages don't scroll sideways", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeHidden();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: /^Clients/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Clients" })).toBeVisible();
    for (const path of ["/dashboard", "/dashboard/clients", "/dashboard/invoices", "/dashboard/analytics", "/dashboard/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
  });
});
