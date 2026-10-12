import { expect, it } from 'vitest';
import {
  STREAM,
  createWildernessTerrain,
  streamPointAt,
  streamSurfaceAt,
  streamWaterHalfWidthAt,
} from '@acorn/shared';
import { createGroundShader } from '../src/art/ground-shading';
import { createGround } from '../src/scene/wilderness';

it.each([1234, 734])(
  'keeps rendered terrain below waterfall channels and supports digging (seed %i)',
  (seed) => {
    const terrain = createWildernessTerrain(seed);
    const ground = createGround(
      terrain,
      createGroundShader({ water: [], props: [], stream: STREAM }),
    );
    const divisions = 8;
    const renderedHeight = (x: number, z: number) => {
      const cellX = Math.floor((x - ground.origin) / ground.cell),
        cellZ = Math.floor((z - ground.origin) / ground.cell);
      const patch = ground.lattice!(cellX, cellZ, divisions)!;
      const u = ((x - ground.origin) / ground.cell - cellX) * divisions,
        v = ((z - ground.origin) / ground.cell - cellZ) * divisions;
      const i = Math.min(divisions - 1, Math.floor(u)),
        j = Math.min(divisions - 1, Math.floor(v)),
        a = j * (divisions + 1) + i;
      const y = (vertex: number) => patch.position[vertex * 3 + 1]!;
      const du = u - i,
        dv = v - j;
      return du + dv <= 1
        ? y(a) * (1 - du - dv) + y(a + 1) * du + y(a + divisions + 1) * dv
        : y(a + 1) * (1 - dv) +
            y(a + divisions + 1) * (1 - du) +
            y(a + divisions + 2) * (du + dv - 1);
    };
    for (const fall of STREAM.falls)
      for (const offset of [-4, -2, -1, 0, 1, 2, 4]) {
        const along = fall.at + offset,
          sample = along / (STREAM.length / (STREAM.count - 1)),
          row = Math.floor(sample),
          u = sample - row;
        const a = streamPointAt(STREAM, row),
          b = streamPointAt(STREAM, row + 1),
          length = Math.hypot(b.x - a.x, b.z - a.z);
        for (const across of [-0.6, 0, 0.6]) {
          const reach = streamWaterHalfWidthAt(STREAM, along) * across;
          const x = a.x + (b.x - a.x) * u - ((b.z - a.z) / length) * reach,
            z = a.z + (b.z - a.z) * u + ((b.x - a.x) / length) * reach;
          expect(
            streamSurfaceAt(STREAM, along) - renderedHeight(x, z),
            `fall ${fall.at}, offset ${offset}, across ${across}`,
          ).toBeGreaterThan(0.04);
        }
      }
    const center = streamPointAt(
      STREAM,
      Math.round(STREAM.falls[0]!.at / (STREAM.length / (STREAM.count - 1))),
    );
    const cellX = Math.floor((center.x - ground.origin) / ground.cell),
      cellZ = Math.floor((center.z - ground.origin) / ground.cell);
    const patch = ground.lattice!(cellX, cellZ, divisions)!;
    for (let i = 0; i < patch.position.length / 3; i++)
      expect(patch.normal[i * 3 + 1]).toBeGreaterThan(0);
    const index = ground.mesh.geometry.getIndex()!;
    const before = Array.from(index.array);
    ground.hide(cellX, cellZ);
    const removed = before.filter((value, i) => value !== index.getX(i));
    expect(removed.length).toBeGreaterThan(6);
    ground.dispose();
  },
  15_000,
);
