import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { cedarHuntProgress, readCedarHuntPin, writeCedarHuntPin } from '../src/hud/cedar-hunt';
import { CedarHuntPlan } from '../src/hud/CedarHuntPlan';
import { HudStore } from '../src/hud/store';
it('connects the trail, preparation, earned material and exact recipe in the guide', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    carrying: [
      { item: 'reed' as const, count: 3 },
      { item: 'rope' as const, count: 2 },
    ],
  };
  const html = renderToStaticMarkup(createElement(CedarHuntPlan, { state }));
  expect(html).toContain('northwest beyond the elk grove');
  expect(html).toContain('stop and let him settle');
  expect(html).toContain('meal is optional');
  expect(html).toContain('0/1');
  expect(html).toContain('3/4');
  expect(html).toContain('15% less distance');
  expect(html).toContain('Hostile creatures are unaffected');
  expect(html).toContain('Pin upgrade goal');
  expect(html).toContain('personal hide');
});
it('updates the next goal as hide, materials, coat and worn gear arrive', () => {
  const state = new HudStore().getSnapshot();
  expect(cedarHuntProgress(state).next).toContain('hoofprints');
  const hide = { ...state, carrying: [{ item: 'cedarHide' as const, count: 1 }] };
  expect(cedarHuntProgress(hide).next).toContain('Hide secured');
  const ready = {
    ...hide,
    carrying: [
      ...hide.carrying,
      { item: 'rope' as const, count: 2 },
      { item: 'reed' as const, count: 4 },
    ],
  };
  expect(cedarHuntProgress(ready)).toMatchObject({ ready: true, crafted: false });
  expect(
    cedarHuntProgress({ ...state, carrying: [{ item: 'cedarstalkerCoat', count: 1 }] }).next,
  ).toContain('Coat ready');
  expect(cedarHuntProgress({ ...state, worn: { upperBody: 'cedarstalkerCoat' } })).toMatchObject({
    equipped: true,
    crafted: true,
  });
});
it('keeps cosmetic pins separate by world and tolerates unavailable browser storage', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  writeCedarHuntPin(storage, 'mountains', true);
  expect(readCedarHuntPin(storage, 'mountains')).toBe(true);
  expect(readCedarHuntPin(storage, 'other')).toBe(false);
  writeCedarHuntPin(storage, 'mountains', false);
  expect(readCedarHuntPin(storage, 'mountains')).toBe(false);
  expect(
    readCedarHuntPin(
      {
        getItem: () => {
          throw new Error('disabled');
        },
      },
      'mountains',
    ),
  ).toBe(false);
  expect(() =>
    writeCedarHuntPin(
      {
        setItem: () => {
          throw new Error('disabled');
        },
      },
      'mountains',
      true,
    ),
  ).not.toThrow();
});
