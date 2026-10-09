import * as THREE from 'three/webgpu';
import {
  attribute,
  color,
  float,
  max,
  min,
  mix,
  normalWorld,
  positionWorld,
  sin,
  cos,
  exp,
  normalView,
  normalWorldGeometry,
  positionViewDirection,
  cameraViewMatrix,
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
import { waterRippleUniforms } from './water-uniforms';

/** Small surface waves plus expanding, damped waves left by moving feet. */
function reactiveWater(
  material: THREE.MeshStandardNodeMaterial,
  surface: THREE.Node<'vec3'>,
): void {
  let slopeX = cos(positionWorld.x.mul(1.7).add(time.mul(0.65))).mul(0.018);
  let slopeZ = cos(positionWorld.z.mul(2.1).sub(time.mul(0.47))).mul(0.016);
  let crest: THREE.Node<'float'> = float(0);
  for (const ripple of waterRippleUniforms) {
    const offset = positionWorld.xz.sub(ripple.xy);
    const distance = max(offset.length(), 0.001);
    const front = distance.sub(ripple.z.mul(1.6).add(0.18));
    const envelope = exp(front.mul(front).mul(-5))
      .mul(max(float(0), float(1).sub(ripple.z.div(3))))
      .mul(ripple.w);
    const wave = sin(front.mul(9));
    const gradient = cos(front.mul(9)).mul(9).sub(wave.mul(front).mul(10)).mul(envelope).mul(0.035);
    slopeX = slopeX.add(offset.x.div(distance).mul(gradient));
    slopeZ = slopeZ.add(offset.y.div(distance).mul(gradient));
    crest = crest.add(wave.abs().mul(envelope));
  }
  const grazing = float(1).sub(normalView.dot(positionViewDirection).abs()).pow(3);
  material.colorNode = mix(surface, color(0x98bac9), grazing.mul(0.22)).add(
    color(0xd7eef0).mul(min(crest, 1)).mul(0.12),
  );
  material.normalNode = normalWorldGeometry
    .add(vec3(slopeX.negate(), 0, slopeZ.negate()))
    .transformDirection(cameraViewMatrix);
}

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
  // Up the mountain the ground turns to bare grey rock, speckled by the same
  // forest-floor texture so it is not a flat colour (see decision 0114).
  const rockColour = vec3(0.5, 0.48, 0.45).mul(floorNear.r.mul(0.9).add(0.55));
  const rocky = mix(shaded, rockColour.mul(attribute('tint', 'vec3')), attribute('rock', 'float'));
  const seasonal = rocky.mul(seasonUniforms.ground);
  const winterSnow = seasonUniforms.snow
    .mul(float(1).sub(bare.mul(float(0.45).mul(float(1).sub(seasonUniforms.blizzard)))))
    .mul(0.88);
  // The mountain tops keep their snow in every season.
  const snowCover = max(winterSnow, attribute('snow', 'float').mul(0.95));
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

/** How a body of water differs from the little pond: a lake is deeper, bluer and has broader ripples. */
export interface WaterLook {
  /** Surface vertices carry the river current and its gradual fade into still water. */
  readonly riverFlow?: boolean;
  /** Adjoining water that interrupts this surface's shore, such as a river mouth. */
  readonly shoreConnections?: readonly WaterCircle[];
  /** Circles that are dry land inside the water: islands. The shore runs round them too. */
  readonly islands?: readonly WaterCircle[];
  /** How far from the shore the water reaches its deepest colour, in metres. */
  readonly deepAt?: number;
  /** The colour of the deepest water. */
  readonly deep?: number;
  /** How much bigger the ripples are than the pond's: 1 is the pond's. */
  readonly rippleSize?: number;
}

/**
 * The pond's surface: clear and green-tinted in the shallows, deeper blue in
 * the middle, two layers of painted ripples drifting past each other to
 * catch the light, and a pale line where it laps at the bank. The lake uses
 * the same, with islands cut out of it and its own depth and colour.
 */
function stillWaterSurface(circles: readonly WaterCircle[], look: WaterLook = {}) {
  const ripples = artTexture('ripples');
  const { islands = [], deepAt = 2.4, deep: deepColour = 0x2b5e7a, rippleSize = 1 } = look;
  const outline = look.shoreConnections?.length
    ? max(depthInPond(circles), depthInPond(look.shoreConnections))
    : depthInPond(circles);
  // The shore runs round an island as well as round the bank, whichever is nearer.
  const inside = islands.length === 0 ? outline : min(outline, depthInPond(islands).negate());
  const depth = smoothstep(0, deepAt, inside);

  const drift = time;
  const flow = look.riverFlow ? attribute('waterFlow', 'vec2') : vec2(0, 0);
  const share = look.riverFlow ? attribute('waterFlowShare', 'float') : float(0);
  const firstDrift = mix(vec2(0.021, 0.013), flow.mul(-0.088), share);
  const secondDrift = mix(vec2(-0.015, 0.019), flow.mul(-0.137), share);
  const first = texture(
    ripples,
    positionWorld.xz.mul(0.32 / rippleSize).add(firstDrift.mul(drift)),
  ).r;
  const second = texture(
    ripples,
    positionWorld.xz.mul(0.19 / rippleSize).add(secondDrift.mul(drift)),
  ).r;
  // Soft, broad glints rather than sharp lines: where the two layers of
  // ripples happen to line up, the surface catches a little more sky.
  const glint = smoothstep(0.25, 0.95, first.add(second).mul(0.5));

  const shallows = color(0x4f9a8e);
  const deep = color(deepColour);
  let surface = mix(shallows, deep, depth);
  surface = surface.add(color(0xd9f1ff).mul(glint).mul(0.08));
  const lapping = smoothstep(0.28, 0.02, inside.add(first.mul(0.08)));
  surface = mix(surface, color(0xdfeee6), lapping.mul(0.55));
  return surface;
}

export function createWaterMaterial(
  circles: readonly WaterCircle[],
  look: WaterLook = {},
): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.12, metalness: 0 });
  reactiveWater(material, stillWaterSurface(circles, look));
  material.name = 'painted-water';
  return material;
}

