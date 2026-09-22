import * as THREE from 'three/webgpu';

import { createRng, hashSeed } from '@acorn/shared';

import { WATER_SURFACE_Y } from './pond';

/** Where the rod is held and where its tip is, relative to the player's feet and facing. */
const ROD_HAND_UP = 1.0;
const ROD_HAND_FORWARD = 0.35;
const ROD_TIP_UP = 1.75;
const ROD_TIP_FORWARD = 1.6;
/** Points along the line, enough for it to sag rather than run dead straight. */
const LINE_POINTS = 10;
/** How far the middle of the line hangs below a straight one. */
const LINE_SAG = 0.35;

/** The float's gentle rocking while it waits. */
const IDLE_BOB_METRES = 0.012;
const IDLE_BOB_SPEED = 3.6;
/** A nibble: a quick, shallow dip. */
const NIBBLE_DEPTH = 0.045;
const NIBBLE_SECONDS = 0.28;
/** A bite: pulled right under, out of sight. */
const BITE_DEPTH = 0.22;
/** How fast a ring of ripples spreads, and how long it lasts. */
const RIPPLE_SPEED = 1.1;
const RIPPLE_SECONDS = 0.9;

/** One player's line in the water. */
interface FloatLine {
  readonly float: THREE.Group;
  /** The rod in their hands, drawn only while the line is out. */
  readonly rod: THREE.Mesh;
  readonly line: THREE.Line;
  readonly linePositions: Float32Array;
  readonly x: number;
  readonly z: number;
  /** Seconds since it landed. */
  age: number;
  /** When the nibbles come, in seconds after landing. Just for show. */
  readonly nibbles: readonly number[];
  biting: boolean;
  /** Seconds since the float went under. */
  sinceBite: number;
}

interface Ripple {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  age: number;
}

/** Where a player is and which way they face, for drawing their line. */
export interface Angler {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * Every float in the pond, and the lines back to the rods holding them.
 *
 * The server says when a float lands, when it goes under and when the line
 * comes in. Everything in between is decoration: the bobbing and the nibbles
 * are worked out here and mean nothing. Only the big dip is a bite.
 */
export class Floats {
  readonly group = new THREE.Group();

  private readonly lines = new Map<number, FloatLine>();
  private readonly ripples: Ripple[] = [];

