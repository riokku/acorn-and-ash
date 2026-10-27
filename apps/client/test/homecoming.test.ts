import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Homecoming } from '../src/hud/homecoming';
import { HomecomingCard } from '../src/hud/Homecoming';

it('combines confirmed collections and discoveries into one outing, then starts fresh', () => {
  const trip = new Homecoming();
  expect(trip.arrive()).toBeNull();
  trip.collect('log', 2);
  trip.collect('flower', 1);
  trip.collect('log', 3);
  trip.discover();
  const recap = trip.arrive()!;
  expect(recap.gathered).toEqual([
    { item: 'log', count: 5 },
    { item: 'flower', count: 1 },
  ]);
  expect(recap.discoveries).toBe(1);
  expect(trip.arrive()).toBeNull();
  trip.collect('stone', 2);
  expect(trip.arrive()!.id).toBeGreaterThan(recap.id);
});
it('does not celebrate an empty outing, invalid gains, reconnect or knockout losses', () => {
  const trip = new Homecoming();
  trip.collect('log', 0);
  trip.collect('log', -1);
  trip.collect('log', NaN);
  expect(trip.arrive()).toBeNull();
  trip.collect('log', 2);
  trip.discover();
  trip.clear();
  expect(trip.arrive()).toBeNull();
});
it('labels the recap as gathered rather than claiming everything is still in the pack', () => {
  const html = renderToStaticMarkup(
    createElement(HomecomingCard, {
      summary: {
        id: 1,
        gathered: [{ item: 'log', count: 5 }],
        discoveries: 2,
      },
    }),
  );
  expect(html).toContain('Gathered on this outing');
  expect(html).toContain('+5 Logs');
  expect(html).toContain('2 new places discovered.');
  expect(html).toContain('Dismiss outing recap');
});
