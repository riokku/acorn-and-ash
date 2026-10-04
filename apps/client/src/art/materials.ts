import * as THREE from 'three/webgpu';
import {
  attribute,
  color,
  float,
  max,
  mix,
  normalWorld,
  positionWorld,
  sin,
  smoothstep,
  texture,
  time,
  triplanarTexture,
  vec2,
  vec3,
} from 'three/tsl';

import type { WaterCircle } from '@acorn/shared';

import { seasonUniforms } from './season-uniforms';
import { artTexture, type ArtTextureId } from './textures';

/**
 * The materials that wear the painted textures (see decision 0053).
 *
 * Most things are an ordinary material with a painted texture on it, shared
 * between everything that looks alike, so a hundred fence pieces are one
 * material. The ground and the pond get small shaders of their own, kept
 * cheap on purpose: a handful of texture reads a pixel, which even a laptop's
 * built-in graphics shrugs off.
 */

/** How many metres one copy of each ground texture covers. */
const GRASS_TILE = 3.2;
const FLOOR_TILE = 2.8;

/**
 * The whole visible ground: painted lawn grass blending into painted forest
 * floor wherever the mesh's own `floor` attribute says, all of it tinted by
 * its `tint` attribute (see ground-shading.ts).
 */
export function createGroundMaterial(): THREE.MeshStandardNodeMaterial {
  const grass = artTexture('grass');
  const floor = artTexture('forestFloor');
  const ground = positionWorld.xz;

  // Two copies of each texture, one turned and a little smaller, blended in
  // soft winding patches across the ground: the eye never finds a straight
  // run of repeats to latch onto, and neither copy is blown up so large that
  // its flowers and leaves turn into blurry blobs.
  const turned = vec2(
    ground.x.mul(0.8).sub(ground.y.mul(0.6)),
    ground.x.mul(0.6).add(ground.y.mul(0.8)),
  );
  const patches = smoothstep(
    -0.35,
    0.35,
    sin(ground.x.mul(0.23).add(sin(ground.y.mul(0.19)).mul(1.7))).mul(
      sin(ground.y.mul(0.21).add(sin(ground.x.mul(0.17)).mul(1.5))),
    ),
  );
  const grassNear = texture(grass, ground.div(GRASS_TILE));
  const grassTurned = texture(grass, turned.div(GRASS_TILE * 0.87).add(vec2(0.31, 0.57)));
  const grassColour = mix(grassNear, grassTurned, patches).rgb;
  const floorNear = texture(floor, ground.div(FLOOR_TILE));
  const floorTurned = texture(floor, turned.div(FLOOR_TILE * 0.87).add(vec2(0.13, 0.77)));
  const floorColour = mix(floorNear, floorTurned, patches).rgb;

  // Where grass gives way to earth, the brighter blades hold on longest and
  // the darker gaps between them go first, so the edge is ragged, the way a
  // worn patch really looks, rather than a smooth fade.
  const blades = grassNear.g.sub(0.35).mul(0.9);
  const amount = attribute('floor', 'float');
  const bare = smoothstep(0.3, 0.7, amount.sub(blades));

  // The season recolours the whole ground, and in winter snow covers it:
  // thinner under the trees, where the bare forest floor is, and keeping the
  // soft patches of light and shade, so snow is not a flat white sheet.
  const shaded = mix(grassColour, floorColour, bare).mul(attribute('tint', 'vec3'));
  const seasonal = shaded.mul(seasonUniforms.ground);
  const snowCover = seasonUniforms.snow.mul(float(1).sub(bare.mul(0.45))).mul(0.88);
  const snow = vec3(0.9, 0.93, 0.98).mul(attribute('tint', 'vec3'));

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  material.colorNode = mix(seasonal, snow, snowCover);
  material.name = 'painted-ground';
  return material;
}

/**
 * How far inside the pond a spot is, in metres - negative outside it -
 * across however many circles the pond is made of. Circles overlap, so this
 * takes the deepest, and the shore is one smooth line all the way round.
 */
function depthInPond(circles: readonly WaterCircle[]) {
  let deepest = null;
  for (const circle of circles) {
    const inside = float(circle.radius).sub(
      positionWorld.xz.sub(vec2(circle.x, circle.z)).length(),
    );
    deepest = deepest === null ? inside : max(deepest, inside);
  }
  return deepest ?? float(-1);
}

/**
 * The pond's surface: clear and green-tinted in the shallows, deeper blue in
 * the middle, two layers of painted ripples drifting past each other to
 * catch the light, and a pale line where it laps at the bank.
 */
export function createWaterMaterial(
  circles: readonly WaterCircle[],
): THREE.MeshStandardNodeMaterial {
  const ripples = artTexture('ripples');
  const inside = depthInPond(circles);
  const depth = smoothstep(0, 2.4, inside);

  const drift = time;
  const first = texture(
    ripples,
    positionWorld.xz.mul(0.32).add(vec2(drift.mul(0.021), drift.mul(0.013))),
  ).r;
  const second = texture(
    ripples,
    positionWorld.xz.mul(0.19).add(vec2(drift.mul(-0.015), drift.mul(0.019))),
  ).r;
  // Soft, broad glints rather than sharp lines: where the two layers of
  // ripples happen to line up, the surface catches a little more sky.
  const glint = smoothstep(0.25, 0.95, first.add(second).mul(0.5));

  const shallows = color(0x4f9a8e);
  const deep = color(0x2b5e7a);
  let surface = mix(shallows, deep, depth);
  surface = surface.add(color(0xd9f1ff).mul(glint).mul(0.16));
  const lapping = smoothstep(0.28, 0.02, inside.add(first.mul(0.08)));
  surface = mix(surface, color(0xdfeee6), lapping.mul(0.55));

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.12, metalness: 0 });
  material.colorNode = surface;
  material.name = 'painted-water';
  return material;
}

