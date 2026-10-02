import * as THREE from 'three/webgpu';

import {
  ActionKind,
  CHARGE_TICKS,
  DODGE,
  FLINCH,
  KNOCKED_OUT_TICKS,
  LIGHT_COMBO,
  RAIDER_KINDS,
  RAIDER_KIND_ORDER,
  RISE,
  RiseFrom,
  STRIKE,
  TICK_SECONDS,
  windupTicks,
  type RaiderKindId,
} from '@acorn/shared';

import { preloadCharacterAnimations } from '../scene/character-animations';
import { MoveMemory } from '../scene/character-driver';
import { ImpactBursts } from '../scene/impact-bursts';
import { createNameplate } from '../scene/nameplate';
import { RaiderFigure } from '../scene/raider-figure';
import { preloadRaiderModels } from '../scene/raider-model';
import type { FireLights } from '../scene/fire-light';
import type { RendererSetup } from '../scene/renderer';

/**
 * Every skeleton raider, fighting thin air, for looking them over (see
 * decision 0063): `?gallery=raiders` shows each kind's moves, looping;
 * `&demo=` picks one move; `&kind=` one skeleton; `&strip=N` lays that one
 * out as N frozen moments across its length, or up to `&upto=` ticks in.
 */

interface Step {
  readonly kind: ActionKind;
  readonly step: number;
  readonly age: number;
}

interface Demo {
  readonly name: string;
  /** How long it runs before it loops, in ticks, for this kind of skeleton. */
  length(raider: RaiderKindId): number;
  move(raider: RaiderKindId, age: number): Step;
  /** Ticks at which a blow lands on it, to see it flinch, flash and chip. */
  readonly struckAt?: readonly number[];
  /** How fast it walks (on the spot), in metres a second. */
  readonly speed?: number;
}

const IDLE: Step = { kind: ActionKind.Idle, step: 0, age: 0 };

/** The wind-up and the whole light combo, as each kind throws it. */
function attack(raider: RaiderKindId, age: number): Step {
  const windup = windupTicks(RAIDER_KINDS[raider].windup);
  if (age < windup) return { kind: ActionKind.Windup, step: RAIDER_KINDS[raider].windup, age };
  let at = age - windup;
  const swings = RAIDER_KINDS[raider].comboLength;
  for (let step = 1; step <= swings; step++) {
    const swing = LIGHT_COMBO[step - 1];
    if (swing === undefined) break;
    const lasts = step === swings ? swing.end : swing.chain;
    if (at < lasts) return { kind: ActionKind.Swing, step, age: at };
    at -= lasts;
  }
  return IDLE;
}

function attackLength(raider: RaiderKindId): number {
  let ticks = windupTicks(RAIDER_KINDS[raider].windup);
  const swings = RAIDER_KINDS[raider].comboLength;
  for (let step = 1; step <= swings; step++) {
    const swing = LIGHT_COMBO[step - 1];
    ticks += step === swings ? (swing?.end ?? 0) : (swing?.chain ?? 0);
  }
  return ticks + 12;
}

const DEMOS: readonly Demo[] = [
  { name: 'attack', length: attackLength, move: attack },
  {
    name: 'creep',
    length: attackLength,
    move: attack,
    speed: 1.2,
  },
  {
    name: 'strike',
    length: () => CHARGE_TICKS + STRIKE.end + 10,
    move: (_, age) =>
      age < CHARGE_TICKS
        ? { kind: ActionKind.Charge, step: 0, age }
        : age < CHARGE_TICKS + STRIKE.end
          ? { kind: ActionKind.Strike, step: 0, age: age - CHARGE_TICKS }
          : IDLE,
  },
  {
    name: 'struck',
    length: () => 40,
    struckAt: [4, 22],
    move: (_, age) =>
      age >= 4 && age < 4 + FLINCH.end
        ? { kind: ActionKind.Flinch, step: 0, age: age - 4 }
        : age >= 22 && age < 22 + FLINCH.end
          ? { kind: ActionKind.Flinch, step: 0, age: age - 22 }
          : IDLE,
  },
  {
    name: 'dodge',
    length: () => DODGE.end + 10,
    move: (_, age) => (age < DODGE.end ? { kind: ActionKind.Dodge, step: 0, age } : IDLE),
  },
  {
    name: 'rise',
    length: () => RISE.ground + 14,
    move: (_, age) =>
      age < RISE.ground ? { kind: ActionKind.Rise, step: RiseFrom.Ground, age } : IDLE,
  },
  {
    name: 'down',
    length: () => KNOCKED_OUT_TICKS,
    move: (_, age) => ({ kind: ActionKind.KnockedOut, step: 0, age }),
  },
];

