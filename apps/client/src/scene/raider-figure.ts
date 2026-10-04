import * as THREE from 'three/webgpu';

import {
  ActionKind,
  CHARGE_TICKS,
  LIGHT_COMBO,
  RAIDER_KINDS,
  RiseFrom,
  STRIKE,
  TICK_SECONDS,
  type RaiderKindId,
} from '@acorn/shared';

import { playSwoosh } from '../audio/sound';
import { playBoneClatter, playClank, playEarthRumble, playWindupRing } from '../audio/raid-sounds';
import { createCharacterFromModel, type Character, type CharacterFrame } from './character';
import { isSweeping, type MovePose } from './character-moves';
import type { ImpactBursts } from './impact-bursts';
import { RaiderHealthBar } from './raider-health-bar';
import { raiderModelTemplate } from './raider-model';
import { raiderWeapon } from './raider-weapons';
import { WeaponTrail } from './weapon-trail';

/**
 * One skeleton raider, drawn: its model and weapon, every move played the
 * same way a player's is, and everything that makes a fight with one read
 * (see decision 0063) -
 *
 * - its eyes burn hotter, and its weapon flashes, as it draws back to swing:
 *   the tell to roll or step away;
 * - a blow on it flashes it white, chips bone off it and knocks it back,
 *   or throws sparks off one that shrugged it off;
 * - it climbs up out of the ground as it arrives, falls apart when it is
 *   beaten, and sinks back into the earth if it gives up;
 * - a health bar over its head, once it is worth seeing.
 *
 * Only ever draws: what it actually does is the server's say.
 */

/** The red of an enemy's swing, against a player's pale gold. */
const TRAIL_COLOR = 0xff8a6a;
/** Where the health bar floats, above the skull. */
const BAR_HEIGHT = 1.62;
/** The hot glow eyes take on, drawing back to swing. */
const HOT_EYES = new THREE.Color(1, 0.12, 0.03);
const HOT_EYES_INTENSITY = 4;
/** How long a hit flash lasts, in seconds. */
const FLASH_SECONDS = 0.16;
const FLASH_WHITE = new THREE.Color(1, 1, 1);
const FLASH_SPARK = new THREE.Color(1, 0.75, 0.4);
/** A visual recoil on top of the real knockback, which arrives a moment later from the server. */
const JOLT_SECONDS = 0.28;
const JOLT_DISTANCE = 0.2;
/** How long the glint on a weapon drawing back lasts, and how big it gets, in metres. */
const GLINT_SECONDS = 0.34;
const GLINT_SIZE = 0.62;
/** Climbing out of the ground: how deep it starts, and how many ticks of rising it takes. */
const RISE_DEPTH = 0.45;
const RISE_EMERGE_TICKS = 16;
/** Falling apart: when it starts to sink, and how far, in ticks into being down. */
const CRUMBLE_SINK_FROM = 16;
const CRUMBLE_SINK_TO = 32;
const CRUMBLE_DEPTH = 0.55;
/** Sinking back into the earth on giving up: how long it takes, in seconds, and how deep. */
const DEPART_SECONDS = 0.7;
const DEPART_DEPTH = 0.9;

/** What it is doing, as far as the figure needs to notice a new move starting. */
interface SeenMove {
  kind: ActionKind;
  step: number;
  age: number;
}

export class RaiderFigure {
  readonly character: Character;
  readonly bar: RaiderHealthBar;
  private readonly eyes: THREE.MeshStandardMaterial[] = [];
  private readonly bones: THREE.MeshStandardMaterial[] = [];
  private readonly eyeColor = new THREE.Color();
  private readonly eyeIntensity: number = 1;
  private readonly trail = new WeaponTrail(TRAIL_COLOR);
  private readonly glint: THREE.Sprite;
  private readonly glintMaterial: THREE.SpriteMaterial;
  private seen: SeenMove | null = null;
  private flash = 0;
  private flashColor = FLASH_WHITE;
  private jolt: { awayX: number; awayZ: number; age: number; strength: number } | null = null;
  private glintAge = Infinity;
  private glintStrength = 1;
  private sinceDown: number | null = null;
  private crumbled = false;
  private departing: number | null = null;
  private departFrom = 0;
  private lastFrame: CharacterFrame | null = null;
  private dustTimer = 0;
  private readonly scratchTip = new THREE.Vector3();
  private readonly scratchHand = new THREE.Vector3();
  private readonly scratchAt = new THREE.Vector3();
  /** How every part of the body was before `showEverythingAt`, to set it back. */
  private readonly asBuilt: Array<{
    readonly object: THREE.Object3D;
    readonly visible: boolean;
    readonly frustumCulled: boolean;
  }> = [];

