import { expect, test } from '@playwright/test';
import {
  DAY_LENGTH_MS,
  decodeServerMessage,
  encodePong,
  encodeSnapshot,
  encodeWelcome,
} from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('renders wind grass and remembers a lower density setting', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /shader|webgl|wgsl|glsl/i.test(message.text()))
      errors.push(message.text());
  });
  // Keep the visual check in daylight while retaining the real server's world and inputs.
  const started = Date.now();
  const daylightTime = () => DAY_LENGTH_MS * 0.5 + Date.now() - started;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (typeof message === 'string') {
        socket.send(message);
        return;
      }
      const decoded = decodeServerMessage(new Uint8Array(message).buffer);
      if (decoded?.type === 'welcome')
        socket.send(
          Buffer.from(encodeWelcome(decoded.netId, decoded.seed, decoded.tick, daylightTime())),
        );
      else if (decoded?.type === 'snapshot')
        socket.send(
          Buffer.from(
            encodeSnapshot(
              decoded.tick,
              daylightTime(),
              decoded.ackSeq,
              decoded.entities,
              decoded.dodgeCooldown,
            ),
          ),
        );
      else if (decoded?.type === 'pong')
        socket.send(Buffer.from(encodePong(decoded.clientTimeMs, daylightTime())));
      else socket.send(message);
    });
  });
  await page.goto(`/?renderer=webgl2&world=grass-${Date.now()}`);
  await page.locator('#home-name').fill('Grass Walker');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
  await page.locator('.hud-curtain').click();
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.grassClumps() ?? 0))
    .toBeGreaterThan(1000);
  const dense = await page.evaluate(() => window.acornDebug?.grassClumps() ?? 0);
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: process.env.CI
      ? testInfo.outputPath('wind-grass.png')
      : '/workspace/acorn-wind-grass.png',
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Grass density').fill('0.2');
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.grassClumps() ?? 0))
    .toBeLessThan(dense);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('acorn.preferences') ?? '{}').grassDensity,
      ),
    )
    .toBe(0.2);
  await page.getByLabel('Grass density').fill('0');
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('acorn.preferences') ?? '{}').grassDensity,
      ),
    )
    .toBe(0);
  expect(errors).toEqual([]);
});