interface Showing {
  readonly demo: Demo;
  readonly raider: RaiderKindId;
  figure: RaiderFigure;
  memory: MoveMemory;
  readonly x: number;
  readonly z: number;
  age: number;
  readonly frozen: boolean;
}

export async function showRaiders(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  fireLights: FireLights,
  params: URLSearchParams,
): Promise<void> {
  await Promise.all([preloadRaiderModels(), preloadCharacterAnimations()]);
  const picked = params.get('demo');
  const demos = picked === null ? DEMOS : DEMOS.filter((demo) => demo.name === picked);
  const askedKind = params.get('kind');
  const raiders =
    askedKind !== null && askedKind in RAIDER_KINDS
      ? [askedKind as RaiderKindId]
      : RAIDER_KIND_ORDER;
  const strip = Number(params.get('strip') ?? 0);
  const spacing = Number(params.get('spacing') ?? 1.8);
  const turn = Number(params.get('turn') ?? 0.5);

  const bursts = new ImpactBursts();
  scene.add(bursts.group);
  const showings: Showing[] = [];
  const place = (
    demo: Demo,
    raider: RaiderKindId,
    x: number,
    z: number,
    age: number,
    frozen: boolean,
  ): void => {
    const figure = RaiderFigure.create(raider, scene, bursts);
    if (figure === null) return;
    const label = createNameplate(frozen ? `${demo.name} @${age}` : `${raider} ${demo.name}`);
    label.sprite.position.set(x, 1.95, z);
    label.sprite.scale.multiplyScalar(0.55);
    scene.add(label.sprite);
    showings.push({ demo, raider, figure, memory: new MoveMemory(), x, z, age, frozen });
  };

  const onlyDemo = demos[0];
  const onlyKind = raiders[0];
  if (strip > 1 && onlyDemo !== undefined && onlyKind !== undefined) {
    const upto = Number(params.get('upto') ?? Infinity);
    const length = Math.min(onlyDemo.length(onlyKind), upto + 1);
    for (let i = 0; i < strip; i++) {
      const age = Math.round((length - 1) * (i / (strip - 1)));
      place(onlyDemo, onlyKind, (i - (strip - 1) / 2) * spacing, 0, age, true);
    }
  } else {
    demos.forEach((demo, row) => {
      raiders.forEach((raider, column) => {
        place(
          demo,
          raider,
          (column - (raiders.length - 1) / 2) * spacing,
          row * spacing * 1.2,
          0,
          false,
        );
      });
    });
  }

  const columns = strip > 1 ? strip : raiders.length;
  const rows = strip > 1 ? 1 : demos.length;
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 300);
  const target = new THREE.Vector3(0, 0.7, ((rows - 1) * spacing * 1.2) / 2);
  const distance = Number(params.get('distance') ?? Math.max(columns, rows) * spacing * 1.1 + 2.5);
  const height = Number(params.get('height') ?? distance * 0.3);
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

  const drawAt = (showing: Showing, age: number, before: number, deltaSeconds: number): void => {
    const step = showing.demo.move(showing.raider, age);
    const move = showing.memory.view(step.kind, step.step, step.age, false, 'backward');
    showing.figure.draw(
      deltaSeconds,
      { x: showing.x, y: 0, z: showing.z, yaw: turn },
      { move, locomotion: { speed: showing.demo.speed ?? 0, airborne: false } },
      0,
    );
    for (const at of showing.demo.struckAt ?? []) {
      if (before < at && age >= at) {
        showing.figure.struck(-Math.sin(turn), -Math.cos(turn), 1, false, 0);
      }
    }
  };

  // A frozen moment still needs everything run up to it: played through
  // quickly, once, in quarter ticks.
  for (const showing of showings) {
    if (!showing.frozen) continue;
    for (let quarter = 0; quarter <= showing.age * 4; quarter++) {
      drawAt(showing, quarter / 4, (quarter - 1) / 4, TICK_SECONDS / 4);
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
      const length = showing.demo.length(showing.raider);
      showing.age = (showing.age + delta / TICK_SECONDS) % length;
      if (showing.age < before) {
        // Round again from the start: a fresh skeleton, so it can rise or fall apart again.
        showing.figure.dispose();
        const fresh = RaiderFigure.create(showing.raider, scene, bursts);
        if (fresh !== null) showing.figure = fresh;
        showing.memory = new MoveMemory();
      }
      drawAt(showing, showing.age, showing.age < before ? -1 : before, delta);
    }
    if (showings.some((showing) => !showing.frozen)) bursts.update(delta);
    fireLights.update(camera.position);
    renderer.render(scene, camera);
    frames += 1;
    if (frames === 8) document.body.dataset.galleryReady = 'true';
  });
}
