import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import type { AdminWorldStatus } from '../packages/shared/src/index';
test.use({ viewport: { width: 1180, height: 950 } });
// Actual compiled UI; only the owner API is stubbed. Worker tests exercise real authorization.
test('reviews one world, blocks occupied worlds, cancels safely and requires exact typed confirmation', async ({
  page,
}, testInfo) => {
  const html = await readFile(new URL('../apps/client/dist/admin.html', import.meta.url), 'utf8');
  let world: AdminWorldStatus = {
    worldId: 'home-clearing',
    seed: 42,
    players: 0,
    savedCharacters: 12,
    builtStructures: 38,
    canReset: true,
    history: [],
  };
  let prepared = 0,
    resets = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/admin/worlds', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  await page.route('**/api/admin/worlds/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET') return route.fulfill({ json: world });
    if (url.pathname.endsWith('/prepare-reset')) {
      prepared++;
      return route.fulfill({
        json: {
          token: `proof-${prepared}`,
          expiresAt: Date.now() + 120000,
          confirmation: 'RESET home-clearing',
          world,
        },
      });
    }
    const body = route.request().postDataJSON();
    expect(body.confirmation).toBe('RESET home-clearing');
    expect(body.token).toBe(`proof-${prepared}`);
    resets++;
    world = {
      ...world,
      savedCharacters: 0,
      builtStructures: 0,
      history: [{ id: resets, resetAt: new Date().toISOString(), characters: 12, structures: 38 }],
    };
    return route.fulfill({ json: world });
  });
  await page.goto('/admin/worlds');
  await expect(page.getByRole('heading', { name: 'World management' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name: 'Worlds' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Inspect world' }).click();
  await expect(page.getByRole('region', { name: 'World status' })).toContainText('12');
  await page.screenshot({ path: testInfo.outputPath('world-status.png'), fullPage: true });
  world = { ...world, players: 1, canReset: false };
  await page.getByRole('button', { name: 'Inspect world' }).click();
  await expect(page.getByRole('button', { name: 'Review full reset' })).toBeDisabled();
  world = { ...world, players: 0, canReset: true };
  await page.getByRole('button', { name: 'Inspect world' }).click();
  await page.getByRole('button', { name: 'Review full reset' }).click();
  const dialog = page.getByRole('dialog'),
    erase = dialog.getByRole('button', { name: 'Permanently reset this world' });
  await expect(dialog).toContainText('12 saved characters and 38 structures');
  await expect(erase).toBeDisabled();
  await page.getByLabel('World reset confirmation').fill('RESET wrong-world');
  await dialog.getByRole('checkbox').check();
  await expect(erase).toBeDisabled();
  await page.getByLabel('World reset confirmation').fill('RESET home-clearing');
  await expect(erase).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('world-confirmation.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(resets).toBe(0);
  await page.getByRole('button', { name: 'Review full reset' }).click();
  await expect(page.getByLabel('World reset confirmation')).toHaveValue('');
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await page.getByLabel('World reset confirmation').fill('RESET home-clearing');
  await dialog.getByRole('checkbox').check();
  await erase.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('home-clearing was reset');
  await expect(page.getByRole('region', { name: 'Reset history' })).toContainText('12 characters');
  expect(resets).toBe(1);
  expect(prepared).toBe(2);
  expect(errors).toEqual([]);
});
test('normal test players cannot open world administration, prepare resets or use the retired URL', async ({
  request,
}) => {
  await request.post('/api/test-sign-in');
  for (const path of ['/admin/worlds', '/api/admin/worlds/home-clearing'])
    expect((await request.get(path)).status()).toBe(403);
  for (const action of ['prepare-reset', 'reset']) {
    const response = await request.post(`/api/admin/worlds/home-clearing/${action}`, {
      data: { token: 'fake', confirmation: 'RESET home-clearing' },
    });
    expect(response.status()).toBe(403);
  }
  expect(
    (await request.get('/api/worlds/home-clearing/reset-players?confirm=clear-everyone')).status(),
  ).toBe(404);
});
