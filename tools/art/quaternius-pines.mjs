// Imports Quaternius's five CC0 pines (Stylized Nature MegaKit, as published on
// Poly Pizza) as the game's main conifer, each with a lighter distant version.
// Run with: node tools/art/quaternius-pines.mjs
//
// For each pine it:
// - renames the materials Bark and Leaves, the names the game looks for;
// - drops the bark textures, because the game paints its own bark on;
// - turns the needle cards into double-sided cut-outs instead of blended
//   see-through sheets, which don't sort or shadow well in a forest;
// - flattens the root tips that dip below the base up to ground level, so the
//   game, which stands a model on its lowest point, doesn't leave it hovering;
// - simplifies anything over the 4,000-triangle tree budget, and simplifies
//   again for the distant version.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, reorder, simplifyPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Poly Pizza model page id and file id for Pine_1 to Pine_5. */
const PINES = [
  ['rfnxJv0Rqa', '3fc02c15-0e5e-4757-a553-2d065e3d0f44'],
  ['Zt62gceKXZ', 'be462d46-2e48-401e-8da9-2f4d9bc9df0c'],
  ['699sFuLCN2', 'c55b8641-4679-4a85-8bd8-2a20e79abecd'],
  ['79gmlLnweB', '082c2026-56af-4e3f-bea7-9ae5de71101f'],
  ['igSu0cPoBz', '712aaefa-ae7f-4cb3-8834-a1b8860df3b2'],
];
const NEAR_BUDGET = 4000;
const DISTANT_BUDGET = 800;
/** Most of a distant pine's triangles go to its needles, which make its outline. */
const DISTANT_LEAVES = 540;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});
const out = fileURLToPath(new URL('../../assets/trees/', import.meta.url));
mkdirSync(out, { recursive: true });

for (const [index, [page, file]] of PINES.entries()) {
  const response = await fetch(`https://static.poly.pizza/${file}.glb`);
  if (!response.ok) throw new Error(`Pine_${index + 1} (${page}): HTTP ${response.status}`);
  const source = new Uint8Array(await response.arrayBuffer());
  const name = `pine-${index + 1}`;
  await write(await prepare(source, NEAR_BUDGET, NEAR_BUDGET), `${out}${name}.glb`);
  await write(await prepare(source, DISTANT_BUDGET, DISTANT_LEAVES), `${out}${name}-distant.glb`);
}

/** The cleaned-up pine, simplified to `budget` triangles with at most `leafBudget` in needles. */
async function prepare(source, budget, leafBudget) {
  const document = await io.readBinary(source);
  const root = document.getRoot();
  for (const material of root.listMaterials()) {
    if (/bark/i.test(material.getName())) {
      material.setName('Bark').setBaseColorTexture(null).setNormalTexture(null);
    } else {
      material.setName('Leaves').setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
    }
  }
  const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
  for (const primitive of primitives) {
    if (primitive.getMaterial().getName() === 'Bark') primitive.setAttribute('COLOR_0', null);
    const position = primitive.getAttribute('POSITION');
    const vertex = [0, 0, 0];
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, vertex);
      if (vertex[1] < 0) position.setElement(i, [vertex[0], 0, vertex[2]]);
    }
  }
  await document.transform(prune({ keepAttributes: true }), dedup(), weld());

  // Up close every needle card stays and the bark gives way instead; far off
  // the needles thin out too, but keep most of what is left for the outline.
  const leaves = primitives.find((p) => p.getMaterial().getName() === 'Leaves');
  const bark = primitives.find((p) => p.getMaterial().getName() === 'Bark');
  if (triangles(leaves) > leafBudget)
    simplifyPrimitive(leaves, {
      simplifier: MeshoptSimplifier,
      ratio: leafBudget / triangles(leaves),
      error: 0.05,
      lockBorder: false,
    });
  const room = budget - triangles(leaves);
  if (triangles(bark) > room)
    simplifyPrimitive(bark, {
      simplifier: MeshoptSimplifier,
      ratio: room / triangles(bark),
      error: 0.05,
      lockBorder: false,
    });

  await document.transform(prune({ keepAttributes: true }), reorder({ encoder: MeshoptEncoder }));
  document.createExtension(EXTMeshoptCompression).setRequired(true);
  return document;
}

function triangles(primitive) {
  return (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
}

async function write(document, path) {
  const total = document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, primitive) => sum + triangles(primitive), 0);
  await io.write(path, document);
  console.log(`${path}: ${total} triangles`);
}
