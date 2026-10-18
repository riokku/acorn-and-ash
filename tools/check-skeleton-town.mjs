import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const document = await new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  .read(fileURLToPath(new URL('../assets/settlements/bonehollow.glb', import.meta.url)));
let total = 0;
for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const triangles = mesh.listPrimitives().reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  // Road is one batch of small paving stones, not a single gameplay prop.
  assert(triangles <= (node.getName() === 'Road' ? 12000 : 2000), `${node.getName()} art budget`);
  total += triangles;
  for (const p of mesh.listPrimitives())
    assert(Array.from(p.getAttribute('POSITION').getArray()).every(Number.isFinite));
}
const names = document
  .getRoot()
  .listNodes()
  .map((n) => n.getName());
for (const required of [
  'Gate',
  'BellHall',
  'Graves',
  'Market',
  'TownWatch',
  'TownScavenger',
  'LastBell',
  'WestWatchtower',
  'EastWatchtower',
  'SoulLanterns',
])
  assert(names.includes(required), required);
const solids = JSON.parse(
  await readFile(
    new URL('../packages/shared/src/data/skeleton-town-solids.json', import.meta.url),
    'utf8',
  ),
);
assert(solids.length > 100 && solids.length < 400, 'Bounded collision footprint');
for (const solid of solids) {
  assert(Object.values(solid).every(Number.isFinite));
  assert(solid.halfX > 0 && solid.halfY > 0 && solid.halfZ > 0);
  assert(Math.abs(solid.x) < 32 && Math.abs(solid.z) < 32, 'Buildings fit the level shelf');
}
console.log(
  `Bonehollow: ${total} triangles across modules; ${solids.length} shared collision boxes`,
);

const helm = await new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  .read(fileURLToPath(new URL('../assets/gear/last-watch-helm.glb', import.meta.url)));
let helmTriangles = 0;
for (const mesh of helm.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    helmTriangles += primitive.getIndices().getCount() / 3;
    for (const semantic of ['POSITION', 'NORMAL'])
      assert(Array.from(primitive.getAttribute(semantic).getArray()).every(Number.isFinite));
  }
}
assert(helmTriangles > 0 && helmTriangles <= 2000, 'Last Watch helm prop budget');
console.log(`Last Watch helm: ${helmTriangles} triangles`);
