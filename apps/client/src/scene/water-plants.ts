import { positionLocal, uv, vec3 } from 'three/tsl';
import { forestWind, windGustNode } from '../art/forest-wind';
import * as THREE from 'three/webgpu';

import { plainMaterial } from '../art/materials';
import type { ModelBuilder } from '../art/shapes';
import { placed } from '../art/shapes';
import { polyforkPiece } from './polyfork-piece';

/**
 * The plants that grow in still water, shared by the pond and the lake: lily
 * pads - some in flower - and clumps of reeds and cattails. Each is added to a
 * `ModelBuilder`, which merges everything that shares a material, so any
 * number of them costs a handful of draw calls.
 *
 * They are Polyfork's free models once those have loaded (decision 0272):
 * the Lily Pad, the drift of pads with a bud from Lily Pads, the Cattail Reed
 * and the six short clumps of the Reed Bed. Until then, or if a download is
 * missing, they are the plain shapes below.
 */

/** A single pad, 0.6 m across. */
const polyforkLilyPad = polyforkPiece('lily-pad');
/** A 2.5 m drift of pads (`lily-pads-drift`) and a water-lily bud (`bud-0-mesh`). */
const polyforkLilyPads = polyforkPiece('lily-pads');
/** One cattail with its blades, 1.2 m tall. */
const polyforkCattail = polyforkPiece('cattail-reed');
/** Six clumps of short reeds (`clump-N-reeds`), plus leaf litter that would sit under water. */
const polyforkReedBed = polyforkPiece('reed-bed');

const POLYFORK_PAD_RADIUS = 0.3;

export interface WaterPlantMaterials {
  readonly pad: THREE.Material;
  readonly padUnder: THREE.Material;
  readonly petal: THREE.Material;
  readonly petalPink: THREE.Material;
  readonly heart: THREE.Material;
  readonly reed: THREE.Material;
  readonly reedPale: THREE.Material;
  readonly cattail: THREE.Material;
  /** Polyfork's pads and buds: their own material, so ice can hide them like the pads above. */
  readonly polyforkPad: THREE.Material;
  /** Polyfork's reeds, swaying in the wind like the plain ones. */
  readonly polyforkReed: THREE.Material;
}

const polyforkPadPaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const polyforkReedPaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });

/** A copy of a shared Polyfork part with its footprint centred on the origin. */
function centredCopy(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const copy = geometry.clone();
  copy.computeBoundingBox();
  const box = copy.boundingBox!;
  copy.translate(-(box.min.x + box.max.x) / 2, 0, -(box.min.z + box.max.z) / 2);
  return copy;
}

let reedTufts: THREE.BufferGeometry[] | undefined;
/** The Reed Bed's clumps, each centred, without its litter. Undefined until it has loaded. */
function polyforkReedTufts(): readonly THREE.BufferGeometry[] | undefined {
  if (reedTufts !== undefined) return reedTufts;
  const parts = polyforkReedBed.parts();
  if (parts === undefined) return undefined;
  reedTufts = [...parts]
    .filter(([name]) => name.startsWith('clump-'))
    .map(([, geometry]) => centredCopy(geometry));
  return reedTufts.length > 0 ? reedTufts : undefined;
}

const breezeMaterials = new WeakMap<THREE.Material, THREE.Material>();
function reedMaterial(source: THREE.Material): THREE.Material {
  const cached = breezeMaterials.get(source);
  if (cached) return cached;
  const material = new THREE.MeshStandardNodeMaterial().copy(source as THREE.MeshStandardMaterial);
  const tip = uv().y.clamp(0, 1);
  const bend = windGustNode(positionLocal.xz).mul(tip.mul(tip)).mul(0.16);
  material.positionNode = positionLocal.add(
    vec3(bend.mul(forestWind.direction.x), 0, bend.mul(forestWind.direction.y)),
  );
  breezeMaterials.set(source, material);
  return material;
}
/** UV height survives model merging and keeps blades/stalk/head connected. */
function reedWeights(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const positions = geometry.getAttribute('position');
  // Polyfork's models come without texture coordinates.
  if (geometry.getAttribute('uv') === undefined)
    geometry.setAttribute(
      'uv',
      new THREE.BufferAttribute(new Float32Array(positions.count * 2), 2),
    );
  const texcoords = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) texcoords.setY(i, Math.max(0, positions.getY(i)) / 1.5);
  return geometry;
}

