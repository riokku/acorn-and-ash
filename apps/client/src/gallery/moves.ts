import * as THREE from 'three/webgpu';

import {
  ActionKind,
  CHARGE_TICKS,
  DODGE,
  FLINCH,
  Gesture,
  HOME_BED,
  HOME_CHAIR,
  KNOCKED_OUT_TICKS,
  LIGHT_COMBO,
  RISE,
  RiseFrom,
  SETTLE,
  STRIKE,
  TICK_SECONDS,
  type ItemId,
  type RestingPlace,
} from '@acorn/shared';

import { preloadCharacterAnimations } from '../scene/character-animations';
import { isSweeping } from '../scene/character-moves';
import { ImpactBursts, type BurstKind } from '../scene/impact-bursts';
import { WeaponTrail } from '../scene/weapon-trail';
import { preloadCharacterModels } from '../scene/character-model';
import { preloadItemModels } from '../scene/item-models';
import { createNameplate } from '../scene/nameplate';
import {
  createCharacter,
  type Character,
  type FishingPose,
  type RestSpot,
  type RollDirection,
} from '../scene/character';
import type { RendererSetup } from '../scene/renderer';

/**
 * Every character move, played by the game's own animator on a real
 * character, for looking the animations over (see decision 0056):
 * `?gallery=moves` shows them all, looping; `&demo=` picks one to look at up
 * close; `&strip=N` lays that one out as N frozen moments across its length;
 * `&at=` freezes them all at one moment, in ticks.
 */

/** One move to show, and how it unfolds tick by tick. */
interface Demo {
  readonly name: string;
  readonly item: ItemId | null;
  /** How long it runs before it loops, in ticks. */
  readonly length: number;
  /** The move at this many ticks in. */
  move(age: number): { kind: ActionKind; step: number; age: number };
  readonly atTree?: boolean;
  readonly roll?: RollDirection;
  /** Where a sitting or lying body settles, relative to where it stands. */
  readonly rest?: RestSpot;
  /** Played once each loop, as it starts. */
  readonly gesture?: Gesture;
  readonly fishing?: FishingPose;
  /** What a blow throws off as it lands, in front of the character. */
  readonly burst?: BurstKind;
}

const IDLE = { kind: ActionKind.Idle, step: 0, age: 0 };
const [SWING_1, SWING_2, SWING_3] = LIGHT_COMBO;

const DEMOS: readonly Demo[] = [
  {
    name: 'combo',
    item: 'axe',
    burst: 'fur',
    length: SWING_1.chain + SWING_2.chain + SWING_3.end + 8,
    move: (age) => {
      if (age < SWING_1.chain) return { kind: ActionKind.Swing, step: 1, age };
      const second = age - SWING_1.chain;
      if (second < SWING_2.chain) return { kind: ActionKind.Swing, step: 2, age: second };
      const third = second - SWING_2.chain;
      if (third < SWING_3.end) return { kind: ActionKind.Swing, step: 3, age: third };
      return IDLE;
    },
  },
  {
    name: 'chop',
    item: 'axe',
    atTree: true,
    burst: 'wood',
    length: SWING_1.end + 6,
    move: (age) => (age < SWING_1.end ? { kind: ActionKind.Swing, step: 1, age } : IDLE),
  },
  {
    name: 'strike',
    item: 'axe',
    burst: 'dust',
    length: CHARGE_TICKS + STRIKE.end + 8,
    move: (age) =>
      age < CHARGE_TICKS
        ? { kind: ActionKind.Charge, step: 0, age }
        : age < CHARGE_TICKS + STRIKE.end
          ? { kind: ActionKind.Strike, step: 0, age: age - CHARGE_TICKS }
          : IDLE,
  },
  ...(['forward', 'backward', 'left', 'right'] as const).map((roll): Demo => ({
    name: `roll-${roll}`,
    item: 'torch',
    roll,
    length: DODGE.end + 8,
    move: (age) => (age < DODGE.end ? { kind: ActionKind.Dodge, step: 0, age } : IDLE),
  })),
  {
    name: 'flinch',
    item: 'rod',
    length: FLINCH.end + 8,
    move: (age) => (age < FLINCH.end ? { kind: ActionKind.Flinch, step: 0, age } : IDLE),
  },
  {
    name: 'knockout',
    item: 'axe',
    length: KNOCKED_OUT_TICKS + RISE.ground + 10,
    move: (age) =>
      age < KNOCKED_OUT_TICKS
        ? { kind: ActionKind.KnockedOut, step: 0, age }
        : age < KNOCKED_OUT_TICKS + RISE.ground
          ? { kind: ActionKind.Rise, step: RiseFrom.Ground, age: age - KNOCKED_OUT_TICKS }
          : IDLE,
  },
  {
    name: 'sit',
    item: 'axe',
    rest: { x: -0.24, y: 0.15, z: -0.7, yaw: Math.PI / 2 },
    length: SETTLE.chair + 40 + RISE.chair + 10,
    move: (age) =>
      age < SETTLE.chair + 40
        ? { kind: ActionKind.Sit, step: 0, age }
        : age < SETTLE.chair + 40 + RISE.chair
          ? { kind: ActionKind.Rise, step: RiseFrom.Chair, age: age - SETTLE.chair - 40 }
          : IDLE,
  },
  {
    name: 'lie',
    item: null,
    rest: { x: -1.1, y: 0.5, z: -0.6, yaw: Math.PI },
    length: SETTLE.bed + 40 + RISE.bed + 10,
    move: (age) =>
      age < SETTLE.bed + 40
        ? { kind: ActionKind.Lie, step: 0, age }
        : age < SETTLE.bed + 40 + RISE.bed
          ? { kind: ActionKind.Rise, step: RiseFrom.Bed, age: age - SETTLE.bed - 40 }
          : IDLE,
  },
  { name: 'pickup', item: 'axe', length: 30, gesture: Gesture.PickUp, move: () => IDLE },
  { name: 'dig', item: 'axe', length: 34, gesture: Gesture.Dig, move: () => IDLE },
  { name: 'eat', item: 'perch', length: 36, gesture: Gesture.Eat, move: () => IDLE },
  { name: 'reach', item: 'torch', length: 26, gesture: Gesture.Reach, move: () => IDLE },
  { name: 'fishing', item: 'rod', length: 60, fishing: 'casting', move: () => IDLE },
];

