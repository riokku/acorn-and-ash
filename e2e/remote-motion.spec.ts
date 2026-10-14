import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    acornRemoteMotion?: Array<{
      readonly dt: number;
      readonly playerX: number;
      readonly animalX: number;
      readonly leg: number;
    }>;
    acornAdvanceRemoteMotion?: (dt: number) => void;
  }
}

test('actual player and wildlife models share continuous jitter-buffered travel', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.goto('/?gallery=moves&demo=network&renderer=webgl2');
  await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
    timeout: 120_000,
  });
  const metrics = await page.evaluate(() => {
    for (let frame = 0; frame < 120; frame++) window.acornAdvanceRemoteMotion!(1 / 60);
    window.acornRemoteMotion = [];
    for (let frame = 0; frame < 240; frame++) window.acornAdvanceRemoteMotion!(1 / 60);
    const samples = window.acornRemoteMotion!;
    const held: unknown[] = [];
    let pauses = 0,
      fastest = 0,
      changes = 0;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!,
        b = samples[i]!;
      const speed = Math.abs(b.playerX - a.playerX) / b.dt;
      // Turning points have legitimately low speed; exact snapshot holds do not.
      if (speed < 0.00001 && Math.abs(b.playerX) < 2.98) {
        pauses++;
        held.push({ i, a, b });
      }
      fastest = Math.max(fastest, speed);
      if (Math.abs(b.leg - a.leg) > 0.00001) changes++;
      if (Math.abs(b.playerX - b.animalX) > 0.00001) throw Error('actor clocks disagree');
    }
    return { pauses, fastest, changes, count: samples.length, held };
  });
  expect(metrics.count).toBeGreaterThan(200);
  expect(metrics.pauses, JSON.stringify(metrics)).toBe(0);
  expect(metrics.fastest, JSON.stringify(metrics)).toBeLessThan(2);
  expect(metrics.changes).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});
