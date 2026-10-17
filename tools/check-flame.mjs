import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { fileURLToPath } from 'node:url';
await MeshoptDecoder.ready;
const document = await new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  .read(fileURLToPath(new URL('../assets/buildables/flame.glb', import.meta.url)));
const meshes = document.getRoot().listMeshes();
assert.equal(meshes.length, 2, 'Only two flame draw parts, including wildfire copies');
let triangles = 0;
for (const mesh of meshes)
  for (const primitive of mesh.listPrimitives()) {
    triangles += primitive.getIndices().getCount() / 3;
    const positions = primitive.getAttribute('POSITION');
    assert.equal(primitive.listTargets().length, 3, 'Three curling deformations');
    for (const target of primitive.listTargets()) {
      const offsets = target.getAttribute('POSITION');
      let movement = 0;
      for (let i = 0; i < positions.getCount(); i++) {
        const p = positions.getElement(i, []),
          delta = offsets.getElement(i, []);
        assert(delta.every(Number.isFinite));
        movement = Math.max(movement, Math.hypot(...delta));
        if (p[1] < 0.021) assert(Math.hypot(...delta) < 1e-6, 'Fuel contact stays anchored');
      }
      assert(movement > 0.01, 'Tongues deform instead of simply scaling the whole fire');
    }
  }
assert(triangles <= 2000, 'Fire prop triangle budget');
const animations = document.getRoot().listAnimations();
assert(animations.length > 0);
for (const animation of animations)
  for (const sampler of animation.listSamplers()) {
    const times = sampler.getInput().getArray(),
      values = sampler.getOutput().getArray();
    assert(Math.abs(times[times.length - 1] - 6) < 0.01, 'Six-second loop');
    const width = values.length / times.length;
    for (let k = 0; k < width; k++)
      assert(Math.abs(values[k] - values[values.length - width + k]) < 1e-5, 'Seamless loop');
  }
console.log(`Flame: ${triangles} triangles, anchored curl morphs and seamless six-second loops`);
