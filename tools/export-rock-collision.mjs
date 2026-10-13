import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let text =
  '// Collision triangles from the existing CC0 rock assets, normalized like loadScaledModel.\n// Regenerate with tools/export-rock-collision.mjs when these models change.\n';
for (const [kind, height] of [
  ['boulder', 1.1],
  ['mossyRock', 0.55],
]) {
  const doc = await io.read(new URL(`assets/rocks/${kind}.glb`, root).pathname);
  const triangles = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      const indices = p.getIndices();
      for (let i = 0; i < (indices?.getCount() ?? pos.getCount()); i++) {
        const v = pos.getElement(indices ? indices.getScalar(i) : i, []);
        triangles.push(
          m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
          m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
        );
      }
    }
  }
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 1; i < triangles.length; i += 3) {
    lo = Math.min(lo, triangles[i]);
    hi = Math.max(hi, triangles[i]);
  }
  const scale = height / (hi - lo);
  for (let i = 0; i < triangles.length; i++)
    triangles[i] = Number(((triangles[i] - (i % 3 === 1 ? lo : 0)) * scale).toFixed(7));
  text += `export const ${kind}Surface: readonly number[] = ${JSON.stringify(triangles)};\n`;
  console.log(kind, triangles.length / 9, 'triangles');
}
const { format } = await import('prettier');
const formatted = await format(text, { parser: 'typescript', singleQuote: true, printWidth: 100 });
const output = new URL('packages/shared/src/data/rock-surfaces.ts', root);
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== formatted)
    throw new Error('Rock collision data is stale; run node tools/export-rock-collision.mjs');
} else await writeFile(output, formatted);
