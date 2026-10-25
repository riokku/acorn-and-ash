import {
  buildTestClearing,
  buildWilderness,
  createWildernessTerrain,
  DEFAULT_WORLD_SEED,
} from '@acorn/shared';
import { createGrass } from '../src/scene/grass';
// Repeatable CPU-only travel workload; excludes the first layout behind loading.
{
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  const clearing = buildTestClearing(DEFAULT_WORLD_SEED);
  const grass = createGrass(terrain, clearing, buildWilderness(DEFAULT_WORLD_SEED, terrain));
  const frames: number[] = [];
  grass.update(1 / 60, { x: 0, z: 6 }, false);
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    grass.update(1 / 60, { x: i * 0.5, z: 6 + i * 0.5 }, false);
    frames.push(performance.now() - start);
  }
  frames.sort((a, b) => a - b);
  console.log(
    JSON.stringify({ p95: frames[94], max: frames[99], total: frames.reduce((a, b) => a + b, 0) }),
  );
  grass.dispose();
}
