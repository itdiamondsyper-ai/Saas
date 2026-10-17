import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * End-to-end tests run against a production build in demo mode with an isolated
 * data directory, so they never touch real Supabase or Stripe accounts.
 * Run `npm run test:e2e` (builds first). Set PW_CHANNEL=msedge or chrome to use an
 * installed browser instead of Playwright's bundled Chromium.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    channel: process.env.PW_CHANNEL || undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL || undefined }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, channel: process.env.PW_CHANNEL || undefined }, testMatch: /mobile\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `node scripts/e2e-server.mjs ${PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          FLOWPILOT_DEMO_MODE: "true",
          DEMO_DATA_DIR: ".data-test",
          NEXT_PUBLIC_APP_URL: baseURL,
          DEMO_SESSION_SECRET: "e2e-test-secret",
          CRON_SECRET: "e2e-cron-secret",
        },
      },
});
