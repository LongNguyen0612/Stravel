import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "suite-1-b2c-demo",
      testMatch: /suite-1/,
    },
    {
      name: "suite-2-b2b-copilot",
      testMatch: /suite-2/,
      dependencies: ["suite-1-b2c-demo"],
    },
    {
      name: "suite-3-compliance-edge",
      testMatch: /suite-3/,
      dependencies: ["suite-2-b2b-copilot"],
    },
  ],
});
