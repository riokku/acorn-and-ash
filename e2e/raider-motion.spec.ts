import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    acornAdvanceRaiderMotion?: (deltaSeconds: number) => void;
    acornRaiderMotion?: Array<{
      readonly dt: number;
      readonly x: number;
      readonly z: number;
      readonly leg: readonly number[];
      readonly walking: boolean;
    }>;
  }
}

test('a rendered skeleton walks continuously despite uneven snapshot delivery', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.goto('/?gallery=raiders&kind=warrior&demo=network&slope=0.15&renderer=webgl2');
  await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
    timeout: 120_000,
  });
  // Exercise the loaded rig at 60 FPS independently of the CI software GPU.
  // The visible gallery uses this exact step function in its render loop.
  await page.evaluate(() => {
    window.acornRaiderMotion = [];
    for (let frame = 0; frame < 360; frame++) window.acornAdvanceRaiderMotion!(1 / 60);
  });
  const metrics = await page.evaluate(() => {
    const frames = window.acornRaiderMotion!;
    let walking = 0;
    let pauses = 0;
    let limbChanges = 0;
    let fastest = 0;
    for (let i = 1; i < frames.length; i++) {
      const before = frames[i - 1]!,
        after = frames[i]!;
      if (!before.walking || !after.walking) continue;
      walking++;
      const speed = Math.hypot(after.x - before.x, after.z - before.z) / after.dt;
      if (speed < 0.1) pauses++;
      fastest = Math.max(fastest, speed);
      if (Math.abs(after.leg[0]! - before.leg[0]!) > 0.0001) limbChanges++;
    }
    return { walking, pauses, limbChanges, fastest };
  });
  expect(metrics.walking).toBeGreaterThan(80);
  expect(metrics.pauses / metrics.walking).toBeLessThan(0.03);
  expect(metrics.fastest).toBeLessThan(3.1);
  expect(metrics.limbChanges / metrics.walking).toBeGreaterThan(0.6);
  expect(errors).toEqual([]);
});
