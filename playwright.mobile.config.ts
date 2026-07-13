import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:8093";

function nativePhone(name: keyof typeof devices) {
  const device = devices[name];
  return {
    ...device,
    browserName: "chromium" as const,
    viewport: device.screen ?? device.viewport,
  };
}

function phoneProject(
  name: string,
  device: keyof typeof devices,
  platform: "ios" | "android",
) {
  return {
    name,
    snapshotPathTemplate: `tests/mobile/screenshots/${platform}/${name}/{testFileBaseName}/{arg}{ext}`,
    use: nativePhone(device),
  };
}

export default defineConfig({
  testDir: "./tests/mobile",
  webServer: {
    command: "npm --prefix apps/mobile run start -- --web --port 8093",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    phoneProject("iphone-16-pro", "iPhone 16 Pro", "ios"),
    phoneProject("iphone-se-3rd-gen", "iPhone SE (3rd gen)", "ios"),
    phoneProject("iphone-16-pro-max", "iPhone 16 Pro Max", "ios"),
    phoneProject("galaxy-s24", "Galaxy S24", "android"),
    phoneProject("galaxy-a55", "Galaxy A55", "android"),
  ],
});
