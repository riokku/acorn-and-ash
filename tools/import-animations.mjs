// Builds the game's one character animation library from KayKit's Character
// Animations pack (CC0, https://kaylousberg.itch.io/kaykit-character-animations).
//
// The pack ships as eight Rig_Medium_*.glb files, one per category, each with
// a grey stand-in mannequin and every bone keyed on every frame. This keeps
// only the clips listed in CLIPS (renamed to what the game calls them), drops
// the mannequin, drops any track that never leaves the rig's resting pose,
// thins out keyframes that a straight line through their neighbours already
// gives, and writes one Meshopt-compressed .glb that every character shares -
// all six characters use this same Rig_Medium skeleton, bone for bone.
//
// Run with:
//   node tools/import-animations.mjs <folder with the Rig_Medium_*.glb files> assets/animations/character.glb
import { Accessor, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Every clip the game plays, by the name it plays it under, and where it
 * comes from in the pack: `[file suffix, clip name]`.
 */
const CLIPS = {
  // Standing around and getting about.
  idle: ['General', 'Idle_A'],
  idleLook: ['General', 'Idle_B'],
  walk: ['MovementBasic', 'Walking_A'],
  run: ['MovementBasic', 'Running_A'],
  jumpStart: ['MovementBasic', 'Jump_Start'],
  jumpAir: ['MovementBasic', 'Jump_Idle'],
  jumpLand: ['MovementBasic', 'Jump_Land'],
  // A light three-hit combo, and a charged strike that winds up from the
  // strike's own crouch.
  attack1: ['CombatMelee', 'Melee_1H_Attack_Slice_Diagonal'],
  attack2: ['CombatMelee', 'Melee_1H_Attack_Slice_Horizontal'],
  attack3: ['CombatMelee', 'Melee_1H_Attack_Chop'],
  strike: ['CombatMelee', 'Melee_1H_Attack_Jump_Chop'],
  // Only its wound-back arm, held as the charge gathers (see character-animations.ts).
  throw: ['General', 'Throw'],
  // Dodging, getting hurt, and going down.
  dodgeForward: ['MovementAdvanced', 'Dodge_Forward'],
  dodgeBackward: ['MovementAdvanced', 'Dodge_Backward'],
  dodgeLeft: ['MovementAdvanced', 'Dodge_Left'],
  dodgeRight: ['MovementAdvanced', 'Dodge_Right'],
  hitA: ['General', 'Hit_A'],
  hitB: ['General', 'Hit_B'],
  knockedOut: ['General', 'Death_A'],
  // Tools.
  chop: ['Tools', 'Chopping'],
  dig: ['Tools', 'Digging'],
  cast: ['Tools', 'Fishing_Cast'],
  fishIdle: ['Tools', 'Fishing_Idle'],
  fishBite: ['Tools', 'Fishing_Bite'],
  reel: ['Tools', 'Fishing_Reeling'],
  fishCatch: ['Tools', 'Fishing_Catch'],
  // Everyday things.
  pickUp: ['General', 'PickUp'],
  interact: ['General', 'Interact'],
  // Eating has no clip: nothing in the pack gets a hand up to these
  // characters' big heads, so the game steers it there (see character-animator.ts).
  // At home.
  sitDown: ['Simulation', 'Sit_Chair_Down'],
  sitIdle: ['Simulation', 'Sit_Chair_Idle'],
  sitUp: ['Simulation', 'Sit_Chair_StandUp'],
  // Anywhere, on the bare ground (see decision 0102).
  sitFloorDown: ['Simulation', 'Sit_Floor_Down'],
  sitFloorIdle: ['Simulation', 'Sit_Floor_Idle'],
  sitFloorUp: ['Simulation', 'Sit_Floor_StandUp'],
  lieDown: ['Simulation', 'Lie_Down'],
  lieIdle: ['Simulation', 'Lie_Idle'],
  lieUp: ['Simulation', 'Lie_StandUp'],
};

/** How far a keyed value may stray from the resting pose and still count as never moving. */
const REST_TOLERANCE = 1e-4;
/** How far off a straight line a keyframe may be and still be dropped as one the line already gives. */
const KEYFRAME_TOLERANCE = 5e-4;

const [, , sourceFolder, outputPath, ...flags] = process.argv;
if (!sourceFolder || !outputPath) {
  console.error(
    'usage: node tools/import-animations.mjs <folder with Rig_Medium_*.glb> <output.glb> [--all]',
  );
  process.exit(1);
}
// For looking the whole pack over: keep every clip, under its own name.
const keepEverything = flags.includes('--all');

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

const files = readdirSync(sourceFolder).filter((name) => /^Rig_Medium_.*\.glb$/.test(name));
const sources = new Map();
for (const name of files) {
  const category = name.replace(/^Rig_Medium_/, '').replace(/\.glb$/, '');
  sources.set(category, await io.read(join(sourceFolder, name)));
}

// The output starts as the General file with its mannequin and every clip
// taken away: just the skeleton, which is the same in every file.
const output = await io.read(join(sourceFolder, 'Rig_Medium_General.glb'));
const root = output.getRoot();
for (const node of root.listNodes()) {
  node.setMesh(null);
  node.setSkin(null);
}
for (const mesh of root.listMeshes()) mesh.dispose();
for (const skin of root.listSkins()) skin.dispose();
for (const animation of root.listAnimations()) {
  for (const channel of animation.listChannels()) channel.dispose();
  for (const sampler of animation.listSamplers()) sampler.dispose();
  animation.dispose();
}
for (const accessor of root.listAccessors()) accessor.dispose();
const buffer = root.listBuffers()[0];
const bones = new Map(root.listNodes().map((node) => [node.getName(), node]));

const wanted = keepEverything
  ? [...sources].flatMap(([category, doc]) =>
      doc
        .getRoot()
        .listAnimations()
        .map((animation) => [animation.getName(), [category, animation.getName()]]),
    )
  : Object.entries(CLIPS);

let droppedTracks = 0;
for (const [gameName, [category, clipName]] of wanted) {
  const source = sources.get(category);
  const clip = source
    ?.getRoot()
    .listAnimations()
    .find((animation) => animation.getName() === clipName);
  if (clip === undefined) throw new Error(`No clip ${clipName} in Rig_Medium_${category}.glb`);

  const copy = output.createAnimation(gameName);
  for (const channel of clip.listChannels()) {
    const sourceBone = channel.getTargetNode();
    const bone = sourceBone && bones.get(sourceBone.getName());
    const path = channel.getTargetPath();
    const sampler = channel.getSampler();
    if (!bone || !path || !sampler) continue;
    const input = sampler.getInput();
    const values = sampler.getOutput();
    if (!input || !values) continue;

    if (neverLeavesRest(bone, path, values)) {
      droppedTracks++;
      continue;
    }

    const times = output
      .createAccessor()
      .setType('SCALAR')
      .setArray(new Float32Array(input.getArray()))
      .setBuffer(buffer);
    const keyed = output
      .createAccessor()
      .setType(values.getType())
      .setArray(new Float32Array(values.getArray()))
      .setBuffer(buffer);
    const copiedSampler = output
      .createAnimationSampler()
      .setInput(times)
      .setOutput(keyed)
      .setInterpolation(sampler.getInterpolation());
    copy
      .addSampler(copiedSampler)
      .addChannel(
        output
          .createAnimationChannel()
          .setTargetNode(bone)
          .setTargetPath(path)
          .setSampler(copiedSampler),
      );
  }
}

/** Whether every key of this track is the bone's own resting value, so leaving it out changes nothing. */
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
  const size = rest.length;
  const array = values.getArray();
  for (let i = 0; i < array.length; i++) {
    if (Math.abs(array[i] - rest[i % size]) > REST_TOLERANCE) return false;
  }
  return true;
}

await output.transform(
  resample({ tolerance: KEYFRAME_TOLERANCE }),
  // Tracks keyed at the very same moments share one list of them.
  dedup(),
  // Every bone stays, animated or not.
  prune({ keepLeaves: true }),
);

// Rotations as 16-bit whole numbers rather than full floats: a glTF
// animation may store them that way, and a two-hundredth of a degree is far
// finer than anybody can see on a character this size.
for (const animation of root.listAnimations()) {
  for (const channel of animation.listChannels()) {
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
}
output.createExtension(EXTMeshoptCompression).setRequired(true);

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
await io.write(outputPath, output);
const clips = root.listAnimations();
console.log(
  `${outputPath}: ${clips.length} clips, ${droppedTracks} still tracks left out, ` +
    `${clips.reduce((sum, clip) => sum + clip.listChannels().length, 0)} tracks kept`,
);