  private constructor(
    readonly kind: RaiderKindId,
    character: Character,
    private readonly parent: THREE.Object3D,
    private readonly bursts: ImpactBursts,
  ) {
    this.character = character;
    character.group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = child.material;
      if (!(material instanceof THREE.MeshStandardMaterial)) return;
      if (material.name === 'Glow' && !this.eyes.includes(material)) this.eyes.push(material);
      if (material.name === 'skeleton' && !this.bones.includes(material)) this.bones.push(material);
    });
    const firstEye = this.eyes[0];
    if (firstEye !== undefined) {
      this.eyeColor.copy(firstEye.emissive);
      this.eyeIntensity = firstEye.emissiveIntensity;
    }
    for (const material of this.bones) material.emissive.set(0xffffff);
    for (const material of this.bones) material.emissiveIntensity = 0;

    this.bar = new RaiderHealthBar(RAIDER_KINDS[kind].displayName);
    this.bar.sprite.position.set(0, BAR_HEIGHT, 0);
    character.group.add(this.bar.sprite);

    this.glintMaterial = new THREE.SpriteMaterial({
      map: glintTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      color: 0xffe2b0,
    });
    this.glint = new THREE.Sprite(this.glintMaterial);
    this.glint.renderOrder = 12;
    this.glint.visible = false;

    parent.add(character.group, this.trail.mesh, this.glint);
  }

  /**
   * A skeleton of this kind, or null while its model is still on its way.
   * `spare` is one of the same kind put by with `retire`, to use again
   * rather than building a new one (see `RaiderCrowd`).
   */
  static create(
    kind: RaiderKindId,
    parent: THREE.Object3D,
    bursts: ImpactBursts,
    spare: Character | null = null,
  ): RaiderFigure | null {
    if (spare !== null) return new RaiderFigure(kind, spare, parent, bursts);
    const template = raiderModelTemplate(kind);
    if (template === undefined) return null;
    const character = createCharacterFromModel(template, {
      tint: null,
      weapon: raiderWeapon(kind),
    });
    return new RaiderFigure(kind, character, parent, bursts);
  }

  /** Beaten, and falling apart. */
  get down(): boolean {
    return this.sinceDown !== null;
  }

  /** Done sinking away after giving up, and ready to be thrown away. */
  get gone(): boolean {
    return this.departing !== null && this.departing >= DEPART_SECONDS;
  }

  /**
   * Draw this frame, standing at `at` and doing `frame`. `volume` is how
   * loud it should sound, from 0 to 1, by how far off it is.
   */
  draw(
    deltaSeconds: number,
    at: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number },
    frame: CharacterFrame,
    volume: number,
  ): MovePose | null {
    const group = this.character.group;
    group.position.set(at.x, at.y, at.z);
    group.rotation.y = at.yaw;
    this.lastFrame = frame;
    this.noticeNewMove(frame.move, volume);

    const pose = this.character.update(deltaSeconds, frame);
    this.glow(pose, frame.move);
    this.flashFor(deltaSeconds);
    this.recoil(deltaSeconds);
    this.climbOrSink(deltaSeconds, frame.move);
    this.streak(deltaSeconds, pose);
    this.glintFor(deltaSeconds, pose, frame.move);
    this.bar.update(deltaSeconds);
    return pose;
  }

  /**
   * One of a player's blows landing on it, from the direction `awayX`,
   * `awayZ` points away from: `strength` above 1 for a heavy blow, and
   * `shrugged` for one it took without flinching.
   */
  struck(awayX: number, awayZ: number, strength: number, shrugged: boolean, volume = 1): void {
    this.flash = 1;
    this.flashColor = shrugged ? FLASH_SPARK : FLASH_WHITE;
    const group = this.character.group;
    const at = this.scratchAt.set(group.position.x, group.position.y + 0.85, group.position.z);
    at.x -= awayX * 0.2;
    at.z -= awayZ * 0.2;
    this.bursts.burst(shrugged ? 'spark' : 'bone', at, awayX, awayZ, strength);
    if (shrugged) {
      playClank(volume);
    } else {
      this.jolt = { awayX, awayZ, age: 0, strength };
      playBoneClatter(volume);
    }
    // The same beat's pause the player's own swing gets, on both ends of it.
    this.character.hitStop(strength > 1 ? 0.12 : 0.06);
  }

  /** Gave up, or went out of sight: sink back into the earth rather than vanish. */
  depart(): void {
    if (this.departing !== null) return;
    this.departing = 0;
    this.bar.setWanted(false, false);
    const group = this.character.group;
    this.departFrom = group.position.y;
    this.bursts.burst('dust', this.scratchAt.copy(group.position), 0, 0, 1.2);
  }

  /** Sinking away, once departing: nothing else moves it any more. */
  fade(deltaSeconds: number): void {
    if (this.departing === null) return;
    this.departing += deltaSeconds;
    const sink = smoothstep(0, DEPART_SECONDS, this.departing);
    const group = this.character.group;
    group.position.y = this.departFrom - DEPART_DEPTH * sink;
    group.scale.setScalar(1 - 0.3 * sink);
    if (this.lastFrame !== null) this.character.update(deltaSeconds, this.lastFrame);
    this.trail.update(deltaSeconds, null, null);
    this.glint.visible = false;
    this.bar.update(deltaSeconds);
  }

  /** Gone for good, beaten: one last puff of bone dust where it lay. */
  scatter(): void {
    const group = this.character.group;
    const spot = this.scratchAt.copy(group.position);
    spot.y += 0.15;
    this.bursts.burst('dust', spot, 0, 0, 1);
    this.bursts.burst('bone', spot, 0, 0, 0.8);
  }

  /**
   * Stand at a spot with every part showing - weapon trail, glint and health
   * bar too - and none of it skipped for being off screen, so drawing it
   * once draws all of it (see `RaiderCrowd.rehearse`).
   */
  showEverythingAt(x: number, y: number, z: number): void {
    this.character.group.position.set(x, y, z);
    this.glint.position.set(x, y, z);
    this.character.group.traverse((object) => {
      this.asBuilt.push({ object, visible: object.visible, frustumCulled: object.frustumCulled });
    });
    for (const part of [this.character.group, this.trail.mesh, this.glint]) {
      part.traverse((object) => {
        object.visible = true;
        object.frustumCulled = false;
      });
    }
  }

  /**
   * Done with, but with its body put by to be used again: taken out of the
   * world and set back the way it was built, with everything else thrown
   * away. Use the body that comes back for the next one of the same kind.
   */
  retire(): Character {
    this.parent.remove(this.character.group, this.trail.mesh, this.glint);
    this.character.group.remove(this.bar.sprite);
    this.trail.dispose();
    this.bar.dispose();
    this.glintMaterial.dispose();
    const group = this.character.group;
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.scale.setScalar(1);
    for (const { object, visible, frustumCulled } of this.asBuilt) {
      object.visible = visible;
      object.frustumCulled = frustumCulled;
    }
    for (const material of this.eyes) {
      material.emissive.copy(this.eyeColor);
      material.emissiveIntensity = this.eyeIntensity;
    }
    for (const material of this.bones) material.emissiveIntensity = 0;
    return this.character;
  }

  dispose(): void {
    this.parent.remove(this.character.group, this.trail.mesh, this.glint);
    this.character.dispose();
    this.trail.dispose();
    this.bar.dispose();
    this.glintMaterial.dispose();
  }

  /** Something new started: the sound and spectacle of it starting. */
  private noticeNewMove(move: CharacterFrame['move'], volume: number): void {
    const last = this.seen;
    const fresh =
      last === null || move.kind !== last.kind || move.step !== last.step || move.age < last.age;
    this.seen = { kind: move.kind, step: move.step, age: move.age };
    if (!fresh) return;
    const group = this.character.group;
    const age = Math.max(0, move.age);
    switch (move.kind) {
      case ActionKind.Windup:
        this.glintAge = 0;
        this.glintStrength = 1;
        playWindupRing(volume);
        break;
      case ActionKind.Charge:
        this.glintAge = 0;
        this.glintStrength = 1.4;
        playWindupRing(volume, true);
        break;
      case ActionKind.Swing: {
        const swing = LIGHT_COMBO[Math.min(Math.max(move.step, 1), LIGHT_COMBO.length) - 1];
        const ticksToBlow = (swing?.impact ?? 4) - age;
        if (ticksToBlow > 0) playSwoosh(ticksToBlow * TICK_SECONDS, 1, volume);
        break;
      }
      case ActionKind.Strike: {
        const ticksToBlow = STRIKE.impact - age;
        if (ticksToBlow > 0) playSwoosh(ticksToBlow * TICK_SECONDS, 1.6, volume);
        break;
      }
      case ActionKind.KnockedOut:
        if (this.sinceDown === null) {
          this.sinceDown = 0;
          this.bar.setHealth(0);
          const spot = this.scratchAt.copy(group.position);
          spot.y += 0.7;
          this.bursts.burst('bone', spot, 0, 0, 1.6);
          playBoneClatter(volume, true);
        }
        break;
      case ActionKind.Rise:
        // Only a fresh arrival climbs out of the ground: nothing else rises.
        if (last === null && move.step === RiseFrom.Ground && age < RISE_EMERGE_TICKS) {
          this.bursts.burst('dust', this.scratchAt.copy(group.position), 0, 0, 1.6);
          playEarthRumble(volume);
        }
        break;
    }
  }

  /** Eyes burning hotter as it draws back to swing, or gathers a charged strike. */
  private glow(pose: MovePose | null, move: CharacterFrame['move']): void {
    let heat = 0;
    if (pose !== null) heat = Math.max(pose.windup, pose.charge);
    if (move.kind === ActionKind.Swing || move.kind === ActionKind.Strike) {
      // Still burning through the blow itself, cooling once it has landed.
      const impact =
        move.kind === ActionKind.Strike
          ? STRIKE.impact
          : (LIGHT_COMBO[Math.min(Math.max(move.step, 1), 3) - 1]?.impact ?? 4);
      heat = 1 - smoothstep(impact, impact + 6, move.age);
    }
    if (move.kind === ActionKind.Charge) heat = Math.min(1, move.age / CHARGE_TICKS);
    if (this.sinceDown !== null) heat = 0;
    for (const eye of this.eyes) {
      eye.emissive.copy(this.eyeColor).lerp(HOT_EYES, heat);
      eye.emissiveIntensity = this.eyeIntensity + (HOT_EYES_INTENSITY - this.eyeIntensity) * heat;
    }
    if (this.sinceDown !== null) {
      // Going out as it falls apart.
      const out = 1 - smoothstep(0, 1, this.sinceDown);
      for (const eye of this.eyes) eye.emissiveIntensity = this.eyeIntensity * out;
    }
  }

  private flashFor(deltaSeconds: number): void {
    this.flash = Math.max(0, this.flash - deltaSeconds / FLASH_SECONDS);
    const amount = this.flash * this.flash * 1.4;
    for (const material of this.bones) {
      material.emissive.copy(this.flashColor);
      material.emissiveIntensity = amount;
    }
  }

  /** Knocked back a step and easing back, on top of wherever it is drawn. */
  private recoil(deltaSeconds: number): void {
    const jolt = this.jolt;
    if (jolt === null) return;
    jolt.age += deltaSeconds;
    if (jolt.age >= JOLT_SECONDS) {
      this.jolt = null;
      return;
    }
    const knock = (1 - Math.exp(-jolt.age * 40)) * Math.exp(-jolt.age * 10) * jolt.strength;
    this.character.group.position.x += jolt.awayX * JOLT_DISTANCE * knock;
    this.character.group.position.z += jolt.awayZ * JOLT_DISTANCE * knock;
  }

  /** Climbing up out of the ground as it arrives, or sinking into it once beaten. */
  private climbOrSink(deltaSeconds: number, move: CharacterFrame['move']): void {
    const group = this.character.group;
    if (move.kind === ActionKind.Rise && move.step === RiseFrom.Ground && this.sinceDown === null) {
      const emerging = 1 - smoothstep(0, RISE_EMERGE_TICKS, move.age);
      group.position.y -= RISE_DEPTH * emerging;
      // Earth thrown up as it digs its way out.
      this.dustTimer -= deltaSeconds;
      if (emerging > 0.2 && this.dustTimer <= 0) {
        this.dustTimer = 0.18;
        this.bursts.burst('dust', this.scratchAt.copy(group.position), 0, 0, 0.6);
      }
    }
    if (this.sinceDown !== null) {
      this.sinceDown += deltaSeconds;
      const ticks = this.sinceDown / TICK_SECONDS;
      group.position.y -= CRUMBLE_DEPTH * smoothstep(CRUMBLE_SINK_FROM, CRUMBLE_SINK_TO, ticks);
      if (!this.crumbled && ticks >= CRUMBLE_SINK_FROM) {
        this.crumbled = true;
        const spot = this.scratchAt.copy(group.position);
        spot.y += 0.2;
        this.bursts.burst('bone', spot, 0, 0, 1);
        this.bursts.burst('dust', spot, 0, 0, 1);
      }
    }
  }

  private streak(deltaSeconds: number, pose: MovePose | null): void {
    const sweeping = pose !== null && isSweeping(pose) && this.sinceDown === null;
    const tip = sweeping ? this.character.heldTip(this.scratchTip) : null;
    const hand = tip === null ? null : this.character.handPosition(this.scratchHand);
    this.trail.update(deltaSeconds, hand, tip);
  }

  /** A star of light off the weapon as it is drawn back: the moment to get ready. */
  private glintFor(
    deltaSeconds: number,
    pose: MovePose | null,
    move: CharacterFrame['move'],
  ): void {
    const winding = move.kind === ActionKind.Windup || move.kind === ActionKind.Charge;
    const heat = pose === null ? 0 : Math.max(pose.windup, pose.charge);
    // Keep the tell visible through the whole preparation, not just its first
    // third of a second. Interrupting the attack cancels the tell immediately.
    if (winding) this.glintAge = GLINT_SECONDS * 0.25;
    else if (move.kind !== ActionKind.Swing && move.kind !== ActionKind.Strike)
      this.glintAge = Infinity;
    else this.glintAge += deltaSeconds;
    const through = this.glintAge / GLINT_SECONDS;
    if (through >= 1 || this.sinceDown !== null) {
      this.glint.visible = false;
      return;
    }
    const tip = this.character.heldTip(this.scratchTip);
    if (tip === null) {
      this.glint.visible = false;
      return;
    }
    this.glint.visible = true;
    this.glint.position.copy(tip);
    // Pops out fast, then shrinks away, turning a little as it goes.
    const size =
      GLINT_SIZE *
      this.glintStrength *
      (winding ? 0.35 + 0.65 * heat : Math.sin(Math.PI * Math.sqrt(through)));
    this.glint.scale.setScalar(Math.max(0.001, size));
    this.glintMaterial.rotation = through * 1.2;
    this.glintMaterial.opacity = winding ? 0.55 + 0.45 * heat : 1 - through * 0.5;
    this.glintMaterial.color.setHex(this.glintStrength > 1 ? 0xffad73 : 0xffe2b0);
  }
}

let glint: THREE.CanvasTexture | null = null;

/** A four-pointed star of light, drawn once and shared by every glint. */
function glintTexture(): THREE.CanvasTexture {
  if (glint !== null) return glint;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const middle = size / 2;
    const halo = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
    halo.addColorStop(0, 'rgba(255,255,255,1)');
    halo.addColorStop(0.18, 'rgba(255,240,210,0.7)');
    halo.addColorStop(0.5, 'rgba(255,200,140,0.12)');
    halo.addColorStop(1, 'rgba(255,200,140,0)');
    context.fillStyle = halo;
    context.fillRect(0, 0, size, size);
    context.fillStyle = 'rgba(255,255,255,0.95)';
    for (const turn of [0, Math.PI / 2]) {
      context.save();
      context.translate(middle, middle);
      context.rotate(turn);
      context.beginPath();
      context.moveTo(-middle, 0);
      context.quadraticCurveTo(0, -3, middle, 0);
      context.quadraticCurveTo(0, 3, -middle, 0);
      context.fill();
      context.restore();
    }
  }
  glint = new THREE.CanvasTexture(canvas);
  glint.colorSpace = THREE.SRGBColorSpace;
  return glint;
}

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}
