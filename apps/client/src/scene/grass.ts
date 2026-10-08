import * as THREE from 'three/webgpu';
import {
  attribute,
  cos,
  float,
  mix,
  positionLocal,
  sin,
  smoothstep,
  uniform,
  vec3,
} from 'three/tsl';
import {
  LAKE,
  STREAM,
  nearStream,
  PLAYABLE_HALF_EXTENT,
  SPAWN_POSITION,
  buildableFootprint,
  footprintGap,
  lakeDepthAt,
  roundFootprint,
  type BuiltPropView,
  type Clearing,
  type Terrain,
  type Wilderness,
} from '@acorn/shared';
import { createGroundShader } from '../art/ground-shading';
import { seasonUniforms } from '../art/season-uniforms';
import { seededRandom, worldFbm } from '../art/noise';

const TILE = 12;
/** Past this far from you a clump has shrunk to nothing. */
const REACH = 32;
/** The grass fades to nothing over this last stretch before REACH. */
const FADE_BAND = 12;
/** How far you walk before the grass is laid out again around you. */
const REBUILD_DISTANCE = 4;
/**
 * Clumps are laid out this far out. The fade is measured from where you stand
 * now, not from where the grass was last laid out, so what you could see after
 * walking REBUILD_DISTANCE further has to be in place already - otherwise the
 * clumps just past the old edge pop in half-grown, a ring of them at every step.
 */
const LAYOUT_REACH = REACH + REBUILD_DISTANCE + 1;
const MAX_CLUMPS = 24_000;
/** The tallest a clump is ever stretched, as a multiple of its blades' own height. */
const MAX_CLUMP_SIZE = 1.8;

export interface GrassScene {
  readonly mesh: THREE.InstancedMesh;
  setDensity(value: number): void;
  setBuildings(buildings: readonly BuiltPropView[]): void;
  update(
    deltaSeconds: number,
    position: { x: number; z: number },
    reducedMotion: boolean,
    wind?: number,
  ): void;
  dispose(): void;
}

