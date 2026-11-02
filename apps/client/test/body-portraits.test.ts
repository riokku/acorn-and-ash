import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CHARACTER_ORDER } from '@acorn/shared';
import { expect, it } from 'vitest';

it('keeps body picker thumbnails derived from the current playable models', () => {
  const report = JSON.parse(
    readFileSync(
      new URL('../../../docs/design/body-portrait-sources.json', import.meta.url),
      'utf8',
    ),
  ) as { sources: Record<string, { model: string; sha256: string; portrait: string }> };
  expect(Object.keys(report.sources).sort()).toEqual([...CHARACTER_ORDER].sort());
  for (const body of CHARACTER_ORDER) {
    const source = report.sources[body]!;
    expect(source.model).toBe(`assets/characters/${body}.glb`);
    expect(source.portrait).toBe(`assets/ui/body-portraits/${body}.webp`);
    const model = readFileSync(new URL(`../../../${source.model}`, import.meta.url));
    expect(
      createHash('sha256').update(model).digest('hex'),
      `${body} changed: refresh picker images with tools/render-body-icons.mjs`,
    ).toBe(source.sha256);
    expect(
      readFileSync(new URL(`../../../${source.portrait}`, import.meta.url)).byteLength,
    ).toBeGreaterThan(0);
  }
});
