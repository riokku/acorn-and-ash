import { readFile } from 'node:fs/promises';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CanoePaddling } from '../src/scene/canoe-paddling';
import { createRowboat } from '../src/scene/rowboat';
import { ActionKind } from '@acorn/shared';

vi.mock('../src/scene/character-animations', () => ({
  characterClips: () => ({
    whole: new Map([['sitIdle', sit]]),
    upper: new Map(),
    lower: new Map(),
  }),
}));

/** Test the shipped rigs and clips, without asking Node to decode their image textures. */
async function rigFile(path: string) {
  const bytes = await readFile(new URL(`../../../${path}`, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const data = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  data.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
  delete data.images;
  delete data.textures;
  delete data.materials;
  for (const mesh of data.meshes ?? [])
    for (const primitive of mesh.primitives) delete primitive.material;
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(data), '');
}

let sit: THREE.AnimationClip;
beforeAll(async () => {
  // GLTFLoader's embedded-buffer progress event has no DOM equivalent in Node.
  vi.stubGlobal('ProgressEvent', class {});
  sit = (await rigFile('assets/animations/character.glb')).animations.find(
    (clip) => clip.name === 'sitIdle',
  )!;
});
afterAll(() => vi.unstubAllGlobals());

const at = (object: THREE.Object3D, point = new THREE.Vector3()) => {
  object.updateWorldMatrix(true, false);
  return object.localToWorld(point);
};

async function setup(body = 'knight') {
  const root = (await rigFile(`assets/characters/${body}.glb`)).scene;
  const parent = new THREE.Group();
  parent.position.set(72, 36.15, -94);
  parent.rotation.y = 1.2;
  root.rotation.y = Math.PI;
  root.scale.setScalar(0.6);
  parent.add(root);
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(sit).play();
  mixer.update(0.5);
  const paddling = CanoePaddling.forRig(root)!;
  return { root, mixer, paddling };
}

describe('a paddle held by both hands', () => {
  it.each(['knight', 'barbarian', 'mage', 'ranger', 'rogue', 'rogueHooded'])(
    'keeps both %s grips connected through the whole stroke and while coasting',
    async (body) => {
      const { root, mixer, paddling } = await setup(body);
      const right = root.getObjectByName('handslotr')!,
        left = root.getObjectByName('handslotl')!;
      for (const speed of [3, 4.2, 0])
        for (let sample = 0; sample <= 24; sample++) {
          paddling.restore();
          mixer.setTime(sample / 20);
          paddling.update(1 / 60, speed, 1, sample / 24);
          const lower = at(paddling.paddle.group);
          const upper = at(paddling.paddle.group, new THREE.Vector3(0, 0.43, 0));
          expect(lower.distanceTo(at(right))).toBeLessThan(1e-5);
          expect(upper.distanceTo(at(left))).toBeLessThan(0.005);
          expect(Math.abs(upper.distanceTo(lower) - 0.43)).toBeLessThan(0.001);
        }
      paddling.dispose();
    },
  );

  it('raises the blade out of the water for recovery and holds it clear while coasting', async () => {
    const { mixer, paddling } = await setup();
    const bladeAt = (phase: number, speed: number) => {
      paddling.restore();
      mixer.setTime(0.5);
      paddling.update(1 / 60, speed, 1, phase);
      return at(paddling.paddle.group, new THREE.Vector3(0, -1.15, 0)).y;
    };
    const power = bladeAt(0.25, 3),
      recovery = bladeAt(0.75, 3),
      coast = bladeAt(0.5, 0);
    expect(power).toBeLessThan(36);
    expect(recovery).toBeGreaterThan(36);
    expect(coast).toBeGreaterThan(36);
    paddling.dispose();
  });

  it('restores the animated arms on landing and removes the hand-held paddle on disposal', async () => {
    const { root, mixer, paddling } = await setup();
    const bone = root.getObjectByName('upperarmr')!;
    mixer.setTime(0.5);
    const before = bone.quaternion.clone();
    paddling.update(1 / 60, 3, 1, 0.2);
    expect(bone.quaternion.angleTo(before)).toBeGreaterThan(0.1);
    paddling.restore();
    expect(bone.quaternion.toArray()).toEqual(before.toArray());
    expect(paddling.paddle.group.visible).toBe(false);
    paddling.dispose();
    expect(paddling.paddle.group.parent).toBeNull();
  });

  it('eases paddling into a raised resting grip without a visible hand jump', async () => {
    const { paddling, mixer } = await setup();
    let previous: THREE.Vector3 | null = null;
    for (let frame = 0; frame < 180; frame++) {
      paddling.restore();
      mixer.setTime(0.5);
      paddling.update(1 / 60, frame < 60 ? 3 : 0, 1);
      const point = at(paddling.paddle.group);
      if (previous !== null) expect(point.distanceTo(previous)).toBeLessThan(0.03);
      previous = point;
    }
    expect(at(paddling.paddle.group, new THREE.Vector3(0, -1.15, 0)).y).toBeGreaterThan(36);
    paddling.dispose();
  });

  it('samples the same stroke at 30 and 120 FPS, including starting and stopping', async () => {
    const finish = async (fps: number) => {
      const { paddling, mixer } = await setup();
      for (let frame = 0; frame < fps * 2; frame++) {
        paddling.restore();
        mixer.setTime(0.5);
        paddling.update(1 / fps, frame < fps ? 3 : 0, 1);
      }
      const tip = at(paddling.paddle.group, new THREE.Vector3(0, -1.15, 0));
      paddling.dispose();
      return tip;
    };
    expect((await finish(30)).distanceTo(await finish(120))).toBeLessThan(0.001);
  });

  it('turns the blade with the rider rather than keeping its roll fixed in the world', async () => {
    const { root, paddling, mixer } = await setup();
    paddling.update(1 / 60, 3, 1, 0.25);
    const before = paddling.paddle.group.getWorldQuaternion(new THREE.Quaternion()).normalize();
    paddling.restore();
    root.parent!.rotation.y += Math.PI / 2;
    mixer.setTime(0.5);
    paddling.update(1 / 60, 3, 1, 0.25);
    const after = paddling.paddle.group.getWorldQuaternion(new THREE.Quaternion()).normalize();
    const turned = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
      .multiply(before);
    expect(after.angleTo(turned)).toBeLessThan(0.001);
    paddling.dispose();
  });

  it('connects the paddle in the actual character update path and hides it on landing', async () => {
    const { createCharacterFromModel } = await import('../src/scene/character');
    const root = (await rigFile('assets/characters/knight.glb')).scene;
    const character = createCharacterFromModel({ root, clips: [] }, { tint: 0xffffff });
    character.group.position.set(72, 36, -94);
    character.group.rotation.y = 1.2;
    character.setRestSpot({ x: 72, y: 36.15, z: -94, yaw: 1.2 });
    for (let frame = 1; frame <= 45; frame++)
      character.update(1 / 60, {
        move: {
          kind: ActionKind.Row,
          step: 0,
          age: frame / 3,
          atTree: false,
          flinchVariant: 0,
          roll: 'forward',
        },
        locomotion: { speed: 0, airborne: false },
        rowingSpeed: 3,
      });
    const paddle = character.group.getObjectByName('canoe-paddle')!;
    expect(paddle.visible).toBe(true);
    expect(at(paddle).distanceTo(at(character.group.getObjectByName('handslotr')!))).toBeLessThan(
      1e-5,
    );
    expect(
      at(paddle, new THREE.Vector3(0, 0.43, 0)).distanceTo(
        at(character.group.getObjectByName('handslotl')!),
      ),
    ).toBeLessThan(0.005);
    character.setRestSpot(null);
    character.update(1 / 60, {
      move: {
        kind: ActionKind.Idle,
        step: 0,
        age: 0,
        atTree: false,
        flinchVariant: 0,
        roll: 'forward',
      },
      locomotion: { speed: 0, airborne: false },
    });
    expect(paddle.visible).toBe(false);
    character.dispose();
    expect(paddle.parent).toBeNull();
  });

  it('stows one paddle on an empty canoe and hides it while the rider holds theirs', () => {
    const boat = createRowboat();
    const paddle = boat.group.getObjectByName('canoe-paddle')!;
    expect(paddle.visible).toBe(true);
    boat.setOccupied(true);
    expect(paddle.visible).toBe(false);
    boat.setOccupied(false);
    expect(paddle.visible).toBe(true);
    boat.dispose();
  });
});
