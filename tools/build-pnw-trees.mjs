// Original stylized tree meshes: reproducible authored silhouettes, not imported art.
// Run: node tools/build-pnw-trees.mjs. Geometry is released with the repository.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});
const species = [
  {
    name: 'douglas-fir',
    height: 14,
    width: 2.6,
    radius: 0.3,
    levels: 12,
    branches: 6,
    color: [0.12, 0.27, 0.17],
    bark: [0.35, 0.24, 0.16],
  },
  {
    name: 'western-redcedar',
    height: 12,
    width: 2.8,
    radius: 0.34,
    levels: 11,
    branches: 5,
    color: [0.16, 0.3, 0.2],
    bark: [0.43, 0.25, 0.17],
  },
  {
    name: 'sitka-spruce',
    height: 16,
    width: 2.4,
    radius: 0.4,
    levels: 14,
    branches: 6,
    color: [0.12, 0.24, 0.23],
    bark: [0.32, 0.25, 0.21],
  },
];
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, s) => a.map((v) => v * s);
const sub = (a, b) => add(a, mul(b, -1));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normal = (a) => mul(a, 1 / Math.max(0.00001, Math.hypot(...a)));
function geometry() {
  const positions = [],
    normals = [],
    colors = [],
    uvs = [];
  return {
    triangle(a, b, c, color) {
      const n = normal(cross(sub(b, a), sub(c, a)));
      for (const p of [a, b, c]) {
        positions.push(...p);
        normals.push(...n);
        colors.push(...color);
        uvs.push(Math.atan2(p[2], p[0]) / (Math.PI * 2), p[1] * 0.35);
      }
    },
    positions,
    normals,
    colors,
    uvs,
  };
}
function tube(mesh, a, b, r0, r1, color, sides = 6) {
  const direction = normal(sub(b, a));
  const tangent = normal(cross(direction, Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const bitangent = cross(direction, tangent);
  const ring = (origin, radius, i) =>
    add(
      origin,
      add(
        mul(tangent, Math.cos((i / sides) * Math.PI * 2) * radius),
        mul(bitangent, Math.sin((i / sides) * Math.PI * 2) * radius),
      ),
    );
  for (let i = 0; i < sides; i++) {
    const a0 = ring(a, r0, i),
      a1 = ring(a, r0, i + 1),
      b0 = ring(b, r1, i),
      b1 = ring(b, r1, i + 1);
    mesh.triangle(a0, a1, b0, color);
    mesh.triangle(a1, b1, b0, color);
  }
}
/** An angular needle spray with an asymmetric ridge, elongated along its branch. */
function spray(mesh, centre, angle, length, width, depth, color, droop, lobes = 8) {
  const forward = [Math.cos(angle), 0, Math.sin(angle)],
    side = [-Math.sin(angle), 0, Math.cos(angle)];
  const top = add(centre, [0, depth, 0]),
    bottom = add(centre, [0, -depth * 0.65, 0]);
  const edge = (i) => {
    const t = (i / lobes) * Math.PI * 2;
    const ragged = 1 + 0.13 * Math.sin(i * 2.7 + angle);
    return add(
      centre,
      add(
        mul(forward, Math.cos(t) * length * ragged),
        add(mul(side, Math.sin(t) * width * ragged), [0, -Math.max(0, Math.cos(t)) * droop, 0]),
      ),
    );
  };
  for (let i = 0; i < lobes; i++) {
    const a = edge(i),
      b = edge(i + 1);
    mesh.triangle(top, b, a, mul(color, 1.02 + (i % 3) * 0.04));
    mesh.triangle(bottom, a, b, mul(color, 0.75));
  }
}
for (const original of species)
  for (const distant of [false, true]) {
    const tree = {
      ...original,
      levels: distant ? 5 : original.levels,
      branches: distant ? 4 : original.branches,
    };
    const fileName = tree.name + (distant ? '-distant' : '');
    const bark = geometry(),
      leaves = geometry();
    const cedar = tree.name === 'western-redcedar',
      spruce = tree.name === 'sitka-spruce';
    const bend = (y) => [
      Math.sin((y / tree.height) * 2.3) * 0.12,
      y,
      Math.sin((y / tree.height) * 3.1) * 0.07,
    ];
    const sections = [
      0,
      0.45,
      tree.height * 0.2,
      tree.height * 0.45,
      tree.height * 0.7,
      tree.height * 0.9,
      tree.height,
    ];
    for (let i = 0; i < sections.length - 1; i++) {
      const y = sections[i],
        end = sections[i + 1];
      const radius = (h) => tree.radius * (1 - h / tree.height) * (h === 0 && cedar ? 1.2 : 1);
      tube(bark, bend(y), bend(end), radius(y), Math.max(0.016, radius(end)), tree.bark, 9);
    }
    // Buttress roots stay inside the gameplay trunk footprint.
    for (let root = 0; root < 5; root++) {
      const a = (root * Math.PI * 2) / 5;
      tube(
        bark,
        [Math.cos(a) * tree.radius * 1.2, 0.04, Math.sin(a) * tree.radius * 1.2],
        [0, 0.7, 0],
        0.065,
        0.09,
        mul(tree.bark, 0.9),
        4,
      );
    }
    for (let level = 0; level < tree.levels; level++) {
      const t = level / (tree.levels - 1);
      const y =
        tree.height * (spruce ? 0.19 : cedar ? 0.23 : 0.28) +
        t * tree.height * (spruce ? 0.74 : cedar ? 0.7 : 0.65);
      const reach = tree.width * Math.pow(1 - t * 0.91, cedar ? 0.8 : 1.1);
      for (let branch = 0; branch < tree.branches; branch++) {
        // Broken whorls and changing phase give gaps rather than a stack of cones.
        if ((branch + level * 3) % 13 === 0) continue;
        const angle = (branch * Math.PI * 2) / tree.branches + level * 1.19;
        const irregular = 0.88 + 0.14 * Math.sin(level * 5.1 + branch * 2.7);
        const extent = reach * irregular;
        const dy = cedar ? -extent * 0.28 : spruce ? -extent * 0.09 : extent * 0.07;
        const a = bend(y),
          tip = [Math.cos(angle) * extent, y + dy, Math.sin(angle) * extent];
        tube(bark, a, tip, 0.055 * (1 - t) + 0.015, 0.012, tree.bark, 5);
        const count = distant ? 1 : cedar ? 3 : 2;
        for (let tuft = 0; tuft < count; tuft++) {
          const fraction = (tuft + 1) / (count + 0.25);
          const center = add(a, mul(sub(tip, a), fraction));
          const hue = mul(tree.color, 0.91 + t * 0.22 + (branch % 3) * 0.045);
          spray(
            leaves,
            center,
            angle + (cedar ? (tuft % 2 ? 0.3 : -0.3) : 0),
            extent * (cedar ? 0.29 : 0.4),
            extent * (cedar ? 0.32 : 0.28),
            cedar ? 0.085 + extent * 0.06 : 0.3 + extent * 0.19,
            hue,
            cedar ? extent * 0.18 : extent * 0.035,
            cedar ? 6 : 8,
          );
        }
      }
    }
    spray(
      leaves,
      [0.08, tree.height * 0.97, 0],
      0.4,
      0.16,
      0.18,
      tree.height * 0.03,
      tree.color,
      0,
    );
    const document = new Document();
    const buffer = document.createBuffer();
    const scene = document.createScene(tree.name);
    document.getRoot().setDefaultScene(scene);
    for (const [name, mesh] of [
      ['Bark', bark],
      ['Leaves', leaves],
    ]) {
      const material = document
        .createMaterial(name)
        .setBaseColorFactor([1, 1, 1, 1])
        .setRoughnessFactor(name === 'Leaves' ? 0.9 : 1);
      const accessor = (type, data) =>
        document.createAccessor().setType(type).setArray(new Float32Array(data)).setBuffer(buffer);
      const primitive = document
        .createPrimitive()
        .setAttribute('POSITION', accessor('VEC3', mesh.positions))
        .setAttribute('NORMAL', accessor('VEC3', mesh.normals))
        .setAttribute('COLOR_0', accessor('VEC3', mesh.colors))
        .setAttribute('TEXCOORD_0', accessor('VEC2', mesh.uvs))
        .setMaterial(material);
      scene.addChild(
        document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive)),
      );
    }
    document.getRoot().getAsset().copyright =
      'Original Acorn & Ash procedural geometry; CC0-1.0; original repository-authored geometry, no third-party source assets.';
    await document.transform(weld(), dedup(), prune(), reorder({ encoder: MeshoptEncoder }));
    document
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const triangles = (bark.positions.length + leaves.positions.length) / 9;
    if (triangles > 4000) throw new Error(`${tree.name}: triangle budget exceeded`);
    await io.write(`assets/trees/${fileName}.glb`, document);
    console.log(`${fileName}: ${triangles} triangles`);
  }
