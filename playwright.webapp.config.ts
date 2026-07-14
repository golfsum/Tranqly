import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3101";

export default defineConfig({
  testDir: "./tests/webapp",
  webServer: {
    command: "npm run dev -- -p 3101",
    url: `${baseURL}/app`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, TRANQLY_WEB_APP_ENABLED: "true" },
  },
  use: { baseURL, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
