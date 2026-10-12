import { test as base } from '@playwright/test';
import { skipDrawing } from './skip-drawing';

export { expect } from '@playwright/test';
export type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

/**
 * Gameplay checks exercise the browser and simulation without painting an
 * entire forest on CI's CPU. Rendering checks opt in with @real-drawing;
 * galleries and requested screenshots always draw (decision 0100).
 * Apply this to the context so extra tabs inherit it too.
 */
export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    if (!testInfo.tags.includes('@real-drawing') && !process.env.SHOT_DIR)
      await skipDrawing(context);
    await use(context);
  },
});