/** The painted colours the plants wear: plain, shared materials, so there is nothing of their own to free. */
export function waterPlantMaterials(): WaterPlantMaterials {
  return {
    pad: plainMaterial(0x5f9138, { roughness: 0.7, flatShading: true }),
    padUnder: plainMaterial(0x7a8a3c, { roughness: 0.8, flatShading: true }),
    petal: plainMaterial(0xfbeef0, { roughness: 0.6, flatShading: true }),
    petalPink: plainMaterial(0xf4b9c8, { roughness: 0.6, flatShading: true }),
    heart: plainMaterial(0xf2c94c, { roughness: 0.6, flatShading: true }),
    reed: reedMaterial(plainMaterial(0x5d7a35, { roughness: 0.9, flatShading: true })),
    reedPale: reedMaterial(plainMaterial(0x8a9a4a, { roughness: 0.9, flatShading: true })),
    cattail: reedMaterial(plainMaterial(0x6b4a2e, { roughness: 1, flatShading: true })),
    polyforkPad: polyforkPadPaint,
    polyforkReed: reedMaterial(polyforkReedPaint),
  };
}

/** Adds `geometry`, turned and scaled about its base, with every vertex lifted onto the water. */
function addFloating(
  builder: ModelBuilder,
  material: THREE.Material,
  geometry: THREE.BufferGeometry,
  at: { x: number; y: number; z: number },
  turn: number,
  scale: number,
  surfaceHeightAt: (x: number, z: number) => number,
): void {
  const part = geometry.clone().applyMatrix4(placed(0, 0, 0, { y: turn }, scale));
  const positions = part.getAttribute('position');
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const lift = surfaceHeightAt(at.x + positions.getX(vertex), at.z + positions.getZ(vertex));
    positions.setY(vertex, positions.getY(vertex) + lift - at.y);
  }
  part.computeVertexNormals();
  builder.add(material, part, placed(at.x, at.y + 0.004, at.z));
}

/**
 * Polyfork's drift of lily pads with a bud in it, 2.5 m by 1.8 m at `scale`
 * 1. Returns false, adding nothing, until the model has loaded.
 */
export function addLilyDrift(
  builder: ModelBuilder,
  materials: WaterPlantMaterials,
  at: { x: number; y: number; z: number },
  angle: number,
  scale: number,
  surfaceHeightAt: (x: number, z: number) => number = () => at.y,
): boolean {
  const parts = polyforkLilyPads.parts();
  if (parts === undefined) return false;
  for (const geometry of parts.values()) {
    addFloating(builder, materials.polyforkPad, geometry, at, angle, scale, surfaceHeightAt);
  }
  return true;
}

/**
 * A round pad with the notch every lily pad has, and a lighter underside
 * showing at its curled edge. `flower` puts a water lily in bloom on it.
 */
export function addLilyPad(
  builder: ModelBuilder,
  materials: WaterPlantMaterials,
  at: { x: number; y: number; z: number },
  size: number,
  angle: number,
  flower: 'white' | 'pink' | null,
  surfaceHeightAt: (x: number, z: number) => number = () => at.y,
): void {
  const realPad = polyforkLilyPad.parts();
  if (realPad !== undefined) {
    const scale = size / POLYFORK_PAD_RADIUS;
    for (const geometry of realPad.values()) {
      addFloating(
        builder,
        materials.polyforkPad,
        geometry,
        at,
        angle * 2.7,
        scale,
        surfaceHeightAt,
      );
    }
    // Polyfork has no open water lily, so a flowering pad carries the bud from its drift.
    const bud = polyforkLilyPads.parts()?.get('bud-0-mesh');
    if (flower !== null && bud !== undefined) {
      const lift = { ...at, y: surfaceHeightAt(at.x, at.z) };
      builder.add(materials.polyforkPad, centredCopy(bud), placed(lift.x, lift.y + 0.02, lift.z));
    }
    return;
  }
  const notch = 0.5;
  const top = new THREE.CircleGeometry(size, 12, notch / 2, Math.PI * 2 - notch);
  top.rotateX(-Math.PI / 2);
  const under = new THREE.CircleGeometry(size * 1.03, 12, notch / 2, Math.PI * 2 - notch);
  under.rotateX(-Math.PI / 2);
  const turn = { y: angle * 2.7 };
  for (const geometry of [top, under]) {
    const positions = geometry.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex);
      const z = positions.getZ(vertex);
      const worldX = at.x + Math.cos(turn.y) * x + Math.sin(turn.y) * z;
      const worldZ = at.z - Math.sin(turn.y) * x + Math.cos(turn.y) * z;
      positions.setY(vertex, surfaceHeightAt(worldX, worldZ) - at.y);
    }
    geometry.computeVertexNormals();
  }
  builder.add(materials.pad, top, placed(at.x, at.y + 0.012, at.z, turn));
  builder.add(materials.padUnder, under, placed(at.x, at.y + 0.006, at.z, turn));
  if (flower === null) return;

  const colour = flower === 'white' ? materials.petal : materials.petalPink;
  for (let p = 0; p < 7; p++) {
    const petalAngle = (p / 7) * Math.PI * 2;
    builder.add(
      colour,
      new THREE.ConeGeometry(0.045, 0.12, 4),
      placed(
        at.x + Math.cos(petalAngle) * 0.04,
        at.y + 0.05,
        at.z + Math.sin(petalAngle) * 0.04,
        { y: -petalAngle, z: -1.0 },
        { x: 1, y: 1, z: 0.45 },
      ).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
    );
  }
  builder.add(
    materials.heart,
    new THREE.IcosahedronGeometry(0.03, 0),
    placed(at.x, at.y + 0.06, at.z),
  );
}

