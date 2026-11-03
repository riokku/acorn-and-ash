// Checks that each tree kind's trunk width in the shared table matches its
// models where an axe cuts them, 0.4 m up. The server sizes a felled tree's
// stump from the table, so a table that drifts from the art leaves stumps
// thinner or fatter than the trunks they came from.
// Run with: tsx tools/check-tree-trunks.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getBounds, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { PROP_KINDS, propHeight } from '@acorn/shared';

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/** The near models each kind draws, as listed in apps/client/src/scene/prop-models.ts. */
const MODELS = {
  pine: ['pine-1', 'pine-2', 'pine-3', 'pine-4', 'pine-5'],
  birch: ['western-redcedar', 'western-redcedar-b', 'western-redcedar-c'],
  oak: ['sitka-spruce', 'sitka-spruce-b', 'sitka-spruce-c'],
  maple: ['bigleaf-maple', 'bigleaf-maple-b', 'bigleaf-maple-c'],
  alder: ['red-alder', 'red-alder-b', 'red-alder-c'],
};
const CUT_HEIGHT = 0.4;

for (const [kind, names] of Object.entries(MODELS)) {
  const table = PROP_KINDS[kind].shape.trunkRadius;
  const measured = [];
  for (const name of names) {
    const document = await io.read(
      fileURLToPath(new URL(`../assets/trees/${name}.glb`, import.meta.url)),
    );
    const radius = trunkRadiusAt(document, propHeight(PROP_KINDS[kind]), CUT_HEIGHT);
    assert(radius !== undefined, `${name}: has a trunk at ${CUT_HEIGHT} m`);
    // One shape may be stouter than the rest; the client sizes its stump to it.
    assert(
      Math.abs(radius - table) / table < 0.3,
      `${name}: trunk ${radius.toFixed(2)} m across the cut, table says ${table} m`,
    );
    measured.push(radius);
  }
  const typical = measured.reduce((sum, radius) => sum + radius, 0) / measured.length;
  assert(
    Math.abs(typical - table) / table < 0.1,
    `${kind}: trunks average ${typical.toFixed(2)} m at the cut, table says ${table} m`,
  );
}
console.log('Tree trunk check passed: the table matches every tree model at the cut.');

/**
 * The bark's radius at `height` once the model is scaled to the game's
 * `treeHeight` and stood on its lowest point, as the client loads it: the
 * middle distance from the centre line of where the bark crosses that height.
 */
function trunkRadiusAt(document, treeHeight, height) {
  const bounds = getBounds(document.getRoot().listScenes()[0]);
  const scale = treeHeight / (bounds.max[1] - bounds.min[1]);
  const distances = [];
  for (const node of document.getRoot().listNodes()) {
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (!/bark/i.test(primitive.getMaterial()?.getName() ?? '')) continue;
      const position = primitive.getAttribute('POSITION');
      const corner = [0, 0, 0];
      const points = Array.from({ length: position.getCount() }, (_, i) => {
        const [x, y, z] = position.getElement(i, corner);
        return [
          (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * scale,
          (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] - bounds.min[1]) * scale,
          (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * scale,
        ];
      });
      const indices = primitive.getIndices()?.getArray() ?? points.map((_, i) => i);
      for (let i = 0; i + 2 < indices.length; i += 3) {
        for (const [a, b] of [
          [indices[i], indices[i + 1]],
          [indices[i + 1], indices[i + 2]],
          [indices[i + 2], indices[i]],
        ]) {
          const [ax, ay, az] = points[a];
          const [bx, by, bz] = points[b];
          if ((ay - height) * (by - height) >= 0) continue;
          const t = (ay - height) / (ay - by);
          distances.push(Math.hypot(ax + (bx - ax) * t, az + (bz - az) * t));
        }
      }
    }
  }
  if (distances.length === 0) return undefined;
  distances.sort((a, b) => a - b);
  return distances[Math.floor(distances.length / 2)];
}
