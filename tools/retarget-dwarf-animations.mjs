// Fits every move in the game's character animation library to the dwarf skeleton, and writes the
// dwarves' own library (assets/animations/dwarf.glb).
//
// The dwarves use the same skeleton as the Adventurers (Rig_Medium: the same 23 bones, names and
// joint directions), with the bones moved to short, round proportions (tools/art/dwarf_bodies.py).
// A move made for the taller body would stretch a dwarf back out to that height, because some of its
// tracks place bones, not just turn them. So, bone by bone:
//
// - Turns are kept as the move made them, plus the small difference between the two skeletons'
//   resting turns (both rest exactly where their own model rests).
// - Places (the hips bobbing, a shoulder shrugging) keep only how far the move shifts the bone from
//   its resting place, shrunk to the dwarf's leg length and added to the dwarf's own resting place.
//   The root's own travel is left at full size, so a roll covers the same ground as before.
//
// The dwarf library is where hand-made dwarf moves go too: `node tools/add-animation.mjs` replaces
// one clip in it at a time, without touching the others.
//
// Run with:
//   node tools/retarget-dwarf-animations.mjs assets/animations/character.glb assets/characters/mage.glb assets/animations/dwarf.glb
//   node tools/retarget-dwarf-animations.mjs assets/animations/character.glb assets/characters/knight.glb assets/animations/soft-dwarf.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const [, , libraryPath, dwarfPath, outputPath] = process.argv;
if (!libraryPath || !dwarfPath || !outputPath) {
  console.error(
    'usage: node tools/retarget-dwarf-animations.mjs <character.glb> <a dwarf body .glb> <dwarf.glb>',
  );
  process.exit(1);
}

/** Bones whose travel stays full size; every other shift shrinks to the dwarf's legs. */
const FULL_SIZE = new Set(['root']);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

const library = await io.read(libraryPath);
const dwarf = await io.read(dwarfPath);
const dwarfBones = new Map(
  dwarf
    .getRoot()
    .listNodes()
    .map((node) => [node.getName(), node]),
);
const libraryBones = new Map(
  library
    .getRoot()
    .listNodes()
    .map((node) => [node.getName(), node]),
);

const hipsHeight = (bones) => bones.get('hips')?.getTranslation()[1] ?? 0;
const shrink = hipsHeight(dwarfBones) / hipsHeight(libraryBones);
if (!(shrink > 0 && shrink < 2)) throw new Error(`odd hips heights (shrink ${shrink})`);

/** a * b, quaternions as [x, y, z, w]. */
function multiply(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}
const inverse = ([x, y, z, w]) => [-x, -y, -z, w];

// Each sampler is changed once, even if two channels were ever to share it.
const done = new Set();
let turned = 0;
let moved = 0;
for (const animation of library.getRoot().listAnimations()) {
  for (const channel of animation.listChannels()) {
    const bone = channel.getTargetNode();
    const sampler = channel.getSampler();
    const values = sampler?.getOutput();
    const own = bone && dwarfBones.get(bone.getName());
    if (!bone || !sampler || !values || !own || done.has(sampler)) continue;
    done.add(sampler);
    const element = [];
    if (channel.getTargetPath() === 'rotation') {
      // The move's turn, then the dwarf's own small difference at rest, in the bone's own frame.
      const correction = multiply(inverse(bone.getRotation()), own.getRotation());
      for (let i = 0; i < values.getCount(); i++) {
        values.setElement(i, multiply(values.getElement(i, element), correction));
      }
      turned++;
    } else if (channel.getTargetPath() === 'translation') {
      const from = bone.getTranslation();
      const to = own.getTranslation();
      const scale = FULL_SIZE.has(bone.getName()) ? 1 : shrink;
      for (let i = 0; i < values.getCount(); i++) {
        const v = values.getElement(i, element);
        values.setElement(
          i,
          v.map((value, axis) => to[axis] + (value - from[axis]) * scale),
        );
      }
      moved++;
    }
  }
}

// The soft dwarves' longer arms swung up nearly to shoulder height in the walk and run. On them,
// each arm's swing in these moves keeps only this share, centred on how the arm hangs at idle.
const CALMER_ARMS = { walk: 0.5, run: 0.55 };
const ARM_BONES = new Set(['upperarm.l', 'upperarm.r', 'lowerarm.l', 'lowerarm.r']);
const soft = dwarf
  .getRoot()
  .listNodes()
  .some((node) => node.getExtras()?.softDwarf === true);