/**
 * A clump of seven long, flat blades, a few with a cattail: a thin stalk with
 * a brown velvet head. `random` supplies the spread and lean, so the same
 * seed grows the same clump.
 */
export function addReedClump(
  builder: ModelBuilder,
  materials: WaterPlantMaterials,
  random: () => number,
  at: { x: number; y: number; z: number },
  bladeCount = 7,
): void {
  const cattail = polyforkCattail.parts();
  const tufts = polyforkReedTufts();
  if (cattail !== undefined && tufts !== undefined) {
    // About one tall cattail and one short tuft for every four plain blades.
    const plants = Math.max(2, Math.round(bladeCount / 2));
    for (let i = 0; i < plants; i++) {
      const spin = random() * Math.PI * 2;
      const spread = random() * 0.22;
      const turn = { y: random() * Math.PI * 2 };
      const where = [at.x + Math.cos(spin) * spread, at.y, at.z + Math.sin(spin) * spread] as const;
      const pieces =
        i % 2 === 0 ? [...cattail.values()] : [tufts[Math.floor(random() * tufts.length)]!];
      // Cattails a little either side of 1.2 m; the half-metre tufts grown to blade height.
      const scale = i % 2 === 0 ? 0.8 + random() * 0.35 : 1.3 + random() * 0.4;
      for (const geometry of pieces) {
        builder.add(
          materials.polyforkReed,
          reedWeights(geometry.clone()),
          placed(...where, turn, scale),
        );
      }
    }
    return;
  }
  for (let i = 0; i < bladeCount; i++) {
    const spin = random() * Math.PI * 2;
    const spread = random() * 0.22;
    const height = 0.7 + random() * 0.6;
    const lean = { x: (random() - 0.5) * 0.3, z: (random() - 0.5) * 0.3 };
    const bx = at.x + Math.cos(spin) * spread;
    const bz = at.z + Math.sin(spin) * spread;
    const blade = new THREE.ConeGeometry(0.035, height, 4);
    blade.translate(0, height / 2, 0);
    builder.add(
      random() < 0.3 ? materials.reedPale : materials.reed,
      reedWeights(blade),
      placed(bx, at.y, bz, { ...lean, y: spin }, { x: 1, y: 1, z: 0.25 }),
    );
    if (i % 3 === 0) {
      const stalkHeight = height + 0.25;
      const stalk = new THREE.CylinderGeometry(0.008, 0.012, stalkHeight, 4);
      stalk.translate(0, stalkHeight / 2, 0);
      const stalkMatrix = placed(bx + 0.03, at.y, bz, lean);
      builder.add(materials.reed, reedWeights(stalk), stalkMatrix);
      const head = new THREE.CapsuleGeometry(0.028, 0.14, 2, 6);
      head.translate(0, stalkHeight - 0.12, 0);
      builder.add(materials.cattail, reedWeights(head), stalkMatrix);
    }
  }
}
