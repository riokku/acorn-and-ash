import { expect, test, type Page } from '@playwright/test';

/**
 * Signing in, and having one character per world (decisions 0086 and 0087).
 *
 * The browser tests run with test sign-in switched on, so most tests start with
 * a test player already made. The real Google and Discord buttons are checked
 * here by pretending the site says nobody is signed in and both are set up.
 */

async function pretendSignedOut(
  page: Page,
  status: { providers: string[]; testSignIn: string | null },
): Promise<void> {
  await page.route('**/api/session', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: { signedIn: false, ...status } });
  });
}

test.describe('the sign-in screen', () => {
  test('offers Google and Discord, and no way to make a character yet', async ({ page }) => {
    await pretendSignedOut(page, { providers: ['google', 'discord'], testSignIn: null });
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/login/google',
    );
    await expect(page.getByRole('link', { name: 'Continue with Discord' })).toHaveAttribute(
      'href',
      '/api/login/discord',
    );
    await expect(page.locator('#home-name')).toHaveCount(0);
  });

  test('says so plainly when no sign-in has been set up yet', async ({ page }) => {
    await pretendSignedOut(page, { providers: [], testSignIn: null });
    await page.goto('/');

    await expect(page.getByText('Signing in isn’t switched on here yet')).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue with/ })).toHaveCount(0);
  });

  test('says so, and clears the address, when a sign-in did not go through', async ({ page }) => {
    await pretendSignedOut(page, { providers: ['google'], testSignIn: null });
    await page.goto('/?signin=failed&error=access_denied&world=keep-me');

    await expect(page.getByRole('alert')).toContainText('That sign-in didn’t go through');
    expect(new URL(page.url()).search).toBe('?world=keep-me');
  });

  test('shows a test sign-in button on previews, which makes a throwaway player', async ({
    page,
  }) => {
    let signedIn = false;
    await page.route('**/api/session', (route) =>
      route.fulfill({
        json: {
          signedIn,
          name: signedIn ? 'Test player' : undefined,
          providers: [],
          testSignIn: 'button',
        },
      }),
    );
    await page.route('**/api/test-sign-in', (route) => {
      signedIn = true;
      return route.fulfill({ status: 201, json: { created: true } });
    });
    await page.route('**/api/worlds/*/character', (route) =>
      route.fulfill({ json: { made: false } }),
    );
    await page.goto('/');

    await page.getByRole('button', { name: 'Test sign-in' }).click();
    await expect(page.locator('#home-name')).toBeVisible();
  });
});

test.describe('one character per world', () => {
  test('is made once, and every later visit is a welcome back to it', async ({ page }) => {
    const world = `welcome-${Date.now()}`;
    await page.goto(`/?renderer=webgl2&world=${world}`);
    await page.locator('#home-name').fill('Hazel');
    await page.locator('.home-play').click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel');

    await page.goto(`/?renderer=webgl2&world=${world}`);
    const saved = page.getByTestId('saved-character');
    await expect(saved).toContainText('Hazel');
    await expect(page.locator('#home-name')).toHaveCount(0);

    await page.locator('.home-play').click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel');
  });

  test('is kept by the server, whatever a browser says later', async ({ page }) => {
    const world = `kept-${Date.now()}`;
    await page.goto(`/?renderer=webgl2&world=${world}`);
    await page.locator('#home-name').fill('Hazel');
    await page.locator('.home-play').click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel');

    // Pretend the browser's own memory says somebody else, as a changed
    // browser or an edited page might.
    await page.evaluate(() =>
      localStorage.setItem(
        'acorn.identity',
        JSON.stringify({ name: 'Somebody Else', character: 'mage', color: 'plum' }),
      ),
    );
    await page.goto(`/?renderer=webgl2&world=${world}`);
    await page.locator('.home-play').click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel');

    const reply = await page.request.get(`/api/worlds/${world}/character`);
    expect(await reply.json()).toMatchObject({ made: true, name: 'Hazel' });
  });

  test('is separate in each world: a new world is a new character', async ({ page }) => {
    const first = `first-${Date.now()}`;
    await page.goto(`/?renderer=webgl2&world=${first}`);
    await page.locator('#home-name').fill('Hazel');
    await page.locator('.home-play').click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel');

    await page.goto(`/?renderer=webgl2&world=second-${Date.now()}`);
    await expect(page.locator('#home-name')).toBeVisible();
  });

  test('can be left behind by signing out, which starts a different player', async ({ page }) => {
    const world = `signout-${Date.now()}`;
    await page.goto(`/?renderer=webgl2&world=${world}`);
    await page.locator('#home-name').fill('Hazel');
    await page.locator('.home-play').click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel');

    await page.goto(`/?renderer=webgl2&world=${world}`);
    await expect(page.getByTestId('saved-character')).toContainText('Hazel');
    await page.getByRole('button', { name: 'Sign out' }).click();

    // Test sign-in is automatic here, so signing out lands on a brand new test
    // player, who has no character yet.
    await expect(page.locator('#home-name')).toBeVisible();
    await expect(page.getByTestId('saved-character')).toHaveCount(0);
  });
});
