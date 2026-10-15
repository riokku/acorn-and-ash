import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { ItemCatalog } from '../src/item-catalog';
import { TestClient, waitFor } from './helpers';
const catalog = () => env.ITEM_CATALOG.get(env.ITEM_CATALOG.idFromName('items'));
it('keeps drafts private, checks both revisions and retains published data across object reconstruction', async () => {
  const stub = catalog();
  const initial = await stub.adminState();
  const draft = await stub.saveDraft(
    initial.draft.revision,
    { axe: { displayName: 'River axe', bonuses: { power: 75 } } },
    'owner',
  );
  expect(draft?.draft.overrides.axe?.displayName).toBe('River axe');
  expect((await stub.published()).overrides.axe).toBeUndefined();
  expect(await stub.saveDraft(initial.draft.revision, {}, 'other-tab')).toBeNull();
  expect(
    await stub.publish(initial.draft.revision, initial.published.revision, 'owner'),
  ).toBeNull();
  const published = await stub.publish(draft!.draft.revision, initial.published.revision, 'owner');
  expect(published?.published.overrides.axe?.bonuses?.power).toBe(75);
  expect(
    await stub.publish(draft!.draft.revision, initial.published.revision, 'other-tab'),
  ).toBeNull();
  await runInDurableObject(stub, (_instance, ctx) => {
    const reconstructed = new ItemCatalog(ctx, {});
    expect(reconstructed.published().overrides.axe?.displayName).toBe('River axe');
    expect(reconstructed.adminState().history[0]?.changedItems).toBe(1);
  });
  await runInDurableObject(stub, (instance) => {
    expect(() =>
      (instance as ItemCatalog).saveDraft(
        draft!.draft.revision,
        { axe: { bonuses: { power: 9999 } } },
        'owner',
      ),
    ).toThrow();
  });
});
it('sends only published content on connect and refreshes a connected world after publishing', async () => {
  const stub = catalog();
  const state = await stub.adminState();
  const first = await stub.saveDraft(
    state.draft.revision,
    { axe: { displayName: 'Published axe' } },
    'owner',
  );
  await stub.publish(first!.draft.revision, state.published.revision, 'owner');
  const client = await TestClient.connect('catalogue-live');
  await waitFor('initial catalogue', () =>
    client.received.some(
      (m) => m.type === 'itemCatalog' && m.overrides.axe?.displayName === 'Published axe',
    ),
  );
  const current = await stub.adminState();
  const draft = await stub.saveDraft(
    current.draft.revision,
    { axe: { displayName: 'New axe' } },
    'owner',
  );
  expect((await stub.published()).overrides.axe?.displayName).toBe('Published axe');
  await stub.publish(draft!.draft.revision, current.published.revision, 'owner');
  const world = env.WORLD.get(env.WORLD.idFromName('catalogue-live'));
  await runInDurableObject(world, (instance) => {
    (instance as unknown as { catalogCheckedAt: number }).catalogCheckedAt = 0;
  });
  await waitFor('published catalogue update', () =>
    client.received.some(
      (m) => m.type === 'itemCatalog' && m.overrides.axe?.displayName === 'New axe',
    ),
  );
  client.close();
});
