import { describe, expect, it } from 'vitest';

import { MAX_TOASTS, TOAST_FADE_MS, TOAST_MS, ToastShelf, packGains } from '../src/hud/toasts';

describe('what the pack gained', () => {
  it('is everything there is more of, and how many more', () => {
    const before = [
      { item: 'stick' as const, count: 2 },
      { item: 'axe' as const, count: 1 },
    ];
    const after = [
      { item: 'stick' as const, count: 5 },
      { item: 'axe' as const, count: 1 },
      { item: 'flower' as const, count: 1 },
    ];
    expect(packGains(before, after)).toEqual([
      { item: 'stick', count: 3 },
      { item: 'flower', count: 1 },
    ]);
  });

  it('ignores anything there is less of, or that is gone', () => {
    const before = [
      { item: 'stick' as const, count: 5 },
      { item: 'log' as const, count: 2 },
    ];
    const after = [{ item: 'stick' as const, count: 1 }];
    expect(packGains(before, after)).toEqual([]);
  });

  it('counts a crafted thing as gained even while what it was made from is used up', () => {
    const before = [{ item: 'stick' as const, count: 4 }];
    const after = [
      { item: 'stick' as const, count: 2 },
      { item: 'torch' as const, count: 1 },
    ];
    expect(packGains(before, after)).toEqual([{ item: 'torch', count: 1 }]);
  });
});

describe('the toasts', () => {
  it('shows each thing gained', () => {
    const shelf = new ToastShelf();
    shelf.add([{ item: 'stick', count: 1 }], 0);
    expect(shelf.current(0)).toEqual([{ id: 1, item: 'stick', count: 1, fading: false }]);
  });

  it('adds repeats of the same thing together rather than stacking up copies', () => {
    const shelf = new ToastShelf();
    shelf.add([{ item: 'stick', count: 1 }], 0);
    shelf.add([{ item: 'stick', count: 1 }], 500);
    shelf.add([{ item: 'stick', count: 1 }], 1000);
    const showing = shelf.current(1000);
    expect(showing).toHaveLength(1);
    expect(showing[0]?.count).toBe(3);
  });

  it('keeps a toast up a while longer every time it grows', () => {
    const shelf = new ToastShelf();
    shelf.add([{ item: 'stick', count: 1 }], 0);
    shelf.add([{ item: 'stick', count: 1 }], TOAST_MS - 100);
    expect(shelf.current(TOAST_MS + 100)).toHaveLength(1);
  });

  it('fades out at the end, then goes', () => {
    const shelf = new ToastShelf();
    shelf.add([{ item: 'flower', count: 2 }], 0);
    expect(shelf.current(TOAST_MS - TOAST_FADE_MS - 1)[0]?.fading).toBe(false);
    expect(shelf.current(TOAST_MS - TOAST_FADE_MS)[0]?.fading).toBe(true);
    expect(shelf.current(TOAST_MS)).toEqual([]);
  });

  it('starts a fresh count once the last one has gone', () => {
    const shelf = new ToastShelf();
    shelf.add([{ item: 'stick', count: 2 }], 0);
    shelf.add([{ item: 'stick', count: 1 }], TOAST_MS + 1);
    expect(shelf.current(TOAST_MS + 1)).toEqual([
      { id: 2, item: 'stick', count: 1, fading: false },
    ]);
  });

  it('puts whatever was gained most recently last', () => {
    const shelf = new ToastShelf();
    shelf.add([{ item: 'stick', count: 1 }], 0);
    shelf.add([{ item: 'flower', count: 1 }], 10);
    shelf.add([{ item: 'stick', count: 1 }], 20);
    expect(shelf.current(20).map((toast) => toast.item)).toEqual(['flower', 'stick']);
  });

  it('never shows more than a handful at once, letting the oldest go', () => {
    const shelf = new ToastShelf();
    const items = ['stick', 'flower', 'log', 'axe', 'rod', 'torch', 'meat'] as const;
    items.forEach((item, index) => shelf.add([{ item, count: 1 }], index));
    const showing = shelf.current(items.length);
    expect(showing).toHaveLength(MAX_TOASTS);
    expect(showing.at(-1)?.item).toBe('meat');
    expect(showing.some((toast) => toast.item === 'stick')).toBe(false);
  });

  it('clears for a fresh start', () => {
    const shelf = new ToastShelf();
    shelf.add([{ item: 'stick', count: 1 }], 0);
    shelf.clear();
    expect(shelf.current(0)).toEqual([]);
  });
});
