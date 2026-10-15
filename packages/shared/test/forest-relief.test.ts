import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_SEED, PLAYER_RADIUS, PLAYABLE_HALF_EXTENT, PROP_KINDS } from '../src/index';
import { FOREST_TERRACES, FOREST_TRAILS, forestTrailAt } from '../src/world/forest-relief';
import { createWildernessTerrain } from '../src/world/terrain';
import { buildTestClearing } from '../src/world/clearing';
import { buildWilderness } from '../src/world/wilderness';
import { createCollisionWorld } from '../src/collision/capsule';
import { createInput, createPlayerMotion, stepPlayer } from '../src/sim/player';
import { LAKE, lakeWaterDepthAt } from '../src/world/lake';
import { STREAM, streamPointAt, streamPools, streamWaterDepthAt } from '../src/world/stream';
import { buildEncounterSites, encounterColliders } from '../src/world/encounters';

describe('wooded terraces and contour trails', () => {
  it.each([1, 1234, 4242, DEFAULT_WORLD_SEED])(
    'has gentle, dry treads and useful resting shelves in world %i',
    (seed) => {
      const terrain = createWildernessTerrain(seed);
      for (const bench of FOREST_TERRACES) {
        if (bench.slopeX !== undefined || bench.slopeZ !== undefined) continue;
        expect(terrain.heightAt(bench.x, bench.z)).toBeCloseTo(bench.height, 1);
        for (const [dx, dz] of [
          [6, 0],
          [-6, 0],
          [0, 6],
          [0, -6],
        ])
          expect(
            Math.abs(terrain.heightAt(bench.x + dx!, bench.z + dz!) - bench.height),
          ).toBeLessThan(1);
      }
      for (const trail of FOREST_TRAILS) {
        for (let i = 1; i < trail.points.length; i++) {
          const a = trail.points[i - 1]!,
            b = trail.points[i]!;
          const run = Math.hypot(b.x - a.x, b.z - a.z);
          const rise = Math.abs(terrain.heightAt(b.x, b.z) - terrain.heightAt(a.x, a.z));
          expect(rise / run).toBeLessThan(0.4);
          expect(lakeWaterDepthAt(LAKE, b.x, b.z)).toBe(0);
          expect(streamWaterDepthAt(STREAM, b.x, b.z)).toBe(0);
          const acrossX = -(b.z - a.z) / run,
            acrossZ = (b.x - a.x) / run;
          for (const side of [-1, 1])
            expect(
              Math.abs(
                terrain.heightAt(b.x + acrossX * side, b.z + acrossZ * side) -
                  terrain.heightAt(b.x, b.z),
              ),
            ).toBeLessThan(0.15);
        }
      }
    },
  );

  it('keeps the water bed unchanged in the river and pools', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    for (let row = 0; row < STREAM.count; row += 3) {
      const p = streamPointAt(STREAM, row);
      expect(terrain.heightAt(p.x, p.z)).toBeCloseTo(terrain.sceneryHeightAt!(p.x, p.z), 8);
    }
    for (const pool of [LAKE, ...streamPools(STREAM)])
      for (const circle of pool.basin)
        expect(terrain.heightAt(circle.x, circle.z)).toBeCloseTo(
          terrain.sceneryHeightAt!(circle.x, circle.z),
          8,
        );
  });

  it('preserves seeded tree positions, numbers and sizes when changing their ground', () => {
    const seed = DEFAULT_WORLD_SEED,
      terrain = createWildernessTerrain(seed);
    const before = buildWilderness(seed, { kind: 'original', heightAt: terrain.sceneryHeightAt! });
    const originals = new Map(before.props.map((p) => [p.id, p]));
    for (const prop of buildWilderness(seed, terrain).props) {
      const old = originals.get(prop.id);
      expect(old).toBeDefined();
      expect([prop.x, prop.z, prop.rotationY, prop.scale]).toEqual([
        old!.x,
        old!.z,
        old!.rotationY,
        old!.scale,
      ]);
      expect(prop.y).toBe(terrain.heightAt(prop.x, prop.z));
    }
  });

  it.each([1234, DEFAULT_WORLD_SEED])(
    'walks every complete route with actual scenery and encounter collision in world %i',
    (seed) => {
      const terrain = createWildernessTerrain(seed);
      const clearing = buildTestClearing(seed, terrain),
        forest = buildWilderness(seed, terrain);
      const sites = buildEncounterSites(
        seed,
        terrain,
        [...clearing.colliders, ...forest.siteColliders],
        clearing.water,
        LAKE,
      );
      const world = createCollisionWorld(
        terrain,
        [...clearing.colliders, ...forest.colliders, ...encounterColliders(sites, terrain)],
        PLAYABLE_HALF_EXTENT,
        LAKE,
        true,
        STREAM,
      );
      for (const prop of [...clearing.props, ...forest.props]) {
        const trail = forestTrailAt(prop.x, prop.z);
        if (trail)
          expect(trail.distance).toBeGreaterThanOrEqual(
            trail.halfWidth + PROP_KINDS[prop.kind].colliderRadius * prop.scale + PLAYER_RADIUS,
          );
      }
      for (const trail of FOREST_TRAILS) {
        const first = trail.points[0]!;
        const motion = createPlayerMotion({
          x: first.x,
          y: terrain.heightAt(first.x, first.z),
          z: first.z,
        });
        let seq = 0;
        for (const point of trail.points.slice(1)) {
          let ticks = 0;
          while (
            Math.hypot(point.x - motion.position.x, point.z - motion.position.z) > 0.45 &&
            ticks++ < 40
          ) {
            const dx = point.x - motion.position.x,
              dz = point.z - motion.position.z;
            stepPlayer(motion, createInput(seq++, 0, 1, Math.atan2(-dx, -dz)), 0.05, world);
          }
          expect(ticks, `${trail.name} blocked near ${point.x}, ${point.z}`).toBeLessThan(40);
          expect(
            Math.abs(motion.position.y - terrain.heightAt(motion.position.x, motion.position.z)),
          ).toBeLessThan(0.15);
        }
        const end = trail.points.at(-1)!;
        expect(Math.hypot(end.x - motion.position.x, end.z - motion.position.z)).toBeLessThan(0.5);
        expect(motion.position.y).toBeGreaterThan(end.y - 0.5);
      }
    },
  );
});