/** Nearby, seeded clumps. A single draw call; all blade bending happens on the GPU. */
export function createGrass(
  terrain: Terrain,
  clearing: Clearing,
  wilderness: Wilderness,
  flattenedSpots: readonly { readonly x: number; readonly z: number }[] = [],
): GrassScene {
  const spoor = new Map<string, (typeof flattenedSpots)[number][]>();
  for (const spot of flattenedSpots)
    for (let x = Math.floor((spot.x - 0.5) / 8); x <= Math.floor((spot.x + 0.5) / 8); x++)
      for (let z = Math.floor((spot.z - 0.5) / 8); z <= Math.floor((spot.z + 0.5) / 8); z++) {
        const key = `${x},${z}`;
        const bucket = spoor.get(key);
        if (bucket === undefined) spoor.set(key, [spot]);
        else bucket.push(spot);
      }
  const shader = createGroundShader({
    water: clearing.water,
    lake: LAKE,
    stream: STREAM,
    props: [...clearing.props, ...wilderness.props],
  });
  const geometry = bladeClump();
  const roots = new Float32Array(MAX_CLUMPS * 3);
  const looks = new Float32Array(MAX_CLUMPS * 4);
  geometry.setAttribute('grassRoot', new THREE.InstancedBufferAttribute(roots, 3));
  geometry.setAttribute('grassLook', new THREE.InstancedBufferAttribute(looks, 4));
  const clock = uniform(0);
  const windStrength = uniform(1);
  const viewer = uniform(new THREE.Vector3());
  // Where the clump is rooted in the ground, and what is particular to it: how
  // dry it looks, which way and how far it leans, and how much it sways.
  const root = attribute('grassRoot', 'vec3');
  const look = attribute('grassLook', 'vec4');
  const tone = look.x;
  const leanAmount = look.y;
  const leanAngle = look.z;
  const sway = look.w;
  // How far up its own blade a point is, and how light or dark that blade is.
  const tip = attribute('grassTip', 'float');
  const bladeTone = attribute('grassBlade', 'float');
  const gust = sin(root.x.mul(0.11).add(root.z.mul(0.08)).sub(clock.mul(0.9)))
    .mul(0.5)
    .add(0.5);
  const flutter = sin(root.x.mul(0.7).add(root.z.mul(0.4)).add(clock.mul(2.3))).mul(0.035);
  const tipSquared = tip.mul(tip);
  const bend = gust.mul(0.13).add(0.035).add(flutter).mul(tipSquared).mul(windStrength).mul(sway);
  const lean = vec3(cos(leanAngle), 0, sin(leanAngle)).mul(leanAmount.mul(tipSquared));
  const distance = root.xz.sub(viewer.xz).length();
  const fade = float(1).sub(smoothstep(REACH - FADE_BAND, REACH, distance));
  const material = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 1 });
  // By the time this runs three.js has already moved every point to where its
  // clump stands in the world, so what is shrunk is the point's distance from
  // the clump's root. Shrinking the world height instead would squash grass
  // towards sea level: clumps on low ground would hover above it and ones on a
  // hill would sink out of sight, then drop or pop into place as you came near.
  // The wind goes on in the world's own direction whichever way a clump faces.
  const offset = positionLocal.sub(root);
  material.positionNode = root
    .add(offset.mul(vec3(1, fade.mul(float(1).sub(seasonUniforms.blizzard.mul(0.7))), 1)))
    .add(lean.mul(fade))
    .add(vec3(bend.mul(fade), 0, bend.mul(0.45).mul(fade)));
  const shade = sin(root.x.mul(0.16).add(root.z.mul(0.21)))
    .mul(0.5)
    .add(0.5);
  // Tinted by the season, and frosted over in winter: pale tufts poking out of
  // the snow rather than green ones. Each clump runs from lush to dry, and each
  // blade is a little lighter or darker than the next.
  const tint = mix(vec3(0.9, 1.05, 0.88), vec3(1.2, 1.02, 0.62), tone);
  const bladeColour = mix(
    vec3(0.14, 0.25, 0.08),
    vec3(0.43, 0.57, 0.22),
    tip.mul(0.6).add(shade.mul(0.25)),
  )
    .mul(tint)
    .mul(bladeTone.mul(0.24).add(0.88))
    .mul(seasonUniforms.blades);
  material.colorNode = mix(bladeColour, vec3(0.82, 0.87, 0.9), seasonUniforms.snow.mul(0.8));
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_CLUMPS);
  mesh.name = 'wind-grass';
  mesh.count = 0;
  mesh.frustumCulled = false; // Shader bending exceeds the undeformed bounds.
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const spin = new THREE.Quaternion();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const placement = new THREE.Vector3();
  const stretch = new THREE.Vector3();
  let density = 0.75;
  let buildings: readonly BuiltPropView[] = [];
  let changed = true;
  let lastX = Infinity,
    lastZ = Infinity;
  let elapsed = 0;
  interface Clump {
    x: number;
    y: number;
    z: number;
    /** How tall, as a multiple of the blades' own height. */
    size: number;
    width: number;
    depth: number;
    /** Which way it faces, so no two tufts line up. */
    yaw: number;
    /** 0 is lush and 1 is dry, golden and pale. */
    tone: number;
    /** How far, and which way, it leans over at the tips even with no wind. */
    lean: number;
    leanAngle: number;
    /** How much the wind moves it: tall tufts move more. */
    sway: number;
    threshold: number;
  }
  const tiles = new Map<string, Clump[]>();
  const tileAt = (tx: number, tz: number): Clump[] => {
    const key = `${tx},${tz}`;
    const cached = tiles.get(key);
    if (cached !== undefined) return cached;
    const clumps: Clump[] = [];
    const random = seededRandom(Math.imul(tx, 73856093) ^ Math.imul(tz, 19349663) ^ 5279);
    for (let sample = 0; sample < 900; sample++) {
      const x = (tx + random()) * TILE,
        z = (tz + random()) * TILE;
      const chance = random(),
        height = random(),
        width = 0.65 + random() * 0.7,
        depth = 0.65 + random() * 0.7,
        tallRoll = random(),
        yaw = random() * Math.PI * 2,
        looseness = random(),
        leanRoll = random(),
        leanAngle = random() * Math.PI * 2;
      if (Math.abs(x) > PLAYABLE_HALF_EXTENT || Math.abs(z) > PLAYABLE_HALF_EXTENT) continue;
      if (
        Math.hypot(x - SPAWN_POSITION.x, z - SPAWN_POSITION.z) < 2.5 ||
        clearing.water.some(
          (water) => Math.hypot(x - water.x, z - water.z) < water.radius + 0.35,
        ) ||
        // The lake's own shore, which on an island is the island's beach.
        lakeDepthAt(LAKE, x, z) > -0.35 ||
        // The stream's water and its bed.
        nearStream(STREAM, x, z, 0.2)
      )
        continue;
      const y = terrain.heightAt(x, z);
      const slope = Math.hypot(
        terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z),
        terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5),
      );
      const shade = shader.shadeAt(x, z, slope, y);
      const patch = Math.max(0.15, 0.6 + worldFbm(x * 0.15, z * 0.15, 2, 816) * 0.8);
      const threshold = chance / ((1 - shade.floor) * patch);
      if (threshold > 1 || !Number.isFinite(threshold)) continue;
      // Mostly short tufts, some middling, a few tall ones; and the whole
      // meadow runs taller in some parts than in others.
      const meadow = Math.min(
        1,
        Math.max(0, 0.5 + worldFbm(x * 0.05 + 40, z * 0.05 - 20, 2, 4421)),
      );
      const tall = tallRoll < 0.05 ? 1.25 + (tallRoll / 0.05) * 0.25 : 1;
      const size = Math.min(
        MAX_CLUMP_SIZE,
        (0.62 + height * height * 0.75) * (0.85 + meadow * 0.3) * tall,
      );
      // Whole patches go dry and golden; within them, clumps vary a little.
      const dryness = worldFbm(x * 0.04 - 11, z * 0.04 + 7, 2, 977);
      const tone = Math.min(1, Math.max(0, 0.4 + dryness * 0.9 + (looseness - 0.5) * 0.5));
      clumps.push({
        x,
        y,
        z,
        size,
        width,
        depth,
        yaw,
        tone,
        lean: leanRoll * leanRoll * 0.12,
        leanAngle,
        sway: 0.6 + size * 0.5,
        threshold,
      });
    }
    tiles.set(key, clumps);
    return clumps;
  };
  /** The tiles a clump could be taken from when standing at `position` and reaching `reach` out. */
  const tilesAround = (position: { x: number; z: number }, reach: number) => ({
    fromX: Math.floor((position.x - reach) / TILE),
    toX: Math.floor((position.x + reach) / TILE),
    fromZ: Math.floor((position.z - reach) / TILE),
    toZ: Math.floor((position.z + reach) / TILE),
  });
  /**
   * Make the tiles you are about to need before you need them, one per frame.
   * Making seven new ones at once, as laying the grass out would when you
   * cross into a new row, takes several frames' time and shows as a stutter.
   */
  const prepareNextTile = (position: { x: number; z: number }): void => {
    const { fromX, toX, fromZ, toZ } = tilesAround(position, LAYOUT_REACH + REBUILD_DISTANCE);
    let nearest: [number, number] | null = null;
    let nearestDistance = Infinity;
    for (let tx = fromX; tx <= toX; tx++)
      for (let tz = fromZ; tz <= toZ; tz++) {
        if (tiles.has(`${tx},${tz}`)) continue;
        const gap = Math.hypot((tx + 0.5) * TILE - position.x, (tz + 0.5) * TILE - position.z);
        if (gap < nearestDistance) {
          nearestDistance = gap;
          nearest = [tx, tz];
        }
      }
    if (nearest !== null) tileAt(nearest[0], nearest[1]);
  };
  const rebuild = (position: { x: number; z: number }): void => {
    const footprints = buildings.map((prop) =>
      buildableFootprint(prop.kind, prop.x, prop.z, prop.yaw),
    );
    const grid = new Map<string, typeof footprints>();
    for (const footprint of footprints) {
      const reach = footprint.radius + footprint.halfLength + 0.6;
      for (
        let x = Math.floor((footprint.x - reach) / 8);
        x <= Math.floor((footprint.x + reach) / 8);
        x++
      )
        for (
          let z = Math.floor((footprint.z - reach) / 8);
          z <= Math.floor((footprint.z + reach) / 8);
          z++
        ) {
          const key = `${x},${z}`;
          const bucket = grid.get(key);
          if (bucket === undefined) grid.set(key, [footprint]);
          else bucket.push(footprint);
        }
    }
    // A bounded cache prevents walking the whole world from retaining all its grass.
    const keep = tilesAround(position, LAYOUT_REACH + REBUILD_DISTANCE + TILE);
    for (const key of tiles.keys()) {
      const [x, z] = key.split(',').map(Number);
      if (x! < keep.fromX || x! > keep.toX || z! < keep.fromZ || z! > keep.toZ) tiles.delete(key);
    }
    let count = 0;
    const { fromX, toX, fromZ, toZ } = tilesAround(position, LAYOUT_REACH);
    for (let tx = fromX; tx <= toX; tx++)
      for (let tz = fromZ; tz <= toZ; tz++)
        for (const clump of tileAt(tx, tz)) {
          const { x, y, z, size, width, depth, threshold } = clump;
          if (
            count >= MAX_CLUMPS ||
            threshold > density ||
            Math.hypot(x - position.x, z - position.z) > LAYOUT_REACH
          )
            continue;
          const nearby = grid.get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`) ?? [];
          if (
            nearby.some(
              (footprint) => footprintGap(roundFootprint(x, z, 0.35, 'grass'), footprint) < 0.25,
            )
          )
            continue;
          const trampled =
            spoor
              .get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`)
              ?.some((spot) => Math.hypot(x - spot.x, z - spot.z) < 0.5) ?? false;
          spin.setFromAxisAngle(upAxis, clump.yaw);
          matrix.compose(
            placement.set(x, y - 0.012, z),
            spin,
            stretch.set(width, trampled ? size * 0.05 : size, depth),
          );
          mesh.setMatrixAt(count, matrix);
          roots.set([x, y, z], count * 3);
          looks.set([clump.tone, clump.lean, clump.leanAngle, clump.sway], count * 4);
          count++;
        }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    geometry.getAttribute('grassRoot').needsUpdate = true;
    geometry.getAttribute('grassLook').needsUpdate = true;
    lastX = position.x;
    lastZ = position.z;
    changed = false;
  };
  return {
    mesh,
    setDensity(value) {
      density = Math.min(1, Math.max(0, value));
      changed = true;
      mesh.visible = density > 0;
    },
    setBuildings(next) {
      buildings = next;
      changed = true;
    },
    update(deltaSeconds, position, reducedMotion, wind = 0.15) {
      windStrength.value += (1 + wind - windStrength.value) * Math.min(1, deltaSeconds * 0.5);
      if (!reducedMotion) elapsed += deltaSeconds;
      clock.value = elapsed;
      viewer.value.set(position.x, 0, position.z);
      if (density <= 0) return;
      if (changed || Math.hypot(position.x - lastX, position.z - lastZ) >= REBUILD_DISTANCE)
        rebuild(position);
      else prepareNextTile(position);
    },
    dispose() {
      tiles.clear();
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

/** How tall the tallest blade of a clump stands, before the clump is stretched. */
const BLADE_HEIGHT = 0.38;

/**
 * Six pointed, curved blades, with enough joints for their tips to bend. No two
 * are alike - height, width, how far each curls over and how far from the middle
 * it starts all differ - so a clump looks like a tuft rather than a flower.
 * (The same shape every time is made from a fixed seed, so it never changes.)
 *
 * Each point also says how far up its blade it is ('grassTip') and each blade how
 * light or dark it is ('grassBlade'), which the shader colours and bends by.
 */
function bladeClump(): THREE.BufferGeometry {
  const random = seededRandom(1311);
  const positions: number[] = [],
    tips: number[] = [],
    tones: number[] = [],
    indices: number[] = [];
  for (let blade = 0; blade < 6; blade++) {
    const angle = (blade * Math.PI * 2) / 6 + (random() - 0.5) * 0.7;
    const dx = Math.cos(angle),
      dz = Math.sin(angle);
    const outset = 0.03 + random() * 0.06;
    // One blade in the middle runs tallest; the rest fall away from it.
    const height = BLADE_HEIGHT * (blade === 0 ? 1 : 0.6 + random() * 0.4);
    const breadth = 0.05 + random() * 0.04;
    const curl = 0.04 + random() * 0.12;
    const tone = random();
    const base = positions.length / 3;
    for (let level = 0; level < 3; level++) {
      const t = level / 2,
        width = breadth * (1 - t);
      const bend = t * t * curl;
      for (const side of [-1, 1]) {
        positions.push(
          dx * (outset + bend) - dz * width * side,
          t * height,
          dz * (outset + bend) + dx * width * side,
        );
        tips.push(t);
        tones.push(tone);
      }
    }
    for (let level = 0; level < 2; level++) {
      const a = base + level * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('grassTip', new THREE.Float32BufferAttribute(tips, 1));
  geometry.setAttribute('grassBlade', new THREE.Float32BufferAttribute(tones, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
