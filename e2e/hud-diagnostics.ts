import type { Page } from './fixtures';

/** Read diagnostic data even while details are closed; native interaction is covered in home-transitions. */
export async function hudValue(page: Page, label: string): Promise<string> {
  const row = page
    .locator('.hud-panel .hud-row')
    .filter({ has: page.getByText(label, { exact: true }) });
  return ((await row.locator(':scope > span:nth-child(2)').textContent()) ?? '').trim();
}
