import type { BrowserContext, Page } from '@playwright/test';

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
 * and always draw.
 */
export async function skipDrawing(target: Page | BrowserContext): Promise<void> {
  if (process.env.ACORN_E2E_DRAW === '1') return;
  await target.addInitScript(() => {
    const drawCalls = [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
      'drawRangeElements',
    ];
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const name of drawCalls) {
        if (name in prototype) (prototype as unknown as Record<string, unknown>)[name] = () => {};
      }
    }
  });
}
