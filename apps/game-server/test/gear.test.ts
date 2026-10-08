import { expect, it } from 'vitest';
import {
  countOf,
  inventoryFromEntries,
  type InventoryMessage,
  type WornMessage,
} from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';

const lastWorn = (client: TestClient) =>
  client.received.filter((message): message is WornMessage => message.type === 'worn').at(-1);
const lastPack = (client: TestClient) => {
  const message = client.received
    .filter((entry): entry is InventoryMessage => entry.type === 'inventory')
    .at(-1);
  return inventoryFromEntries(message?.items ?? []);
};
const wornBy = (client: TestClient) =>
  lastWorn(client)?.players.find((entry) => entry.netId === client.welcome().netId)?.worn;

it('puts gear on from the pack, tells the others, and remembers it for next time', async () => {
  const worldId = `gear-${Date.now()}`;
  const wearer = await TestClient.connect(worldId, 'gear-wearer', undefined, true);
  await waitFor('wearer welcome', () => wearer.received.some((m) => m.type === 'welcome'));
  await waitFor('gear in the pack', () => countOf(lastPack(wearer), 'bearHat') === 1);

  const watcher = await TestClient.connect(worldId, 'gear-watcher');
  await waitFor('watcher welcome', () => watcher.received.some((m) => m.type === 'welcome'));

  wearer.gear({ action: 'wear', item: 'bearHat', slot: 'helm' });
  await waitFor('worn tells the wearer', () => wornBy(wearer)?.helm === 'bearHat');
  expect(countOf(lastPack(wearer), 'bearHat')).toBe(0);
  await waitFor(
    'worn tells the watcher',
    () => lastWorn(watcher)?.players.some((entry) => entry.worn.helm === 'bearHat') === true,
  );

  wearer.gear({ action: 'wear', item: 'ironSword', slot: 'mainHand' });
  await waitFor('weapon worn', () => wornBy(wearer)?.mainHand === 'ironSword');
  // The weapon is what the wearer holds, and everyone is told.
  await waitFor('weapon in hand', () =>
    watcher.received.some(
      (m) => m.type === 'equipped' && m.players.some((p) => p.item === 'ironSword'),
    ),
  );

  wearer.close();
  await sleep(300);

  const again = await TestClient.connect(worldId, 'gear-wearer');
  await waitFor('welcome back', () => again.received.some((m) => m.type === 'welcome'));
  await waitFor('worn again', () => wornBy(again)?.helm === 'bearHat');
  expect(wornBy(again)).toEqual({ helm: 'bearHat', mainHand: 'ironSword' });
  expect(countOf(lastPack(again), 'bearHat')).toBe(0);

  again.gear({ action: 'takeOff', slot: 'helm' });
  await waitFor('taken off', () => wornBy(again)?.helm === undefined);
  expect(countOf(lastPack(again), 'bearHat')).toBe(1);
  again.close();
  watcher.close();
});

it('turns down gear in the wrong slot, and only asking for gear in a preview hands it out', async () => {
  const worldId = `gear-refuse-${Date.now()}`;
  const plain = await TestClient.connect(worldId, 'gear-plain');
  await waitFor('welcome', () => plain.received.some((m) => m.type === 'welcome'));
  expect(countOf(lastPack(plain), 'bearHat')).toBe(0);

  plain.gear({ action: 'wear', item: 'bearHat', slot: 'helm' });
  await waitFor('refused for not being held', () =>
    plain.received.some((m) => m.type === 'gearRefused' && m.reason === 'missing'),
  );
  plain.gear({ action: 'wear', item: 'bearHat', slot: 'feet' });
  await waitFor('refused for the wrong slot', () =>
    plain.received.some((m) => m.type === 'gearRefused' && m.reason === 'wrongSlot'),
  );
  plain.close();
});
