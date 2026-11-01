import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
test('painted icon catalog visual review', async ({ page }) => {
  const dir = process.env.ICON_REVIEW_SHOTS;
  test.skip(!dir, 'Set ICON_REVIEW_SHOTS to capture the catalog.');
  await mkdir(dir!, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/?gallery=icons');
  await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
  const cards = page.locator('.icon-review-card');
  expect(await cards.count()).toBeGreaterThan(90);
  const data = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('clipPath[id]')).map((el) => el.id);
    const images = Array.from(document.querySelectorAll('svg image'));
    return {
      ids,
      imageCount: images.length,
      atlases: [...new Set(images.map((el) => el.getAttribute('href')))],
      bundle: performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .find((n) => /\/assets\/index-[^/]+\.js/.test(n)),
      loaded: performance
        .getEntriesByType('resource')
        .filter((r) => r.name.endsWith('.webp'))
        .map((r) => r.name),
    };
  });
  expect(data.imageCount).toBe((await cards.count()) * 8);
  expect(new Set(data.ids).size).toBe(data.ids.length);
  expect(data.atlases.length).toBe(6);
  expect(data.loaded.length).toBe(6);
  await page.screenshot({ path: `${dir}/icons-board.png`, fullPage: true });
  for (const [name, pattern] of [
    ['requiem', /King.s Requiem/i],
    ['knife', /knife/i],
    ['compass', /^compass \(system\)$/i],
    ['health', /^health \(system\)$/i],
  ] as const) {
    const card = cards.filter({ has: page.getByRole('heading', { name: pattern }) }).first();
    await expect(card).toBeVisible();
    await card.screenshot({ path: `${dir}/${name}.png` });
  }
  await writeFile(`${dir}/gallery-metadata.json`, JSON.stringify(data, null, 2));
  expect(errors).toEqual([]);
});
