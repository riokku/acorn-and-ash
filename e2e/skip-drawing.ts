import type { BrowserContext, Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Make a page skip the real drawing: every WebGL draw call does nothing.
 *
 * The browsers these tests run in have no graphics card, so "drawing" means a
 * program on the processor painting every blade of grass and leaf in the
 * forest, which takes two to three seconds a frame. The game moves a player a
 * fixed step per frame, so holding a key for a second moved them a metre or
 * less, and every test that walked up to a tree or an item gave up before it
 * got there (decision 0100). With the draw calls turned off a frame takes well
 * under a tenth of a second, as it would on a real machine, and everything
 * else - walking, swinging, the server, the hints - runs just as it does for a
 * player.
 *
 * Set `ACORN_E2E_DRAW=1` to draw for real, for example to look at the pictures
 * some tests save. Tests tagged `@real-drawing` are about the drawing itself
 * and draw for their visual assertions; drawnScreenshot restores a real
 * frame for tests that need fast logic between visual checks.
 * Pass sceneOnly for UI reviews that must still draw a separate character
 * preview while suppressing the full world's draw calls.
 */
export async function skipDrawing(
  target: Page | BrowserContext,
  options: { sceneOnly?: boolean } = {},
): Promise<void> {
  if (process.env.ACORN_E2E_DRAW === '1' || process.env.SHOT_DIR) return;
  await target.addInitScript(
    ({ sceneOnly }) => {
      // Galleries are small scenes and provide actual asset-rendering coverage.
      if (new URLSearchParams(location.search).has('gallery')) return;
      const host = window as Window & { acornE2eDrawing?: (enabled: boolean) => void };
      if (host.acornE2eDrawing !== undefined) return;
      const originals: { prototype: Record<string, unknown>; name: string; method: unknown }[] = [];
      const drawCalls = [
        'drawArrays',
        'drawElements',
        'drawArraysInstanced',
        'drawElementsInstanced',
        'drawRangeElements',
      ];
      for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        for (const name of drawCalls) {
          if (name in prototype) {
            const methods = prototype as unknown as Record<string, unknown>;
            originals.push({ prototype: methods, name, method: methods[name] });
          }
        }
      }
      host.acornE2eDrawing = (enabled) => {
        for (const { prototype, name, method } of originals)
          prototype[name] = enabled
            ? method
            : function (this: WebGLRenderingContext | WebGL2RenderingContext, ...args: unknown[]) {
                if (
                  sceneOnly &&
                  this.canvas instanceof HTMLCanvasElement &&
                  this.canvas.id !== 'scene'
                )
                  return Reflect.apply(method as (...args: unknown[]) => unknown, this, args);
              };
      };
      host.acornE2eDrawing(false);
    },
    { sceneOnly: options.sceneOnly === true },
  );
}

/** Render a real screenshot without rasterizing the forest throughout a logic check. */
export async function drawnScreenshot(page: Page, path: string): Promise<void> {
  const drawing = (enabled: boolean) =>
    page.evaluate((on) => {
      (window as Window & { acornE2eDrawing?: (enabled: boolean) => void }).acornE2eDrawing?.(on);
    }, enabled);
  await drawing(true);
  try {
    // Read the real canvas in the same animation frame as the game draw,
    // before its back buffer is discarded. Avoid queuing continuous forest
    // rasterization while Playwright waits for the screenshot compositor.
    const png = await page.evaluate(
      () =>
        new Promise<string>((resolve) =>
          requestAnimationFrame(() => {
            const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
            const pixels = canvas.toDataURL('image/png');
            (window as Window & { acornE2eDrawing?: (enabled: boolean) => void }).acornE2eDrawing?.(
              false,
            );
            resolve(pixels);
          }),
        ),
    );
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
  } finally {
    await drawing(false);
  }
}
