import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = process.env.E2E_PORT ?? '5176';
const E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  expect: {
    timeout: 15_000,
  },
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  outputDir: 'test-results',
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
      },
    },
    {
      name: 'tablet-chromium',
      use: {
        ...devices['iPad Pro 11'],
        browserName: 'chromium',
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: 0,
  testDir: './e2e',
  timeout: 120_000,
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
      command: `yarn dev --host 127.0.0.1 --port ${E2E_PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
        url: E2E_BASE_URL,
      },
  workers: 1,
});
