// Check shipped meshes, including the bark/foliage material separation.
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const [species, height] of [
  ['douglas-fir', 14],
  ['western-redcedar', 12],
  ['sitka-spruce', 16],
]) {
  for (const suffix of ['', '-distant']) {
    const document = await io.read(
      fileURLToPath(new URL(`../assets/trees/${species}${suffix}.glb`, import.meta.url)),
    );
    const primitives = document
      .getRoot()
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives());
    assert.equal(primitives.length, 2, 'Each tree has two instanced parts');
    assert.deepEqual(primitives.map((p) => p.getMaterial().getName()).sort(), ['Bark', 'Leaves']);
    const triangles = primitives.reduce(
      (sum, p) => sum + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3,
      0,
    );
    assert(triangles <= (suffix ? 800 : 4000), `${species} triangle budget`);
    let top = 0,
      bottom = Infinity;
    for (const p of primitives) {
      const positions = p.getAttribute('POSITION').getArray();
      for (let i = 1; i < positions.length; i += 3) {
        top = Math.max(top, positions[i]);
        bottom = Math.min(bottom, positions[i]);
      }
    }
    assert(Math.abs(top - height) < 0.03, 'Authored height matches game dimensions');
    assert(Math.abs(bottom) < 0.12, 'Root pivot sits at the ground');
    const foliage = primitives.find((p) => p.getMaterial().getName() === 'Leaves');
    const colors = foliage.getAttribute('COLOR_0').getArray();
    assert(colors[1] > colors[0], 'Evergreen foliage retains its green vertex colors');
    console.log(
      `${species}${suffix}: ${triangles} triangles, distinct green foliage, grounded ${height}m mesh`,
    );
  }
}
