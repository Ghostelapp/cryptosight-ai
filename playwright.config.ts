import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
    env: { APP_ORIGIN: "http://127.0.0.1:3100", NODE_ENV: "development" },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
