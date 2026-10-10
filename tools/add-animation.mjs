// Adds (or replaces) one clip in the game's character animation library,
// from an animation exported out of Blender, without touching any other clip.
//
// The clip must be keyed on the same Rig_Medium skeleton, bone names unchanged
// (see tools/import-animations.mjs for where the rest of the library comes from).
// Like that tool, it leaves out tracks that never leave the resting pose, thins
// keyframes a straight line already gives, and stores rotations as 16-bit numbers.
//
// Run with:
//   node tools/add-animation.mjs <exported.gltf> <clip name in that file> <name the game plays it under> assets/animations/character.glb
import { Accessor, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

/** How far a keyed value may stray from the resting pose and still count as never moving. */
const REST_TOLERANCE = 1e-4;
/** How far off a straight line a keyframe may be and still be dropped. */
const KEYFRAME_TOLERANCE = 5e-4;

const [, , sourcePath, clipName, gameName, libraryPath] = process.argv;
if (!sourcePath || !clipName || !gameName || !libraryPath) {
  console.error(
    'usage: node tools/add-animation.mjs <exported.gltf> <clip name> <game name> <character.glb>',
  );
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

const source = await io.read(sourcePath);
const library = await io.read(libraryPath);
const root = library.getRoot();

const clip = source
  .getRoot()
  .listAnimations()
  .find((animation) => animation.getName() === clipName);
if (clip === undefined) {
  const have = source
    .getRoot()
    .listAnimations()
    .map((animation) => animation.getName());
  throw new Error(`No clip ${clipName} in ${sourcePath} (it has: ${have.join(', ')})`);
}

for (const old of root.listAnimations().filter((animation) => animation.getName() === gameName)) {
  for (const channel of old.listChannels()) channel.dispose();
  for (const sampler of old.listSamplers()) sampler.dispose();
  old.dispose();
}

const bones = new Map(root.listNodes().map((node) => [node.getName(), node]));
const buffer = root.listBuffers()[0];
const copy = library.createAnimation(gameName);
let kept = 0;
let dropped = 0;
for (const channel of clip.listChannels()) {
  const sourceBone = channel.getTargetNode();
  const bone = sourceBone && bones.get(sourceBone.getName());
  const path = channel.getTargetPath();
  const sampler = channel.getSampler();
  if (!sourceBone || !path || !sampler) continue;
  if (!bone) {
    // The skeleton must match bone for bone; a stray node (the armature itself) is skipped.
    if (path !== 'scale')
      console.warn(`skipping ${path} track on unknown node ${sourceBone.getName()}`);
    continue;
  }
  const input = sampler.getInput();
  const values = sampler.getOutput();
  if (!input || !values) continue;
  if (neverLeavesRest(bone, path, values)) {
    dropped++;
    continue;
  }
  const times = library
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Float32Array(input.getArray()))
    .setBuffer(buffer);
  const keyed = library
    .createAccessor()
    .setType(values.getType())
    .setArray(new Float32Array(values.getArray()))
    .setBuffer(buffer);
  const copiedSampler = library
    .createAnimationSampler()
    .setInput(times)
    .setOutput(keyed)
    .setInterpolation(sampler.getInterpolation());
  copy
    .addSampler(copiedSampler)
    .addChannel(
      library
        .createAnimationChannel()
        .setTargetNode(bone)
        .setTargetPath(path)
        .setSampler(copiedSampler),
    );
  kept++;
}

/** Whether every key of this track is the bone's own resting value. */
function neverLeavesRest(bone, path, values) {
  const rest =
    path === 'translation'
      ? bone.getTranslation()
      : path === 'rotation'
        ? bone.getRotation()
        : path === 'scale'
          ? bone.getScale()
          : null;
  if (rest === null) return false;
  const array = values.getArray();
  for (let i = 0; i < array.length; i++) {
    if (Math.abs(array[i] - rest[i % rest.length]) > REST_TOLERANCE) return false;
  }
  return true;
}

// Thin out only the new clip: resample works on a whole document, so run it on
// a document that holds nothing else.
const lone = await io.read(sourcePath);
for (const animation of lone.getRoot().listAnimations()) {
  if (animation.getName() !== clipName) animation.dispose();
}
await lone.transform(resample({ tolerance: KEYFRAME_TOLERANCE }));
// Take the thinned keys from the lone document into the new clip.
const thinned = lone.getRoot().listAnimations()[0];
for (const channel of copy.listChannels()) {
  const bone = channel.getTargetNode();
  const match = thinned
    .listChannels()
    .find(
      (other) =>
        other.getTargetNode()?.getName() === bone?.getName() &&
        other.getTargetPath() === channel.getTargetPath(),
    );
  const sampler = channel.getSampler();
  const from = match?.getSampler();
  if (!sampler || !from) continue;
  sampler.getInput()?.setArray(new Float32Array(from.getInput().getArray()));
  sampler.getOutput()?.setArray(new Float32Array(from.getOutput().getArray()));
}

// Rotations as 16-bit whole numbers, like the rest of the library.
for (const channel of copy.listChannels()) {
  if (channel.getTargetPath() !== 'rotation') continue;
  const values = channel.getSampler()?.getOutput();
  const array = values?.getArray();
  if (!values || !array || values.getComponentType() !== Accessor.ComponentType.FLOAT) continue;
  const packed = new Int16Array(array.length);
  for (let i = 0; i < array.length; i++) {
    packed[i] = Math.round(Math.max(-1, Math.min(1, array[i])) * 32767);
  }
  values.setArray(packed).setNormalized(true);
}

if (
  !root
    .listExtensionsUsed()
    .some((extension) => extension.extensionName === 'EXT_meshopt_compression')
) {
  library.createExtension(EXTMeshoptCompression).setRequired(true);
}
await io.write(libraryPath, library);
const duration = Math.max(
  ...copy.listSamplers().map((sampler) => sampler.getInput().getMax([])[0]),
);
console.log(
  `${libraryPath}: ${gameName} added, ${kept} tracks kept, ${dropped} still tracks left out, ` +
    `${duration.toFixed(3)} s, ${root.listAnimations().length} clips in all`,
);