/** The normalized blend of quaternions a and b, b's share t, taking the short way round. */
function blend(a, b, t) {
  const sign = a.reduce((sum, value, i) => sum + value * b[i], 0) < 0 ? -1 : 1;
  const mixed = a.map((value, i) => value * (1 - t) + sign * b[i] * t);
  const length = Math.hypot(...mixed);
  return mixed.map((value) => value / length);
}

const armTracks = (name) =>
  library
    .getRoot()
    .listAnimations()
    .find((animation) => animation.getName() === name)
    ?.listChannels()
    .filter((c) => c.getTargetPath() === 'rotation' && ARM_BONES.has(c.getTargetNode()?.getName()));
let calmed = 0;
if (soft) {
  const hanging = new Map();
  for (const channel of armTracks('idle') ?? []) {
    const values = channel.getSampler().getOutput();
    let mean = values.getElement(0, []);
    for (let i = 1; i < values.getCount(); i++) {
      mean = blend(mean, values.getElement(i, []), 1 / (i + 1));
    }
    hanging.set(channel.getTargetNode().getName(), mean);
  }
  for (const [name, keep] of Object.entries(CALMER_ARMS)) {
    for (const channel of armTracks(name) ?? []) {
      const centre = hanging.get(channel.getTargetNode().getName());
      const values = channel.getSampler().getOutput();
      if (!centre) continue;
      for (let i = 0; i < values.getCount(); i++) {
        values.setElement(i, blend(centre, values.getElement(i, []), keep));
      }
      calmed++;
    }
  }
}

// These moves also hold the upper arms about 40° out from the body, room the faceted dwarves' round
// bellies needed. The soft dwarves' chests are slimmer, so it looked like a watermelon under each
// arm. On them, the upper arms in these moves turn this far in towards the body (radians); the walk
// and run held them out wider still.
const TUCKED_ARMS = { idle: 0.28, idleLook: 0.28, walk: 0.45, run: 0.45 };
const parentOf = new Map();
for (const node of dwarf.getRoot().listNodes()) {
  for (const child of node.listChildren()) parentOf.set(child, node);
}
/** The bone's resting turn in the scene, through all of its parents. */
function restingWorldTurn(bone) {
  let turn = bone.getRotation();
  for (let p = parentOf.get(bone); p; p = parentOf.get(p)) turn = multiply(p.getRotation(), turn);
  return turn;
}
/** Turns vector v by quaternion q. */
function turnVector(q, v) {
  const [x, y, z] = multiply(multiply(q, [...v, 0]), inverse(q));
  return [x, y, z];
}
let tucked = 0;
if (soft) {
  for (const [name, tuckAngle] of Object.entries(TUCKED_ARMS)) {
    for (const channel of armTracks(name) ?? []) {
      const bone = dwarfBones.get(channel.getTargetNode().getName());
      if (!bone.getName().startsWith('upperarm')) continue;
      // About the body's forward axis, seen from the chest the upper arm hangs from.
      const [ax, ay, az] = turnVector(inverse(restingWorldTurn(parentOf.get(bone))), [0, 0, 1]);
      const half = ((bone.getName().endsWith('.l') ? -1 : 1) * tuckAngle) / 2;
      const tuck = [ax * Math.sin(half), ay * Math.sin(half), az * Math.sin(half), Math.cos(half)];
      const values = channel.getSampler().getOutput();
      for (let i = 0; i < values.getCount(); i++) {
        values.setElement(i, multiply(tuck, values.getElement(i, [])));
      }
      tucked++;
    }
  }
}

// The library's bones rest where the dwarf's do, so tools/add-animation.mjs can tell which tracks
// of a new dwarf move never leave the resting pose.
for (const [name, bone] of libraryBones) {
  const own = dwarfBones.get(name);
  if (!own) continue;
  bone.setTranslation(own.getTranslation());
  bone.setRotation(own.getRotation());
  bone.setScale(own.getScale());
}

library.createExtension(EXTMeshoptCompression).setRequired(true);
await io.write(outputPath, library);
console.log(
  `${library.getRoot().listAnimations().length} moves: ${turned} turning tracks and ${moved} placing tracks fitted (legs ${shrink.toFixed(3)} as long), ${calmed} arm tracks calmed and ${tucked} tucked in ->${outputPath}`,
);
