import { expect, test, type Page } from '@playwright/test';

/**
 * The front page, signing in, and having one character per world (decisions
 * 0103, 0086 and 0087).
 *
 * The browser tests run with test sign-in switched on, so most tests start with
 * a test player already made and no front page. The real front page and the
 * Google and Discord buttons are checked here by pretending the site says
 * nobody is signed in and both are set up.
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

test.describe('the front page', () => {
  test('greets a new visitor with Play, then Create account and Log in', async ({ page }) => {
    await pretendSignedOut(page, { providers: ['google', 'discord'], testSignIn: null });
    await page.goto('/');

    await expect(page.getByTestId('front-door')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Acorn & Ash' })).toBeVisible();
    // Nothing to sign in with until Play is pressed.
    await expect(page.getByRole('link', { name: /with Google/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('link', { name: 'Sign up with Google' })).toHaveAttribute(
      'href',
      '/api/login/google',
    );
    await expect(page.getByRole('link', { name: 'Sign up with Discord' })).toHaveAttribute(
      'href',
      '/api/login/discord',
    );

    await page.getByRole('tab', { name: 'Log in' }).click();
    await expect(page.getByRole('link', { name: 'Log in with Google' })).toHaveAttribute(
      'href',
      '/api/login/google',
    );
    await expect(page.getByRole('link', { name: 'Log in with Discord' })).toHaveAttribute(
      'href',
      '/api/login/discord',
    );
    await expect(page.locator('#home-name')).toHaveCount(0);
  });

  test('puts the Google and Discord marks on their buttons', async ({ page }) => {
    await pretendSignedOut(page, { providers: ['google', 'discord'], testSignIn: null });
    await page.goto('/');
    await page.getByRole('button', { name: 'Play' }).click();

    await expect(page.locator('.front-signin-google .signin-icon')).toBeVisible();
    await expect(page.locator('.front-signin-discord .signin-icon')).toBeVisible();
  });

  test('has a Back link from the choices to Play', async ({ page }) => {
    await pretendSignedOut(page, { providers: ['google'], testSignIn: null });
    await page.goto('/');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });

  test('does not ask for Play twice in the same tab, as when a login returns', async ({ page }) => {
    await pretendSignedOut(page, { providers: ['google'], testSignIn: null });
    await page.goto('/');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.reload();

    await expect(page.getByTestId('front-choices')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(0);
  });

  test('says so plainly when no sign-in has been set up yet', async ({ page }) => {
    await pretendSignedOut(page, { providers: [], testSignIn: null });
    await page.goto('/');
    await page.getByRole('button', { name: 'Play' }).click();

    await expect(page.getByText('Signing in isn’t switched on here yet')).toBeVisible();
    await expect(page.getByRole('link', { name: / with / })).toHaveCount(0);
  });

  test('says so, and clears the address, when a sign-in did not go through', async ({ page }) => {
    await pretendSignedOut(page, { providers: ['google'], testSignIn: null });
    await page.goto('/?signin=failed&error=access_denied&world=keep-me');

    // They already pressed Play, so this lands on the choices, not the Play button.
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

    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Test sign-in' }).click();
    await expect(page.locator('#home-name')).toBeVisible();
  });

  test('shows Play to somebody already signed in, and Play goes straight to their character', async ({
    page,
  }) => {
    const world = `front-${Date.now()}`;
    // Test sign-in is automatic here, which skips the front page. The first
    // visit makes the test player and stays signed in.
    await page.goto(`/?renderer=webgl2&world=${world}`);
    await expect(page.locator('#home-name')).toBeVisible();

    // Now behave like the real game, where test sign-in is not automatic.
    await page.route('**/api/session', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const reply = await route.fetch();
      const body = (await reply.json()) as Record<string, unknown>;
      return route.fulfill({ response: reply, json: { ...body, testSignIn: null } });
    });
    await page.goto(`/?renderer=webgl2&world=${world}`);

    await expect(page.getByTestId('front-door')).toBeVisible();
    await expect(page.locator('#home-name')).toHaveCount(0);
    await page.getByRole('button', { name: 'Play' }).click();
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