  // Big for a real float, but it has to be seen from six metres behind you.
  private readonly floatBody = new THREE.SphereGeometry(0.1, 12, 8);
  private readonly floatCap = new THREE.SphereGeometry(
    0.103,
    12,
    5,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  private readonly rippleShape = new THREE.RingGeometry(0.16, 0.2, 24);
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2efe6,
    roughness: 0.5,
  });
  private readonly capMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8432f,
    roughness: 0.5,
  });
  private readonly lineMaterial = new THREE.LineBasicMaterial({ color: 0xe8e4da });
  /** One metre of rod, laid along Z so it can be pointed with lookAt. */
  private readonly rodShape = new THREE.CylinderGeometry(0.016, 0.028, 1, 6);
  private readonly rodMaterial = new THREE.MeshStandardMaterial({
    color: 0xb89a5e,
    roughness: 0.8,
    flatShading: true,
  });
  private readonly hand = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();

  constructor() {
    this.rippleShape.rotateX(-Math.PI / 2);
    this.rodShape.rotateX(Math.PI / 2);
  }

  /** A float has landed. */
  cast(netId: number, x: number, z: number): void {
    this.reelIn(netId);

    const float = new THREE.Group();
    const body = new THREE.Mesh(this.floatBody, this.bodyMaterial);
    const cap = new THREE.Mesh(this.floatCap, this.capMaterial);
    cap.position.y = 0.01;
    body.castShadow = true;
    float.add(body, cap);
    float.position.set(x, WATER_SURFACE_Y, z);

    const linePositions = new Float32Array(LINE_POINTS * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const line = new THREE.Line(lineGeometry, this.lineMaterial);
    // It moves every frame, so never let it be culled against stale bounds.
    line.frustumCulled = false;

    const rod = new THREE.Mesh(this.rodShape, this.rodMaterial);
    rod.castShadow = true;
    // Hidden until we know where the angler is standing.
    rod.visible = false;

    this.group.add(float, line, rod);
    this.lines.set(netId, {
      float,
      rod,
      line,
      linePositions,
      x,
      z,
      age: 0,
      nibbles: nibblesFor(netId, x, z),
      biting: false,
      sinceBite: 0,
    });
    this.ripple(x, z);
  }

  /** The float has gone under. */
  bite(netId: number): void {
    const entry = this.lines.get(netId);
    if (entry === undefined || entry.biting) return;
    entry.biting = true;
    entry.sinceBite = 0;
    this.ripple(entry.x, entry.z);
  }

  /** The line has come in, whatever the reason. */
  reelIn(netId: number): void {
    const entry = this.lines.get(netId);
    if (entry === undefined) return;
    this.group.remove(entry.float, entry.line, entry.rod);
    entry.line.geometry.dispose();
    this.lines.delete(netId);
  }

  has(netId: number): boolean {
    return this.lines.has(netId);
  }

  /** Where this player's float is, if they have a line out. */
  floatOf(netId: number): { x: number; z: number } | undefined {
    const entry = this.lines.get(netId);
    return entry === undefined ? undefined : { x: entry.x, z: entry.z };
  }

  /**
   * Bob every float and draw every line back to its rod.
   *
   * `anglerOf` says where the player holding each line is. A line whose player
   * cannot be found is left where it is until the server reels it in.
   */
  update(deltaSeconds: number, anglerOf: (netId: number) => Angler | undefined): void {
    for (const [netId, entry] of this.lines) {
      entry.age += deltaSeconds;
      if (entry.biting) entry.sinceBite += deltaSeconds;
      entry.float.position.y = WATER_SURFACE_Y + floatHeight(entry);

      const angler = anglerOf(netId);
      if (angler !== undefined) this.drawLine(entry, angler);
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      if (ripple === undefined) continue;
      ripple.age += deltaSeconds;
      const grown = 1 + ripple.age * RIPPLE_SPEED * 4;
      ripple.mesh.scale.set(grown, 1, grown);
      ripple.material.opacity = Math.max(0, 0.6 * (1 - ripple.age / RIPPLE_SECONDS));
      if (ripple.age >= RIPPLE_SECONDS) {
        this.group.remove(ripple.mesh);
        ripple.material.dispose();
        this.ripples.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const netId of [...this.lines.keys()]) this.reelIn(netId);
    for (const ripple of this.ripples) ripple.material.dispose();
    this.ripples.length = 0;
    this.floatBody.dispose();
    this.floatCap.dispose();
    this.rippleShape.dispose();
    this.rodShape.dispose();
    this.rodMaterial.dispose();
    this.bodyMaterial.dispose();
    this.capMaterial.dispose();
    this.lineMaterial.dispose();
  }

  private ripple(x: number, z: number): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0xdcecef,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.rippleShape, material);
    mesh.position.set(x, WATER_SURFACE_Y + 0.005, z);
    this.group.add(mesh);
    this.ripples.push({ mesh, material, age: 0 });
  }

  /** The rod held out in front, and the line from its tip to the float. */
  private drawLine(entry: FloatLine, angler: Angler): void {
    const forwardX = -Math.sin(angler.yaw);
    const forwardZ = -Math.cos(angler.yaw);
    this.hand.set(
      angler.x + forwardX * ROD_HAND_FORWARD,
      angler.y + ROD_HAND_UP,
      angler.z + forwardZ * ROD_HAND_FORWARD,
    );
    this.tip.set(
      angler.x + forwardX * ROD_TIP_FORWARD,
      angler.y + ROD_TIP_UP,
      angler.z + forwardZ * ROD_TIP_FORWARD,
    );
    entry.rod.position.copy(this.hand).lerp(this.tip, 0.5);
    entry.rod.scale.set(1, 1, this.hand.distanceTo(this.tip));
    entry.rod.lookAt(this.tip);
    entry.rod.visible = true;

    const tipX = this.tip.x;
    const tipY = this.tip.y;
    const tipZ = this.tip.z;
    const end = entry.float.position;

    for (let i = 0; i < LINE_POINTS; i++) {
      const t = i / (LINE_POINTS - 1);
      const sag = LINE_SAG * 4 * t * (1 - t);
      entry.linePositions[i * 3] = tipX + (end.x - tipX) * t;
      entry.linePositions[i * 3 + 1] = tipY + (end.y + 0.06 - tipY) * t - sag;
      entry.linePositions[i * 3 + 2] = tipZ + (end.z - tipZ) * t;
    }
    const attribute = entry.line.geometry.getAttribute('position');
    attribute.needsUpdate = true;
  }
}

/** How high the float rides right now, relative to the water. */
function floatHeight(entry: FloatLine): number {
  if (entry.biting) {
    // Snatched under, then held there: whatever is on the line is pulling.
    const pull = Math.min(1, entry.sinceBite / 0.12);
    return -BITE_DEPTH * pull + Math.sin(entry.sinceBite * 22) * 0.01;
  }

  let height = Math.sin(entry.age * IDLE_BOB_SPEED) * IDLE_BOB_METRES;
  for (const at of entry.nibbles) {
    const into = entry.age - at;
    if (into < 0 || into > NIBBLE_SECONDS) continue;
    height -= Math.sin((into / NIBBLE_SECONDS) * Math.PI) * NIBBLE_DEPTH;
  }
  return height;
}

/**
 * When the nibbles come, for show.
 *
 * Worked out from who cast and where the float landed, so everybody watching
 * the same float sees the same nibbles. They say nothing about the bite.
 */
function nibblesFor(netId: number, x: number, z: number): number[] {
  const rng = createRng(hashSeed('nibble', netId, Math.round(x * 100), Math.round(z * 100)));
  const times: number[] = [];
  let at = rng.nextRange(1.2, 2.4);
  while (at < 12) {
    times.push(at);
    at += rng.nextRange(1.1, 2.8);
  }
  return times;
}
