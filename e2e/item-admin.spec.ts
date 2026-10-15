import { readFile } from 'node:fs/promises';
import { ITEM_ORDER, type CatalogState } from '../packages/shared/src/index';
import { test, expect } from './fixtures';

// The UI uses the real compiled editor. Owner API replies are stubbed here;
// verified Google/session/origin checks run against D1 in the web Worker tests.
test(
  'private item editor searches, saves a draft and reviews publication without losing conflicted edits',
  { tag: '@real-drawing' },
  async ({ page }, testInfo) => {
    let state: CatalogState = {
      draft: { revision: 0, overrides: {} },
      published: { revision: 0, overrides: {} },
      history: [],
    };
    let conflict = false;
    const html = await readFile(new URL('../apps/client/dist/admin.html', import.meta.url), 'utf8');
    await page.route('**/admin/items', (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
    await page.route('**/api/admin/items**', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'GET') return route.fulfill({ json: state });
      if (conflict)
        return route.fulfill({
          status: 409,
          json: {
            error: 'The catalogue changed in another tab. Reload before saving or publishing.',
          },
        });
      const body = route.request().postDataJSON();
      if (url.pathname.endsWith('/draft'))
        state = {
          ...state,
          draft: { revision: state.draft.revision + 1, overrides: body.overrides },
        };
      if (url.pathname.endsWith('/publish'))
        state = {
          ...state,
          history: [
            {
              revision: state.published.revision + 1,
              publishedAt: new Date().toISOString(),
              changedItems: 1,
            },
            ...state.history,
          ],
          published: {
            revision: state.published.revision + 1,
            overrides: structuredClone(state.draft.overrides),
          },
        };
      return route.fulfill({ json: state });
    });
    await page.goto('/admin/items');
    await expect(page.getByRole('heading', { name: 'Item catalogue' })).toBeVisible();
    await expect(
      page.getByText(`${ITEM_ORDER.length} of ${ITEM_ORDER.length} items`),
    ).toBeVisible();
    await expect(page.locator('.model-viewport')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('.model-viewport canvas')).toHaveAttribute('data-item', 'axe');
    const preview = page.locator('.model-viewport canvas');
    await preview.focus();
    await preview.press('ArrowRight');
    await expect(preview).toHaveAttribute('data-yaw', '-0.200');
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(preview).toHaveAttribute('data-yaw', '-0.350');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('River axe');
    await page.getByLabel('Item rarity', { exact: true }).selectOption('rare');
    await page.getByLabel('Attack power (%)').fill('35');
    await expect(page.getByRole('button', { name: 'Review & publish' })).toBeDisabled();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Live items have not changed');
    expect(state.published.overrides.axe).toBeUndefined();
    await page.getByRole('button', { name: 'Review & publish' }).click();
    await expect(page.getByRole('dialog')).toContainText('River axe');
    await expect(page.getByRole('dialog')).toContainText('35');
    await page.mouse.move(10, 10);
    await page.screenshot({ path: testInfo.outputPath('publish-review.png') });
    await page.getByRole('button', { name: 'Keep draft' }).click();
    expect(state.published.revision).toBe(0);
    await page.getByRole('button', { name: 'Review & publish' }).click();
    await page.getByRole('button', { name: 'Publish site-wide' }).click();
    await expect(page.getByRole('status')).toContainText('Version 1 published');
    expect(state.published.overrides.axe?.bonuses?.power).toBe(35);
    await page.getByRole('searchbox', { name: 'Find an item' }).fill('winter');
    await page
      .getByRole('navigation', { name: 'Items' })
      .getByRole('button', { name: /Warm jacket/ })
      .click();
    await expect(page.getByLabel('Warmth', { exact: true })).toHaveValue('60');
    await page.getByLabel('Warmth', { exact: true }).fill('70');
    await page.getByLabel('Filter by rarity').selectOption('rare');
    await expect(page.getByText('No matching items.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByRole('searchbox', { name: 'Find an item' })).toHaveValue('');
    await expect(page.getByLabel('Filter by rarity')).toHaveValue('all');
    await expect(
      page.getByText(`${ITEM_ORDER.length} of ${ITEM_ORDER.length} items`),
    ).toBeVisible();
    await expect(page.getByLabel('Warmth', { exact: true })).toHaveValue('70');
    await expect(preview).toHaveAttribute('data-item', 'winterJacket');
    await expect(page.locator('.model-viewport')).toHaveAttribute('data-state', 'ready');
    await page.mouse.move(10, 10);
    await page.screenshot({ path: testInfo.outputPath('item-editor.png'), fullPage: true });
    conflict = true;
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('changed in another tab');
    await expect(page.getByLabel('Warmth', { exact: true })).toHaveValue('70');
    await page.getByRole('button', { name: 'Restore item defaults' }).click();
    await expect(page.getByLabel('Warmth', { exact: true })).toHaveValue('60');
  },
);

test('test sign-in cannot open the admin editor or its APIs', async ({ request }) => {
  await request.post('/api/test-sign-in');
  for (const path of ['/admin', '/admin/', '/admin/items', '/admin.html', '/api/admin/items']) {
    const response = await request.get(path);
    expect(response.status()).toBe(403);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
  expect((await request.get('/api/items')).status()).toBe(200);
});

test(
  'every catalogue item has a visible model, including rapid selection changes',
  { tag: '@real-drawing' },
  async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const html = await readFile(new URL('../apps/client/dist/admin.html', import.meta.url), 'utf8');
    await page.route('**/admin/items', (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
    await page.route('**/api/admin/items', (route) =>
      route.fulfill({
        json: {
          draft: { revision: 0, overrides: {} },
          published: { revision: 0, overrides: {} },
          history: [],
        },
      }),
    );
    await page.goto('/admin/items');
    for (const id of ITEM_ORDER) {
      await page.getByRole('searchbox', { name: 'Find an item' }).fill(id);
      const row = page
        .getByRole('navigation', { name: 'Items' })
        .getByRole('button')
        .filter({ has: page.locator('small', { hasText: new RegExp(`^${id}$`) }) });
      await row.click();
      await expect(page.locator('.model-viewport canvas')).toHaveAttribute('data-item', id);
      await expect(page.locator('.model-viewport')).toHaveAttribute('data-state', 'ready');
    }
    await page.getByRole('button', { name: 'Clear filters' }).click();
    const rows = page.getByRole('navigation', { name: 'Items' }).getByRole('button');
    await rows.filter({ has: page.locator('small', { hasText: /^knightHelmet$/ }) }).click();
    await rows.filter({ has: page.locator('small', { hasText: /^axe$/ }) }).click();
    await expect(page.locator('.model-viewport canvas')).toHaveAttribute('data-item', 'axe');
    expect(errors).toEqual([]);
  },
);

test(
  'the direct admin button is owner-only on new and returning character screens',
  { tag: '@real-drawing' },
  async ({ page }, testInfo) => {
    let owner = false;
    let made = false;
    await page.route('**/api/session', (route) =>
      route.fulfill({
        json: {
          signedIn: true,
          name: 'Director',
          canEditItems: owner,
          providers: [],
          testSignIn: 'automatic',
        },
      }),
    );
    await page.route('**/api/worlds/*/character', (route) =>
      route.fulfill({
        json: made
          ? { made: true, name: 'Hazel', character: 'knight', color: 'moss' }
          : { made: false },
      }),
    );
    await page.goto('/?renderer=webgl2');
    await expect(page.locator('#home-name')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage items' })).toHaveCount(0);
    owner = true;
    await page.reload();
    await expect(page.getByRole('link', { name: 'Manage items' })).toHaveAttribute(
      'href',
      '/admin',
    );
    made = true;
    await page.reload();
    await expect(page.getByTestId('saved-character')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage items' })).toHaveAttribute(
      'href',
      '/admin',
    );
    await expect(page.getByTestId('character-stage')).toHaveAttribute('data-state', 'ready');
    await page.screenshot({ path: testInfo.outputPath('character-admin-button.png') });
    owner = false;
    await page.reload();
    await expect(page.getByTestId('saved-character')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage items' })).toHaveCount(0);
  },
);