/**
 * The stream's surface: clear and green in the shallows at its edges, bluer
 * down the middle, two layers of ripples running downstream at different
 * speeds, and white foam where it tumbles over a fall and laps at its banks.
 * Each vertex of the ribbon says how far across and along the stream it is
 * (see scene/stream.ts), so the ripples follow the water round every bend.
 */
export function createStreamMaterial(
  sloughs: readonly WaterCircle[] = [],
  shoreConnections: readonly WaterCircle[] = [],
): THREE.MeshStandardNodeMaterial {
  const ripples = artTexture('ripples');
  const across = attribute('streamAcross', 'float');
  const along = attribute('streamAlong', 'float');
  const bank = attribute('streamEdge', 'float');
  // A bank stops being a shore where another body of water joins it.
  const edge = sloughs.length ? bank.mul(smoothstep(1.2, 0, depthInPond(sloughs))) : bank;
  const fall = attribute('streamFall', 'float');
  const pace = attribute('streamPace', 'float');

  const first = texture(
    ripples,
    vec2(across.mul(0.27), along.mul(0.34).sub(time.mul(pace).mul(0.16))),
  ).r;
  const second = texture(
    ripples,
    vec2(across.mul(0.41).add(0.37), along.mul(0.22).sub(time.mul(pace).mul(0.27))),
  ).r;
  const glint = smoothstep(0.25, 0.95, first.add(second).mul(0.5));
  // Over a fall the ripples stretch into long streaks that run downhill.
  const streaks = texture(ripples, vec2(across.mul(1.3), along.mul(0.12).sub(time.mul(0.9)))).r;

  const shallows = color(0x62ad9c);
  const middle = color(0x3b7f93);
  let surface = mix(middle, shallows, smoothstep(0.1, 0.95, edge));
  surface = surface.add(color(0xd9f1ff).mul(glint).mul(0.1));
  const lapping = smoothstep(0.72, 0.98, edge.add(first.mul(0.08)));
  surface = mix(surface, color(0xe4f1ea), lapping.mul(0.5));
  const foam = fall.mul(smoothstep(0.1, 0.7, streaks.mul(0.7).add(0.4)));
  surface = mix(surface, color(0xf4fbff), foam.mul(0.85));
  if (sloughs.length) {
    // Use the slough's exact colours and world-space ripples at the join,
    // easing into them over two metres of river water before the mouth.
    const joined = stillWaterSurface(sloughs, {
      shoreConnections,
      deepAt: 9,
      deep: 0x1f4f73,
      rippleSize: 1.7,
      riverFlow: true,
    });
    surface = mix(surface, joined, smoothstep(-5, 0, depthInPond(sloughs)));
  }

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.14, metalness: 0 });
  reactiveWater(material, surface);
  // Clear at the very edge, so the bank shows through and there is no hard line.
  material.opacityNode = smoothstep(1.02, 0.78, edge);
  material.transparent = true;
  material.depthWrite = false;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.name = 'painted-stream';
  return material;
}

/**
 * The lake's ice in winter (see decision 0095): a pale, slightly glossy sheet,
 * clearer blue where it is thin and frosted white where it has clouded, with
 * no ripples. The same painted ripple texture, read at two scales, is what
 * breaks the colour up.
 */
export function createIceMaterial(): THREE.MeshStandardNodeMaterial {
  const frost = artTexture('ripples');
  const coarse = texture(frost, positionWorld.xz.mul(0.17)).r;
  const fine = texture(frost, positionWorld.xz.mul(0.61)).r;
  const cloud = smoothstep(0.2, 0.9, coarse.mul(0.65).add(fine.mul(0.35)));
  const surface = mix(color(0xa9cfe2), color(0xeaf6fb), cloud);

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0 });
  material.colorNode = surface;
  material.name = 'painted-ice';
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
