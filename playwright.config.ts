import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests: does the game actually come up in a browser, and do two tabs see
 * each other move? These run the real stack — the client served by apps/web,
 * talking to the World Durable Object in apps/game-server.
 */
const PORT = 8787;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Software rendering, because CI machines have no GPU. The point of
          // these tests is that the game runs, not how fast it draws.
          args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader'],
          // Escape hatch for machines that already have a browser installed
          // somewhere Playwright would not look for it.
          ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
            : {}),
        },
      },
    },
  ],
  webServer: {
    command:
      'pnpm --filter @acorn/client build && ' +
      `pnpm --filter @acorn/web exec wrangler dev -c wrangler.jsonc -c ../game-server/wrangler.jsonc --port ${PORT} --ip 127.0.0.1`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
