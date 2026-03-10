/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "pnpm exec next dev -H 127.0.0.1 -p 3000",
    url: "http://127.0.0.1:3000/admin/login",
    timeout: 120_000,
    reuseExistingServer: true,
  },
};

export default config;