interface Showing {
  readonly demo: Demo;
  readonly character: Character;
  readonly trail: WeaponTrail;
  /** Where in the demo it is, in ticks; fixed for a frozen one. */
  age: number;
  /** Where it was last frame, to catch a blow landing in between. */
  drawnAge: number;
  readonly frozen: boolean;
}

/** Chips, fur and dust for every demo's blows. */
let bursts: ImpactBursts | null = null;

export async function showMoves(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  params: URLSearchParams,
): Promise<void> {
  await Promise.all([preloadCharacterModels(), preloadItemModels(), preloadCharacterAnimations()]);
  const picked = params.get('demo');
  const demos = picked === null ? DEMOS : DEMOS.filter((demo) => demo.name === picked);
  const strip = Number(params.get('strip') ?? 0);
  const freezeAt = params.has('at') ? Number(params.get('at')) : null;
  const spacing = Number(params.get('spacing') ?? 1.7);
  const turn = Number(params.get('turn') ?? 0.5);

  const showings: Showing[] = [];
  bursts = new ImpactBursts();
  scene.add(bursts.group);
  const place = (demo: Demo, x: number, z: number, age: number, frozen: boolean): void => {
    const character = createCharacter('knight', 0xf2efe6);
    character.group.position.set(x, 0, z);
    character.group.rotation.y = turn;
    character.setEquippedItem(demo.item);
    scene.add(character.group);
    const label = createNameplate(frozen ? `${demo.name} @${age}` : demo.name);
    label.sprite.position.set(x, 1.45, z);
    label.sprite.scale.multiplyScalar(0.6);
    scene.add(label.sprite);
    const trail = new WeaponTrail();
    scene.add(trail.mesh);
    showings.push({ demo, character, trail, age, drawnAge: 0, frozen });
  };

  const onlyDemo = demos[0];
  if (strip > 1 && onlyDemo !== undefined) {
    for (let i = 0; i < strip; i++) {
      const age = Math.round((onlyDemo.length - 1) * (i / (strip - 1)));
      place(onlyDemo, (i - (strip - 1) / 2) * spacing, 0, age, true);
    }
  } else {
    const columns = Math.ceil(Math.sqrt(demos.length));
    demos.forEach((demo, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = (column - (columns - 1) / 2) * spacing;
      place(demo, x, row * spacing, freezeAt ?? 0, freezeAt !== null);
    });
  }

  const columns = strip > 1 ? strip : Math.ceil(Math.sqrt(demos.length));
  const rows = strip > 1 ? 1 : Math.ceil(demos.length / columns);
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 300);
  const target = new THREE.Vector3(0, 0.55, ((rows - 1) * spacing) / 2);
  const distance = Number(params.get('distance') ?? Math.max(columns, rows) * spacing * 1.1 + 2);
  const height = Number(params.get('height') ?? distance * 0.35);
  const angle = Number(params.get('angle') ?? 0);
  camera.position.set(
    target.x + Math.sin(angle) * distance,
    target.y + height,
    target.z + Math.cos(angle) * distance,
  );
  camera.lookAt(target);
  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // A frozen moment still needs the moves run up to it, so gestures and
  // fades have got where they would be: played through quickly, once.
  for (const showing of showings) {
    if (!showing.frozen) continue;
    start(showing);
    // In quarter ticks, so a streak behind a swing has somewhere to come from.
    for (let quarter = 0; quarter <= showing.age * 4; quarter++) {
      drawAt(showing, quarter / 4, TICK_SECONDS / 4);
      bursts.update(TICK_SECONDS / 4);
    }
  }

  let last = performance.now();
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const showing of showings) {
      if (showing.frozen) continue;
      const before = showing.age;
      showing.age = (showing.age + delta / TICK_SECONDS) % showing.demo.length;
      if (showing.age < before || frames === 0) start(showing);
      drawAt(showing, showing.age, delta);
    }
    // Frozen moments hold their chips mid-air too.
    if (showings.some((showing) => !showing.frozen)) bursts?.update(delta);
    renderer.render(scene, camera);
    frames += 1;
    if (frames === 8) document.body.dataset.galleryReady = 'true';
  });
}

