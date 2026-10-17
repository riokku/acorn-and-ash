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
// Every species has three shapes: the plain name, then "-b" and "-c" (see tools/art/trees.py).
const trees = [
  ['douglas-fir', 14],
  ['western-redcedar', 12],
  ['sitka-spruce', 16],
  ['bigleaf-maple', 12],
  ['red-alder', 13],
].flatMap(([name, h]) => ['', '-b', '-c'].map((variant) => [`${name}${variant}`, h]));
for (const [species, height] of trees) {
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
    // glTF duplicates corners at UV/normal seams. Weld positions for the
    // topology check: every bark edge must have two oppositely wound faces.
    // This catches the old slit on odd-sided trunks as well as missing caps.
    const bark = primitives.find((p) => p.getMaterial().getName() === 'Bark');
    const barkUV = bark.getAttribute('TEXCOORD_0');
    assert(barkUV, `${species}${suffix}: preserve UVs for the runtime bark texture`);
    const uv = barkUV.getArray();
    assert(Array.from(uv).every(Number.isFinite), 'Finite bark texture coordinates');
    assert(Math.max(...uv) - Math.min(...uv) > 0.5, 'Bark UVs cover the texture');
    const barkPositions = bark.getAttribute('POSITION');
    const ids = new Map();
    const welded = Array.from({ length: barkPositions.getCount() }, (_, vertex) => {
      const point = barkPositions.getElement(vertex, []);
      assert(point.every(Number.isFinite), `${species}: finite bark positions`);
      const key = point.map((value) => value.toFixed(5)).join(',');
      if (!ids.has(key)) ids.set(key, ids.size);
      return ids.get(key);
    });
    const indices = bark.getIndices()?.getArray() ?? welded.map((_, index) => index);
    const edges = new Map();
    for (let index = 0; index < indices.length; index += 3) {
      const face = [welded[indices[index]], welded[indices[index + 1]], welded[indices[index + 2]]];
      assert.equal(new Set(face).size, 3, `${species}: non-degenerate bark triangle`);
      for (let corner = 0; corner < 3; corner++) {
        const a = face[corner],
          b = face[(corner + 1) % 3];
        const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        const edge = edges.get(key) ?? { faces: 0, winding: 0 };
        edge.faces++;
        edge.winding += a < b ? 1 : -1;
        edges.set(key, edge);
      }
    }
    for (const edge of edges.values()) {
      assert.equal(edge.faces, 2, `${species}${suffix}: sealed bark, including seam and caps`);
      assert.equal(edge.winding, 0, `${species}${suffix}: consistent bark winding`);
    }
    const foliage = primitives.find((p) => p.getMaterial().getName() === 'Leaves');
    const colors = foliage.getAttribute('COLOR_0').getArray();
    assert(colors[1] > colors[0], 'Evergreen foliage retains its green vertex colors');
    console.log(
      `${species}${suffix}: ${triangles} triangles, distinct green foliage, grounded ${height}m mesh`,
    );
  }
}
