import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (process.env.PW_USE_WEBSERVER ? "http://127.0.0.1:3100" : "http://127.0.0.1:3000");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: process.env.CI || process.env.PW_USE_WEBSERVER ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 15000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.PW_USE_WEBSERVER
    ? {
        command:
          "bash -lc 'WEB_ORIGIN=http://127.0.0.1:3100,http://localhost:3100 API_PORT=4100 ./scripts/pnpm.sh --filter @pub/api dev >/tmp/pub-api-e2e.log 2>&1 & WEB_PORT=3100 NEXT_PUBLIC_API_BASE=http://127.0.0.1:4100/api/v1 ./scripts/pnpm.sh --filter @pub/web dev'",
        cwd: "../..",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240000,
      }
    : undefined,
  reporter: [["list"]],
});
