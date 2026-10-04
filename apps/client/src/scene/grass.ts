import * as THREE from 'three/webgpu';
import { attribute, float, mix, positionLocal, sin, smoothstep, uniform, vec3 } from 'three/tsl';
import {
  PLAYABLE_HALF_EXTENT,
  SPAWN_POSITION,
  buildableFootprint,
  footprintGap,
  roundFootprint,
  type BuiltPropView,
  type Clearing,
  type Terrain,
  type Wilderness,
} from '@acorn/shared';
import { createGroundShader } from '../art/ground-shading';
import { seededRandom, worldFbm } from '../art/noise';

const TILE = 12;
const REACH = 32;
const MAX_CLUMPS = 18_000;

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
    props: [...clearing.props, ...wilderness.props],
  });
  const geometry = bladeClump();
  const roots = new Float32Array(MAX_CLUMPS * 3);
  geometry.setAttribute('grassRoot', new THREE.InstancedBufferAttribute(roots, 3));
  const clock = uniform(0);
  const windStrength = uniform(1);
  const viewer = uniform(new THREE.Vector3());
  const root = attribute('grassRoot', 'vec3');
  const tip = positionLocal.y.div(0.38).clamp(0, 1);
  const gust = sin(root.x.mul(0.11).add(root.z.mul(0.08)).sub(clock.mul(0.9)))
    .mul(0.5)
    .add(0.5);
  const flutter = sin(root.x.mul(0.7).add(root.z.mul(0.4)).add(clock.mul(2.3))).mul(0.035);
  const bend = gust.mul(0.13).add(0.035).add(flutter).mul(tip.mul(tip)).mul(windStrength);
  const distance = root.xz.sub(viewer.xz).length();
  const fade = float(1).sub(smoothstep(REACH - 8, REACH, distance));
  // Instances are deliberately not rotated: wind stays in a common world direction.
  const material = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 1 });
  material.positionNode = positionLocal
    .mul(vec3(1, fade, 1))
    .add(vec3(bend.mul(fade), 0, bend.mul(0.45).mul(fade)));
  const shade = sin(root.x.mul(0.16).add(root.z.mul(0.21)))
    .mul(0.5)
    .add(0.5);
  material.colorNode = mix(
    vec3(0.14, 0.25, 0.08),
    vec3(0.43, 0.57, 0.22),
    tip.mul(0.6).add(shade.mul(0.25)),
  );
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_CLUMPS);
  mesh.name = 'wind-grass';
  mesh.count = 0;
  mesh.frustumCulled = false; // Shader bending exceeds the undeformed bounds.
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
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
    size: number;
    width: number;
    depth: number;
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
        size = 0.6 + random() * 0.65,
        width = 0.7 + random() * 0.6,
        depth = 0.7 + random() * 0.6;
      if (Math.abs(x) > PLAYABLE_HALF_EXTENT || Math.abs(z) > PLAYABLE_HALF_EXTENT) continue;
      if (
        Math.hypot(x - SPAWN_POSITION.x, z - SPAWN_POSITION.z) < 2.5 ||
        clearing.water.some((water) => Math.hypot(x - water.x, z - water.z) < water.radius + 0.35)
      )
        continue;
      const y = terrain.heightAt(x, z);
      const slope = Math.hypot(
        terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z),
        terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5),
      );
      const shade = shader.shadeAt(x, z, slope);
      const patch = Math.max(0.15, 0.6 + worldFbm(x * 0.15, z * 0.15, 2, 816) * 0.8);
      const threshold = chance / ((1 - shade.floor) * patch);
      if (threshold > 1 || !Number.isFinite(threshold)) continue;
      clumps.push({ x, y, z, size, width, depth, threshold });
    }
    tiles.set(key, clumps);
    return clumps;
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
    const cx = Math.floor(position.x / TILE),
      cz = Math.floor(position.z / TILE);
    // A bounded cache prevents walking the whole world from retaining all its grass.
    for (const key of tiles.keys()) {
      const [x, z] = key.split(',').map(Number);
      if (Math.abs(x! - cx) > 4 || Math.abs(z! - cz) > 4) tiles.delete(key);
    }
    let count = 0;
    for (let tx = cx - 3; tx <= cx + 3; tx++)
      for (let tz = cz - 3; tz <= cz + 3; tz++)
        for (const clump of tileAt(tx, tz)) {
          const { x, y, z, size, width, depth, threshold } = clump;
          if (
            count >= MAX_CLUMPS ||
            threshold > density ||
            Math.hypot(x - position.x, z - position.z) > REACH
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
          matrix.makeScale(width, trampled ? size * 0.05 : size, depth);
          matrix.setPosition(x, y - 0.012, z);
          mesh.setMatrixAt(count, matrix);
          roots.set([x, y, z], count * 3);
          count++;
        }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    geometry.getAttribute('grassRoot').needsUpdate = true;
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
      if (density > 0 && (changed || Math.hypot(position.x - lastX, position.z - lastZ) >= 4))
        rebuild(position);
    },
    dispose() {
      tiles.clear();
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

/** Five pointed, curved blades, with enough joints for their tips to bend. */
function bladeClump(): THREE.BufferGeometry {
  const positions: number[] = [],
    indices: number[] = [];
  for (let blade = 0; blade < 5; blade++) {
    const angle = (blade * Math.PI * 2) / 5;
    const dx = Math.cos(angle),
      dz = Math.sin(angle);
    const base = positions.length / 3;
    for (let level = 0; level < 3; level++) {
      const t = level / 2,
        width = 0.07 * (1 - t);
      const bend = t * t * 0.1;
      for (const side of [-1, 1])
        positions.push(
          dx * (0.06 + bend) - dz * width * side,
          t * 0.38,
          dz * (0.06 + bend) + dx * width * side,
        );
    }
    for (let level = 0; level < 2; level++) {
      const a = base + level * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
