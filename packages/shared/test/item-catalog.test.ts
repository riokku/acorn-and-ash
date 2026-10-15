import { afterEach, expect, it } from 'vitest';
import {
  ITEM_ORDER,
  catalogItem,
  catalogBonuses,
  characterStats,
  parseItemOverrides,
  encodeItemCatalog,
  decodeServerMessage,
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  EQUIPMENT_BONUSES,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
it('resolves every item and preserves code defaults outside published overrides', () => {
  for (const id of ITEM_ORDER) {
    expect(catalogItem(id).displayName).toBeTruthy();
    expect(catalogItem(id).description).toBeTruthy();
  }
  const overrides = parseItemOverrides({
    axe: { displayName: 'Oak axe', bonuses: { power: 80 }, rarity: 'rare' },
  });
  expect(catalogItem('axe', overrides).displayName).toBe('Oak axe');
  expect(characterStats({}, 'axe', catalogBonuses(overrides)).power).toBe(180);
  expect(EQUIPMENT_BONUSES.axe?.power).toBe(10);
  expect(characterStats({ helm: 'bearHat' }, null, catalogBonuses(overrides)).vitality).toBe(115);
});
it.each([
  { missing: { displayName: 'Unknown' } },
  { axe: { stackSize: 999 } },
  { log: { bonuses: { power: 20 } } },
  { axe: { bonuses: { power: -1 } } },
  { axe: { bonuses: { power: 201 } } },
  { axe: { bonuses: { power: NaN } } },
  { bearHat: { bonuses: { warmth: 101 } } },
  { axe: { rarity: 'mythic' } },
  { axe: { displayName: '' } },
  { axe: { description: 'x'.repeat(1001) } },
  { axe: { bonuses: { power: 1.5 } } },
])('rejects invalid data and edits to mechanics: %j', (value) => {
  expect(() => parseItemOverrides(value)).toThrow();
});
it('round trips a validated binary catalogue and rejects corrupt or oversized frames', () => {
  const catalog = { revision: 12, overrides: { axe: { displayName: 'Écorce axe' } } };
  const wire = encodeItemCatalog(catalog);
  expect(decodeServerMessage(wire)).toEqual({ type: 'itemCatalog', ...catalog });
  expect(decodeServerMessage(wire.slice(0, -2))).toBeNull();
  const huge = new Uint8Array(256_002);
  huge[0] = 0x48;
  expect(decodeServerMessage(huge.buffer)).toBeNull();
});
it('applies published caps to existing and reconnecting players without healing', () => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  worlds.push(sim);
  sim.addPlayer(1);
  sim.giveTestGear(1, ['bearHat']);
  sim.wearGear(1, 'bearHat', 'helm');
  const saved = sim.persistablePlayers()[0]!;
  sim.removePlayer(1);
  sim.addPlayer(1, { ...saved, health: 115 });
  sim.setEquipmentBonuses(
    catalogBonuses({ bearHat: { bonuses: { vitality: 5, protection: 40, warmth: 80 } } }),
  );
  expect(sim.healthOf(1)).toBe(105);
  expect(sim.drainHealthEvents().at(-1)).toMatchObject({ health: 105, adjusted: true });
  sim.setEquipmentBonuses(catalogBonuses({ bearHat: { bonuses: { vitality: 50 } } }));
  expect(sim.healthOf(1)).toBe(105);
  sim.removePlayer(1);
  sim.addPlayer(1, { ...saved, health: 150 });
  expect(sim.healthOf(1)).toBe(150);
});
