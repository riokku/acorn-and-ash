import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const doc = await new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  .read(fileURLToPath(new URL('../assets/housing/cabin-details.glb', import.meta.url)));
const required = new Set([
  'CabinRoofFront',
  'CabinRoofBack',
  'CabinJoinery',
  'CabinHardware',
  'PorchRoof',
  'PorchJoinery',
  'TentCanvas',
  'TeepeeCanvas',
]);
let total = 0;
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  required.delete(node.getName());
  let triangles = 0;
  for (const part of mesh.listPrimitives()) {
    const positions = part.getAttribute('POSITION');
    assert(Array.from(positions.getArray()).every(Number.isFinite));
    assert(part.getAttribute('NORMAL'), 'Authored shading normals survive export');
    triangles += part.getIndices().getCount() / 3;
  }
  assert(triangles <= 2000, `${node.getName()}: module budget`);
  total += triangles;
}
assert.equal(required.size, 0, `Missing modules: ${[...required]}`);
assert(total < 7000, 'Bounded entire housing kit');
console.log(`Housing detail kit: ${total} triangles; all eight modules present`);
