import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("Workspace features", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard shows KPIs, charts and activity", async ({ page }) => {
    await expect(page.getByText("Revenue this month")).toBeVisible();
    await expect(page.getByText("$18,420")).toBeVisible();
    await expect(page.getByText("+12.4%")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming deadlines" })).toBeVisible();
    await expect(page.getByText("Sarah completed Design Homepage")).toBeVisible();
  });

  test("every main navigation link loads its page", async ({ page }) => {
    const pages: [string, string][] = [
      ["Clients", "Clients"],
      ["Projects", "Projects"],
      ["Tasks", "Tasks"],
      ["Invoices", "Invoices"],
      ["Analytics", "Analytics"],
      ["Team", "Team"],
      ["Activity", "Activity"],
      ["Notifications", "Notifications"],
      ["Settings", "Settings"],
      ["Overview", "Welcome back, Alex"],
    ];
    const nav = page.getByRole("navigation", { name: "Workspace" });
    for (const [link, heading] of pages) {
      await nav.getByRole("link", { name: new RegExp(`^${link}`) }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("user can create a client", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.getByRole("button", { name: "New client" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company").fill("Evergreen Analytics");
    await dialog.getByLabel("Contact name").fill("Jamie Fox");
    await dialog.getByLabel("Email").fill("jamie@evergreen-demo.com");
    await dialog.getByLabel("Tags").fill("data, inbound");
    await dialog.getByRole("button", { name: "Create client" }).click();
    await expect(page).toHaveURL(/\/dashboard\/clients\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Evergreen Analytics" })).toBeVisible();
    await expect(page.getByText("jamie@evergreen-demo.com")).toBeVisible();
  });

  test("client form shows validation errors", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.getByRole("button", { name: "New client" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill("not-an-email");
    await dialog.getByRole("button", { name: "Create client" }).click();
    await expect(dialog.getByText("Company is required")).toBeVisible();
    await expect(dialog.getByText("Enter a valid email address")).toBeVisible();
  });

  test("user can create a project", async ({ page }) => {
    await page.goto("/dashboard/projects");
    await page.getByRole("button", { name: "New project" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Project name").fill("Atlas Annual Report");
    await dialog.getByLabel("Client").selectOption({ label: "Atlas Consulting" });
    await dialog.getByLabel("Priority").selectOption("high");
    await dialog.getByLabel("Start date").fill("2026-11-01");
    await dialog.getByLabel("Due date").fill("2026-12-15");
    await dialog.getByLabel("Budget (USD)").fill("8500");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Atlas Annual Report" })).toBeVisible();
    await expect(page.getByText("$8,500").first()).toBeVisible();
  });

  test("user can create a task and complete it", async ({ page }) => {
    await page.goto("/dashboard/tasks?view=table");
    await page.getByRole("button", { name: "New task" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Prepare Q4 retainer proposal");
    await dialog.getByLabel("Project").selectOption({ label: "Northstar Website Redesign" });
    await dialog.getByLabel("Assignee").selectOption({ label: "Alex Morgan" });
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByRole("button", { name: "Prepare Q4 retainer proposal" })).toBeVisible();

    await page.getByRole("checkbox", { name: "Complete Prepare Q4 retainer proposal" }).click();
    await expect(page.getByRole("checkbox", { name: "Reopen Prepare Q4 retainer proposal" })).toBeChecked();

    // The board shows it in the Done column, and the drawer reports its status.
    await page.goto("/dashboard/tasks");
    await expect(page.getByTestId("column-done").getByText("Prepare Q4 retainer proposal")).toBeVisible();
    await page.getByTestId("column-done").getByText("Prepare Q4 retainer proposal").click();
    await expect(page.getByLabel("Task status")).toHaveValue("done");
  });

  test("tasks can be dragged between Kanban columns", async ({ page }) => {
    await page.goto("/dashboard/tasks?q=Influencer");
    const card = page.getByTestId("column-backlog").getByText("Influencer shortlist");
    await expect(card).toBeVisible();
    const target = page.getByTestId("column-in_progress");
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 10, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByTestId("column-in_progress").getByText("Influencer shortlist")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("column-in_progress").getByText("Influencer shortlist")).toBeVisible();
  });

  test("user can create an invoice with multiple line items", async ({ page }) => {
    await page.goto("/dashboard/invoices/new");
    await page.waitForLoadState("networkidle");
    await page.locator("#inv-client").selectOption({ label: "Lunar Creative" });
    await page.locator("#item-0-desc").fill("Website Design");
    await page.locator("#item-0-qty").fill("20");
    await page.locator("#item-0-rate").fill("120");
    await page.getByRole("button", { name: "Add line item" }).click();
    await page.locator("#item-1-desc").fill("Hosting Setup");
    await page.locator("#item-1-qty").fill("1");
    await page.locator("#item-1-rate").fill("300");
    await expect(page.getByTestId("invoice-subtotal")).toHaveText("$2,700.00");
    await expect(page.getByTestId("invoice-tax")).toHaveText("$243.00");
    await expect(page.getByTestId("invoice-total")).toHaveText("$2,943.00");
    await page.getByRole("button", { name: "Create draft invoice" }).click();

    await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]+$/);
    await expect(page.getByRole("article").getByText("Lunar Creative")).toBeVisible();
    await expect(page.getByRole("article").getByText("$2,943.00").first()).toBeVisible();
    await page.getByRole("button", { name: "Mark as sent" }).click();
    await expect(page.getByRole("button", { name: "Mark as paid" })).toBeVisible();
    await page.getByRole("button", { name: "Mark as paid" }).click();
    await expect(page.getByRole("article").getByText("Paid", { exact: true })).toBeVisible();

    const pdf = await page.request.get(page.url().replace("/dashboard/invoices/", "/api/invoices/") + "/pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  });

  test("global search finds records with Ctrl+K", async ({ page }) => {
    const dialog = page.getByRole("dialog");
    // Retry until the page has hydrated and the shortcut listener is attached.
    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass();
    await dialog.getByPlaceholder("Search or jump to…").fill("Northstar");
    await expect(dialog.getByRole("option", { name: /^Northstar Studio/ })).toBeVisible();
    await expect(dialog.getByRole("option", { name: /^Northstar Website Redesign/ })).toBeVisible();
    await dialog.getByRole("option", { name: /^Northstar Studio/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/clients\//);
    await expect(page.getByRole("heading", { level: 1, name: "Northstar Studio" })).toBeVisible();
    await expect(page.getByText("$24,800")).toBeVisible();
  });

  test("notifications can be marked as read", async ({ page }) => {
    await page.goto("/dashboard/notifications");
    const before = await page.getByText("Unread:").count();
    expect(before).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByText("Unread:")).toHaveCount(0);
    await expect(page.getByTestId("unread-badge")).toHaveCount(0);
  });

  test("team members can be invited", async ({ page }) => {
    await page.goto("/dashboard/team");
    // Pro allows 5 seats: 4 members plus Jordan's pending invite. Free a seat first.
    await expect(page.getByText("5 of 5 seats used", { exact: false })).toBeVisible();
    await page.getByRole("listitem").filter({ hasText: "jordan@vertex-demo.com" }).getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("jordan@vertex-demo.com")).toHaveCount(0);
    await page.getByRole("button", { name: "Invite member" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email address").fill("casey@vertex-demo.com");
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    await expect(dialog.getByRole("textbox", { name: "Invite link" })).toHaveValue(/\/invite\/[0-9a-f]+$/);
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "casey@vertex-demo.com" })).toBeVisible();
  });
});