/**
 * The muddy bank round the pond: dark and wet at the water's edge, drying
 * out and fading softly into the grass further back, instead of stopping at
 * a hard ring.
 */
export function createBankMaterial(
  circles: readonly WaterCircle[],
  width: number,
): THREE.MeshStandardNodeMaterial {
  const floor = artTexture('forestFloor');
  const outside = depthInPond(circles).negate();
  const mud = texture(floor, positionWorld.xz.div(1.9)).rgb;
  const wet = smoothstep(width * 0.6, 0, outside);
  const colour = mud.mul(mix(float(1.15), float(0.78), wet)).mul(color(0xf2ead8));

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  material.colorNode = colour;
  material.opacityNode = smoothstep(width, width * 0.45, outside);
  material.transparent = true;
  material.depthWrite = false;
  material.name = 'painted-bank';
  return material;
}

/**
 * Painted stone for a rock model that came with no texture of its own,
 * projected from above and both sides at once (triplanar) since the model
 * has no texture layout to follow. `moss` from 0 to 1 says how much moss
 * grows over the top of it, thickest on the flattest, most upward faces.
 */
export function createRockMaterial(options: {
  readonly tint: number;
  readonly moss: number;
}): THREE.MeshStandardNodeMaterial {
  const stoneTexture = texture(artTexture('stone'));
  const stone = triplanarTexture(
    stoneTexture,
    null,
    null,
    float(1 / 1.6),
    positionWorld,
    normalWorld,
  ).rgb.mul(color(options.tint));

  const grass = triplanarTexture(
    texture(artTexture('grass')),
    null,
    null,
    float(1 / 1.2),
    positionWorld,
    normalWorld,
  ).rgb;
  const mossColour = grass.mul(color(0xb4c27a));
  // The stone's own darker blotches decide where moss takes hold first, so
  // its edge follows the rock rather than a clean line.
  const blotch = stone.g.mul(2).sub(0.6);
  const mossAmount = smoothstep(0.3, 0.75, normalWorld.y.sub(blotch.mul(0.35))).mul(options.moss);

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
  material.colorNode = mix(stone, mossColour, mossAmount);
  material.name = 'painted-rock';
  return material;
}

/**
 * A painted texture projected onto a model from above and both sides at
 * once (triplanar), for a model that came with no texture layout of its own
 * to follow - `tile` metres a copy, multiplied by `tint`.
 */
export function createTriplanarMaterial(
  id: ArtTextureId,
  tint: number,
  tile: number,
  roughness = 0.95,
): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ roughness, metalness: 0 });
  material.colorNode = triplanarTexture(
    texture(artTexture(id)),
    null,
    null,
    float(1 / tile),
    positionWorld,
    normalWorld,
  ).rgb.mul(color(tint));
  material.name = `painted-triplanar-${id}`;
  return material;
}

/**
 * Leaves drawn as crisp cut-outs rather than see-through blends: no dark
 * fringe where a texture's clear gaps would otherwise show, no flicker where
 * two leafy trees overlap, cheaper to draw, and shadows the shape of the
 * leaves. Softened at the edges wherever the renderer smooths edges anyway.
 */
export function makeLeavesCutOut(material: THREE.Material): void {
  material.transparent = false;
  material.alphaTest = 0.5;
  material.alphaToCoverage = true;
  material.depthWrite = true;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
}

/** What makes one painted material different from another that uses the same texture. */
export interface PaintedOptions {
  /** Multiplies the texture, as 0xRRGGBB. White leaves it as painted. */
  readonly tint?: number;
  readonly roughness?: number;
  /** Colour straight from each corner of the mesh, multiplied in too (for soft shading baked into a model). */
  readonly vertexColors?: boolean;
  /** Faceted, one flat shade per face, the way the low-poly pack models are lit. */
  readonly flatShading?: boolean;
  readonly side?: THREE.Side;
}

const painted = new Map<string, THREE.MeshStandardMaterial>();

/**
 * A plain material wearing one of the painted textures, shared by everything
 * that asks for the same one - so whoever uses it must never dispose of it.
 */
export function paintedMaterial(
  id: ArtTextureId,
  options: PaintedOptions = {},
): THREE.MeshStandardMaterial {
  const tint = options.tint ?? 0xffffff;
  const roughness = options.roughness ?? 0.9;
  const vertexColors = options.vertexColors ?? false;
  const side = options.side ?? THREE.FrontSide;
  const flatShading = options.flatShading ?? false;
  const key = `${id}:${tint}:${roughness}:${vertexColors}:${side}:${flatShading}`;
  const existing = painted.get(key);
  if (existing !== undefined) return existing;

  const material = new THREE.MeshStandardMaterial({
    map: artTexture(id),
    color: tint,
    roughness,
    metalness: 0,
    vertexColors,
    side,
    flatShading,
  });
  material.name = `painted-${id}`;
  painted.set(key, material);
  return material;
}

const plain = new Map<string, THREE.MeshStandardMaterial>();

/** A shared plain colour, for small parts with no texture worth painting: eyes, a glass pane. */
export function plainMaterial(
  hex: number,
  options: {
    roughness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    flatShading?: boolean;
  } = {},
): THREE.MeshStandardMaterial {
  const key = `${hex}:${options.roughness ?? 0.8}:${options.emissive ?? 0}:${options.emissiveIntensity ?? 0}:${options.flatShading ?? false}`;
  const existing = plain.get(key);
  if (existing !== undefined) return existing;
  const material = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: options.roughness ?? 0.8,
    metalness: 0,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    flatShading: options.flatShading ?? false,
  });
  plain.set(key, material);
  return material;
}
