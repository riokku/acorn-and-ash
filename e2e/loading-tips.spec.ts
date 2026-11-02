import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
});

test('cycles optional trail tips by keyboard without moving progress or focus', async ({
  page,
}) => {
  for (const width of [1366, 900, 600]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 600 });
    await page.goto('/?gallery=loading-tips');
    const tip = page.getByRole('complementary', { name: 'Trail tip' });
    const next = tip.getByRole('button', { name: 'Next tip', exact: true });
    const progress = page.getByRole('progressbar', { name: 'Entering the woods' });
    await expect(tip).toBeVisible();
    const firstCard = (await tip.boundingBox())!;
    const firstProgress = (await progress.boundingBox())!;
    const subjects = ['Equip an axe', 'Roast meat', 'Warm clothing', 'After a knockout'];
    await next.focus();
    for (let index = 0; index < subjects.length; index++) {
      await expect(tip).toContainText(`${index + 1} of 4`);
      await expect(tip).toContainText(subjects[index]!);
      await expect(progress).toHaveAttribute('aria-valuenow', '42');
      await expect(progress).toHaveAttribute('aria-valuetext', '42% · Preparing your journey');
      await expect(page.getByRole('status')).toHaveText('Preparing your journey');
      const card = (await tip.boundingBox())!;
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(width);
      expect(card.height).toBeCloseTo(firstCard.height, 0);
      expect((await progress.boundingBox())!.y).toBeCloseTo(firstProgress.y, 0);
      await page.keyboard.press('Space');
      await expect(next).toBeFocused();
    }
    await expect(tip).toContainText('1 of 4');
    await expect(tip).toContainText(subjects[0]!);
  }
});

test('prioritizes loading problems and keeps short windows clear', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  for (const [state, detail, retry] of [
    ['error', 'Could not prepare this world.', true],
    ['rejected', 'This world is full. Try again in a moment.', true],
    ['offline', 'Cannot reach the world server. Retrying…', false],
    ['elsewhere', 'You are playing in another tab or window.', false],
    ['deleted', 'This character was deleted. Starting over…', false],
  ] as const) {
    await page.goto(`/?gallery=loading-tips&state=${state}`);
    await expect(page.getByRole(state === 'error' ? 'alert' : 'status')).toHaveText(detail);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    await expect(page.getByRole('complementary', { name: 'Trail tip' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next tip' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(
      retry ? 1 : 0,
    );
  }
  await page.setViewportSize({ width: 900, height: 480 });
  await page.goto('/?gallery=loading-tips');
  await expect(page.locator('.loading-tip')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Entering the woods…' })).toBeInViewport();
  await expect(page.getByRole('progressbar')).toBeInViewport();
  await expect(page.getByRole('status')).toBeInViewport();
  await page.goto('/?gallery=loading-tips&state=error');
  await expect(page.getByRole('alert')).toBeInViewport();
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  await expect(retry).toBeInViewport();
  await retry.focus();
  await Promise.all([page.waitForEvent('load'), page.keyboard.press('Enter')]);
  await expect(page.getByRole('alert')).toHaveText('Could not prepare this world.');
});