/** A demo loops round to its start: anything played once a loop plays again. */
function start(showing: Showing): void {
  const { demo, character } = showing;
  if (demo.gesture !== undefined) character.playGesture(demo.gesture, demo.item);
  if (demo.fishing !== undefined) {
    character.setFishing(null);
    character.setFishing(demo.fishing);
  }
}

function drawAt(showing: Showing, age: number, deltaSeconds: number): void {
  const { demo, character } = showing;
  const move = demo.move(age);
  const before = demo.move(showing.drawnAge);
  showing.drawnAge = age;
  const rest = demo.rest;
  character.setRestSpot(
    rest === undefined
      ? null
      : {
          x: character.group.position.x + rest.x,
          y: rest.y,
          z: character.group.position.z + rest.z,
          yaw: rest.yaw,
        },
  );
  const pose = character.update(deltaSeconds, {
    move: { ...move, atTree: demo.atTree ?? false, flinchVariant: 0, roll: demo.roll ?? 'forward' },
    locomotion: { speed: 0, airborne: false },
  });
  const sweeping = pose !== null && isSweeping(pose);
  const tip = sweeping ? character.heldTip(scratchTip) : null;
  const hand = tip === null ? null : character.handPosition(scratchHand);
  showing.trail.update(deltaSeconds, hand, tip);
  if (demo.burst !== undefined && landed(before, move)) {
    // Out in front, where the blow would find something.
    const yaw = character.group.rotation.y;
    const aheadX = -Math.sin(yaw);
    const aheadZ = -Math.cos(yaw);
    const at = scratchTip.set(
      character.group.position.x + aheadX * 0.9,
      demo.burst === 'dust' ? 0.05 : demo.burst === 'wood' ? 0.9 : 0.4,
      character.group.position.z + aheadZ * 0.9,
    );
    const toward = demo.burst === 'wood' ? -1 : 1;
    bursts?.burst(
      demo.burst,
      at,
      aheadX * toward,
      aheadZ * toward,
      move.kind === ActionKind.Strike ? 1.6 : 1,
    );
  }
}

const scratchTip = new THREE.Vector3();
const scratchHand = new THREE.Vector3();

/** Whether a blow landed between one moment of a move and the next. */
function landed(
  before: { kind: ActionKind; step: number; age: number },
  now: { kind: ActionKind; step: number; age: number },
): boolean {
  const impact =
    now.kind === ActionKind.Strike
      ? STRIKE.impact
      : now.kind === ActionKind.Swing
        ? (LIGHT_COMBO[now.step - 1]?.impact ?? -1)
        : -1;
  if (impact < 0 || now.age < impact) return false;
  const sameMove = before.kind === now.kind && before.step === now.step;
  return !sameMove || before.age < impact;
}

/**
 * Somebody sat in the chair and somebody lying on the bed, `at` ticks into
 * settling, for `?gallery=home&resting`: how the two moves fit the real
 * furniture. Returns what draws them each frame.
 */
export async function addRestingCharacters(
  scene: THREE.Scene,
  at: number,
): Promise<(deltaSeconds: number) => void> {
  await Promise.all([preloadCharacterModels(), preloadItemModels(), preloadCharacterAnimations()]);
  const settle = (place: RestingPlace, kind: ActionKind, item: ItemId | null): Character => {
    const character = createCharacter('knight', 0xf2efe6);
    character.group.position.set(place.stand.x, 0, place.stand.z);
    character.group.rotation.y = place.stand.yaw;
    character.setEquippedItem(item);
    character.setRestSpot(place.rest);
    scene.add(character.group);
    for (let tick = 0; tick <= at; tick++) drawResting(character, kind, tick, TICK_SECONDS);
    return character;
  };
  const sitter = settle(HOME_CHAIR, ActionKind.Sit, 'axe');
  const sleeper = settle(HOME_BED, ActionKind.Lie, null);
  let age = at;
  return (deltaSeconds) => {
    age += deltaSeconds / TICK_SECONDS;
    drawResting(sitter, ActionKind.Sit, age, deltaSeconds);
    drawResting(sleeper, ActionKind.Lie, age, deltaSeconds);
  };
}

function drawResting(
  character: Character,
  kind: ActionKind,
  age: number,
  deltaSeconds: number,
): void {
  character.update(deltaSeconds, {
    move: { kind, step: 0, age, atTree: false, flinchVariant: 0, roll: 'forward' },
    locomotion: { speed: 0, airborne: false },
  });
}
