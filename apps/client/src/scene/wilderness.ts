import * as THREE from 'three/webgpu';

import {
  LAKE,
  STREAM,
  PLAYABLE_HALF_EXTENT,
  PROP_KINDS,
  choppingRuleFor,
  stumpFor,
  treeAtGeneration,
  treeFallAngle,
  treeFallTimes,
  type Clearing,
  type PlacedProp,
  type Terrain,
  type Wilderness,
} from '@acorn/shared';

import { createGroundShader, type GroundShader } from '../art/ground-shading';
import { createGroundMaterial } from '../art/materials';
import type { TreeAppearance, TreeLanding } from './clearing';
import {
  HIDDEN_INSTANCE,
  type PropPart,
  blockerGeometry,
  createCameraBlockers,
  createPropMeshes,
  placeInstance,
  placeOneInstance,
} from './props';

/** How finely the hills are meshed. Small enough that slopes read as curves, not facets. */
const GROUND_SEGMENT_SIZE = 2.5;
/**
 * How far past the wall the ground still runs, so its edge is never visible:
 * it disappears into the fog long before it stops. Flat out there regardless -
 * `terrain.heightAt` flattens before the wall - so the extra reach costs
 * almost nothing to draw.
 */
const GROUND_FOG_MARGIN = 340;
/** Trees nearer than this are drawn in full detail, and further ones as the simpler distant model. */
const DETAIL_DISTANCE = 80;
/**
 * The camera's idea of what is in the way is built in squares of forest this
 * wide, so a tree coming down only rebuilds its own square (a millisecond or
 * two) rather than the whole forest's (tens of them).
 */
const BLOCKER_CELL = 48;

/** How far a struck tree tips at most, in radians, and how quickly it shivers and settles. */
const TREE_SHAKE_ANGLE = 0.035;
const TREE_SHAKE_SPEED = 34;
const TREE_SHAKE_SETTLE = 7;
const TREE_SHAKE_SECONDS = 0.6;
const tilt = new THREE.Quaternion();

const UNTOUCHED: TreeAppearance = { generation: 0, felled: false };

/** A piece of the ground cut into smaller squares, ready to be drawn in the ground's own paint. */
export interface GroundLattice {
  /** (n + 1) by (n + 1) points, row by row (along z), each x then y then z. */
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly floor: Float32Array;
  readonly rock: Float32Array;
  readonly snow: Float32Array;
  readonly tint: Float32Array;
  readonly bank?: Float32Array;
}

/** What the digging scene needs of the ground: to take a square away and, if it can, to draw it again with a hole. */
export interface GroundPatches {
  readonly origin: number;
  readonly cell: number;
  hide(cellX: number, cellZ: number): void;
  /** The paint the ground wears, so a patch of it matches. Left out where there is no real ground. */
  readonly material?: THREE.Material;
  /** One ground square cut into n by n smaller ones, lying exactly on the ground it replaces. */
  lattice?(cellX: number, cellZ: number, n: number): GroundLattice | null;
}

export interface WildernessScene {
  readonly group: THREE.Group;
  /**
   * What the camera feels in the forest: trunks and rocks merged into one
   * invisible mesh per square of it. The same list is kept up to date, so a
   * trunk that is gone stops being felt and one that grew back is felt again.
   */
  readonly cameraBlockers: readonly THREE.Mesh[];
  /**
   * Put the forest's trees where the server says they are: felled ones as
   * stumps, grown ones back at whatever size this generation of them is.
   */
  setTreeStates(states: ReadonlyMap<number, TreeAppearance>, serverNowMs?: number): void;
  /**
   * The smooth ground, for taking squares of it away where a dug tunnel comes
   * up near the surface (see `scene/digging.ts`): `hide` takes one square.
   */
  readonly ground: GroundPatches;
  /**
   * A blow landing on a tree: it shivers, tipping a little away along
   * `awayX`, `awayZ` - the way the blow was going - and settling back.
   */
  shakeTree(treeId: number, awayX: number, awayZ: number, strength?: number): void;
  /** Trees that have just hit the ground, so something can land with them. */
  drainLandings(): TreeLanding[];
  /**
   * Switch trees between detailed and distant meshes as the player explores,
   * and move anything falling or shaking along.
   */
  update(deltaSeconds: number, position: { x: number; z: number }): void;
  dispose(): void;
}

interface FallingTree extends TreeLanding {
  readonly axis: THREE.Vector3;
  readonly beganAt: number;
  landed: boolean;
}

interface TreeShake {
  readonly axis: THREE.Vector3;
  age: number;
  readonly strength: number;
}

/** Where a standing tree is drawn right now: which meshes, and which instance of them. */
interface TreeSlot {
  parts: PropPart[];
  index: number;
}

/**
 * Build the generated wilderness: one painted ground mesh for the whole
 * visible world, plus the trees and rocks scattered across it.
 *
 * The trees can be chopped down and grow back like the clearing's, so this
 * keeps a little bookkeeping the way the clearing does: which are down, which
 * have grown back at a new size, and which are falling or shivering from a
 * blow right now. Rocks never change. The clearing is handed in too, so the
 * ground knows where its trees and its pond are (see ground-shading.ts) and
 * so regrown sizes can be worked out from the world's seed.
 */
export function buildWildernessScene(
  wilderness: Wilderness,
  terrain: Terrain,
  clearing: Clearing,
): WildernessScene {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  const ground = createGround(
    terrain,
    createGroundShader({
      water: clearing.water,
      lake: LAKE,
      stream: STREAM,
      props: [...clearing.props, ...wilderness.props],
    }),
  );
  group.add(ground.mesh, ground.underground);
  disposables.push(ground);

  const byKind = new Map<string, PlacedProp[]>();
  for (const prop of wilderness.props) {
    const existing = byKind.get(prop.kind);
    if (existing === undefined) byKind.set(prop.kind, [prop]);
    else existing.push(prop);
  }

  /** Where each standing tree is drawn, kept up to date as trees move between near and distant meshes. */
  const slotOf = new Map<number, TreeSlot>();
  const treeById = new Map<number, PlacedProp>();
  const treeDraws: Array<{ props: PlacedProp[]; near: PropPart[]; far: PropPart[] }> = [];
  for (const [kindId, props] of byKind) {
    const kind = PROP_KINDS[kindId as keyof typeof PROP_KINDS];
    const parts = createPropMeshes(kind, props.length, false, terrain);
    for (const part of parts) {
      group.add(part.mesh);
      disposables.push(part);
    }
    props.forEach((prop, index) => placeInstance(parts, index, prop));
    for (const part of parts) part.mesh.instanceMatrix.needsUpdate = true;
    if (kind.shape.family === 'tree') {
      const far = createPropMeshes(kind, props.length, true, terrain);
      for (const part of far) {
        part.mesh.count = 0;
        group.add(part.mesh);
        disposables.push(part);
      }
      treeDraws.push({ props, near: parts, far });
      props.forEach((prop, index) => {
        slotOf.set(prop.id, { parts, index });
        if (choppingRuleFor(kind) !== null) treeById.set(prop.id, prop);
      });
    }
  }

  // Stumps wait in one set of meshes, packed down to however many trees are
  // down at the moment.
  const stumpParts = createPropMeshes(PROP_KINDS.stump, Math.max(1, treeById.size), false, terrain);
  for (const part of stumpParts) {
    part.mesh.count = 0;
    group.add(part.mesh);
    disposables.push(part);
  }

  // The camera feels the forest in squares, each its own mesh.
  const cellKey = (prop: PlacedProp): string =>
    `${Math.floor(prop.x / BLOCKER_CELL)},${Math.floor(prop.z / BLOCKER_CELL)}`;
  const propsInCell = new Map<string, PlacedProp[]>();
  for (const prop of wilderness.props) {
    const key = cellKey(prop);
    const existing = propsInCell.get(key);
    if (existing === undefined) propsInCell.set(key, [prop]);
    else existing.push(prop);
  }
  const blockerMeshes = new Map<string, THREE.Mesh>();
  const cameraBlockers: THREE.Mesh[] = [];

  /** What is drawn right now, so nothing is rebuilt that has not changed. */
  const drawn = new Map<number, TreeAppearance>();
  const felled = new Set<number>();
  /** Standing trees that have grown back at a size of their own. */
  const regrown = new Map<number, PlacedProp>();
  const shaking = new Map<number, TreeShake>();
  const falling = new Map<number, FallingTree>();
  const landings: TreeLanding[] = [];

  /** The tree as it stands now: the one the seed laid out, or what has grown there since. */
  const standingTree = (tree: PlacedProp): PlacedProp => regrown.get(tree.id) ?? tree;

  const rebuildCell = (key: string): void => {
    const old = blockerMeshes.get(key);
    if (old !== undefined) {
      group.remove(old);
      old.geometry.disposeBoundsTree?.();
      old.geometry.dispose();
    }
    const here = propsInCell.get(key) ?? [];
    const mesh = createCameraBlockers(
      here.map((prop) => {
        const now = standingTree(prop);
        return blockerGeometry(
          PROP_KINDS[felled.has(prop.id) ? 'stump' : now.kind],
          felled.has(prop.id) ? stumpFor(now) : now,
        );
      }),
    );
    // Never drawn: it exists so the camera can feel the trees.
    mesh.visible = false;
    group.add(mesh);
    blockerMeshes.set(key, mesh);
  };
  const refreshCameraBlockers = (): void => {
    cameraBlockers.length = 0;
    cameraBlockers.push(...blockerMeshes.values());
  };
  for (const key of propsInCell.keys()) rebuildCell(key);
  refreshCameraBlockers();

  /** Whether something changed that the near and distant meshes have not caught up with. */
  let dirty = false;
  let sinceDetailUpdate = 1;
  let lastX = Number.POSITIVE_INFINITY,
    lastZ = Number.POSITIVE_INFINITY;

  /** Sort every standing tree into the detailed or distant meshes by how far it is. */
  const repack = (position: { x: number; z: number }): void => {
    for (const draw of treeDraws) {
      let near = 0,
        far = 0;
      for (const prop of draw.props) {
        // Down, and finished falling: only its stump is left.
        if (felled.has(prop.id) && !falling.has(prop.id)) continue;
        const shown = standingTree(prop);
        const isNear = Math.hypot(prop.x - position.x, prop.z - position.z) < DETAIL_DISTANCE;
        const parts = isNear ? draw.near : draw.far;
        const index = isNear ? near++ : far++;
        placeInstance(parts, index, shown);
        const slot = slotOf.get(prop.id);
        if (slot !== undefined) {
          slot.parts = parts;
          slot.index = index;
        }
      }
      for (const part of draw.near) {
        part.mesh.count = near;
        part.mesh.instanceMatrix.needsUpdate = true;
        part.mesh.computeBoundingSphere();
      }
      for (const part of draw.far) {
        part.mesh.count = far;
        part.mesh.instanceMatrix.needsUpdate = true;
        part.mesh.computeBoundingSphere();
      }
    }
  };

  /** Lay the stumps of every tree that is down, packed from the first instance. */
  const placeStumps = (): void => {
    let count = 0;
    for (const id of felled) {
      const tree = treeById.get(id);
      if (tree === undefined) continue;
      const grown = treeAtGeneration(clearing.seed, tree, drawn.get(id)?.generation ?? 0);
      placeInstance(stumpParts, count++, stumpFor(grown));
    }
    for (const part of stumpParts) {
      part.mesh.count = count;
      part.mesh.instanceMatrix.needsUpdate = true;
      part.mesh.computeBoundingSphere();
    }
  };

  const drawFall = (treeId: number, fall: FallingTree): void => {
    const slot = slotOf.get(treeId);
    const age = Math.max(0, (performance.now() - fall.beganAt) / 1000);
    const timing = treeFallTimes(fall.tree);
    const done = age >= timing.break;
    if (!fall.landed && age >= timing.fall) {
      fall.landed = true;
      // A resumed background tab must not play impacts that happened long ago.
      if (age < timing.break + 0.15) landings.push({ tree: fall.tree, yaw: fall.yaw });
    }
    if (slot !== undefined) {
      const rotation = tilt.setFromAxisAngle(fall.axis, treeFallAngle(age, timing.fall));
      for (const part of slot.parts) {
        if (done) part.mesh.setMatrixAt(slot.index, HIDDEN_INSTANCE);
        else placeOneInstance(part, slot.index, fall.tree, rotation);
        part.mesh.instanceMatrix.needsUpdate = true;
        // A crown can now move beyond the bounds of its standing instances.
        part.mesh.boundingSphere = null;
      }
    }
    if (done) {
      falling.delete(treeId);
      // Its slot is given up at the next sort.
      dirty = true;
    }
  };

  /** Draw a standing tree tipped over by `tipped` about its own foot. */
  const tipTree = (treeId: number, tipped: THREE.Quaternion): void => {
    const tree = treeById.get(treeId);
    const slot = slotOf.get(treeId);
    if (tree === undefined || slot === undefined || felled.has(treeId)) return;
    const now = standingTree(tree);
    for (const part of slot.parts) {
      placeOneInstance(part, slot.index, now, tipped);
      part.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    ground,
    group,
    cameraBlockers,
    setTreeStates: (states, serverNowMs = Date.now()) => {
      const touchedCells = new Set<string>();
      let stumpsChanged = false;

      for (const tree of treeById.values()) {
        const want = states.get(tree.id) ?? UNTOUCHED;
        const have = drawn.get(tree.id) ?? UNTOUCHED;
        if (want.felled === have.felled && want.generation === have.generation) continue;

        shaking.delete(tree.id);
        falling.delete(tree.id);
        const grown = treeAtGeneration(clearing.seed, tree, want.generation);
        if (want.generation > 0) regrown.set(tree.id, grown);
        else regrown.delete(tree.id);
        if (want.felled) felled.add(tree.id);
        else felled.delete(tree.id);
        drawn.set(tree.id, want);
        touchedCells.add(cellKey(tree));
        stumpsChanged = true;
        dirty = true;

        if (want.felled && want.fall !== undefined) {
          const timing = treeFallTimes(grown);
          const fall: FallingTree = {
            tree: grown,
            yaw: want.fall.yaw,
            landed: serverNowMs - want.fall.startedAtMs >= timing.fall * 1000,
            axis: new THREE.Vector3(Math.cos(want.fall.yaw), 0, -Math.sin(want.fall.yaw)),
            beganAt: performance.now() - Math.max(0, serverNowMs - want.fall.startedAtMs),
          };
          falling.set(tree.id, fall);
          drawFall(tree.id, fall);
        }
      }

      if (!stumpsChanged) return;
      placeStumps();
      // The camera should stop shying away from a trunk that is no longer
      // there, and start minding one that has grown back.
      for (const key of touchedCells) rebuildCell(key);
      refreshCameraBlockers();
    },
    shakeTree: (treeId, awayX, awayZ, strength = 1) => {
      const length = Math.hypot(awayX, awayZ);
      if (length < 1e-6 || !treeById.has(treeId) || felled.has(treeId)) return;
      // Tipped about the level line across the blow, top first along it.
      shaking.set(treeId, {
        axis: new THREE.Vector3(awayZ / length, 0, -awayX / length),
        age: 0,
        strength,
      });
    },
    drainLandings: () => landings.splice(0),
    update(deltaSeconds, position) {
      sinceDetailUpdate += deltaSeconds;
      const moved = Math.hypot(position.x - lastX, position.z - lastZ) >= 4;
      if (dirty || (sinceDetailUpdate >= 0.5 && moved)) {
        sinceDetailUpdate = 0;
        dirty = false;
        lastX = position.x;
        lastZ = position.z;
        repack(position);
      }

      for (const [treeId, fall] of falling) drawFall(treeId, fall);
      for (const [treeId, shake] of shaking) {
        shake.age += deltaSeconds;
        const done = shake.age >= TREE_SHAKE_SECONDS;
        const angle = done
          ? 0
          : TREE_SHAKE_ANGLE *
            shake.strength *
            Math.exp(-shake.age * TREE_SHAKE_SETTLE) *
            Math.sin(shake.age * TREE_SHAKE_SPEED + 0.6);
        tipTree(treeId, tilt.setFromAxisAngle(shake.axis, angle));
        if (done) shaking.delete(treeId);
      }
    },
    dispose: () => {
      for (const item of disposables) item.dispose();
      for (const mesh of blockerMeshes.values()) {
        mesh.geometry.disposeBoundsTree?.();
        mesh.geometry.dispose();
      }
    },
  };
}

/** The colour of earth seen through a crack, dark enough to read as the inside of the ground. */
const UNDERGROUND_COLOR = 0x4a3524;

/**
 * Keeps holes from showing the sky through their seams (decision 0114): the
 * ground drawn again from below, and a floor far down, both in dark earth. The
 * ground is one surface with nothing under it, so a ray slipping through a
 * crack in the lining of a hole would otherwise come out through the
 * underside and see the sky.
 */
function createUnderground(geometry: THREE.BufferGeometry, size: number): THREE.Group {
  const group = new THREE.Group();
  const under = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: UNDERGROUND_COLOR,
      roughness: 1,
      metalness: 0,
      side: THREE.BackSide,
    }),
  );
  under.frustumCulled = false;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x1c140d }),
  );
  floor.position.y = -40;
  floor.frustumCulled = false;
  group.add(under, floor);
  return group;
}

/**
 * The ground for the whole visible world: flat through the hand-built
 * clearing, rolling into hills across the wilderness, and flat again past the
 * wall at the edge of the world - all one surface, so there is nothing for a
 * second, flatter ground plane to z-fight with. Every corner of it carries
 * how grassy or bare it is and a soft tint, which the painted ground
 * material blends by (see decision 0053).
 */
export function createGround(
  terrain: Terrain,
  shader: GroundShader,
): GroundPatches & {
  mesh: THREE.Mesh;
  /** The ground seen from below, and a floor far under it: dark earth for any crack in a hole to look into, never sky. */
  underground: THREE.Group;
  dispose(): void;
} {
  const size = PLAYABLE_HALF_EXTENT * 2 + GROUND_FOG_MARGIN;
  const segments = Math.round(size / GROUND_SEGMENT_SIZE);
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

  const position = geometry.attributes.position;
  if (position === undefined) throw new Error('Plane geometry has no position attribute');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    // Not yet rotated: local Z becomes world Y, and local Y becomes -(world Z),
    // once `rotateX` below lays this flat.
    position.setZ(i, terrain.heightAt(x, -y));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);

  const normal = geometry.attributes.normal;
  if (normal === undefined) throw new Error('Plane geometry has no normal attribute');
  const floor = new Float32Array(position.count);
  const rock = new Float32Array(position.count);
  const snow = new Float32Array(position.count);
  const tint = new Float32Array(position.count * 3);
  const bank = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const up = Math.max(0.05, normal.getY(i));
    const slope = Math.sqrt(Math.max(0, 1 - up * up)) / up;
    const shade = shader.shadeAt(position.getX(i), position.getZ(i), slope, position.getY(i));
    floor[i] = shade.floor;
    rock[i] = shade.rock;
    snow[i] = shade.snow;
    bank[i * 2] = shade.bank[0];
    bank[i * 2 + 1] = shade.bank[1];
    tint[i * 3] = shade.tint[0];
    tint[i * 3 + 1] = shade.tint[1];
    tint[i * 3 + 2] = shade.tint[2];
  }
  geometry.setAttribute('floor', new THREE.BufferAttribute(floor, 1));
  geometry.setAttribute('rock', new THREE.BufferAttribute(rock, 1));
  geometry.setAttribute('snow', new THREE.BufferAttribute(snow, 1));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geometry.setAttribute('bank', new THREE.BufferAttribute(bank, 2));

  const material = createGroundMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  const underground = createUnderground(geometry, size);
  const index = geometry.getIndex();
  if (index === null) throw new Error('Plane geometry has no index');
  const stride = segments + 1;
  return {
    mesh,
    underground,
    material,
    origin: -size / 2,
    cell: size / segments,
    // The same surface as the square's two triangles, cut into n by n smaller
    // squares: every point is worked out from the three corners of the
    // triangle it lies in, so it sits exactly on the ground it replaces.
    lattice: (cellX, cellZ, n) => {
      if (cellX < 0 || cellZ < 0 || cellX >= segments || cellZ >= segments) return null;
      const a = cellZ * stride + cellX;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      const points = (n + 1) * (n + 1);
      const out = {
        position: new Float32Array(points * 3),
        normal: new Float32Array(points * 3),
        floor: new Float32Array(points),
        rock: new Float32Array(points),
        snow: new Float32Array(points),
        tint: new Float32Array(points * 3),
        bank: new Float32Array(points * 2),
      };
      const corners: number[] = [0, 0, 0];
      const weights: number[] = [0, 0, 0];
      for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const v = j / n;
          if (u + v <= 1) {
            corners[0] = a;
            corners[1] = b;
            corners[2] = d;
            weights[0] = 1 - u - v;
            weights[1] = v;
            weights[2] = u;
          } else {
            corners[0] = b;
            corners[1] = c;
            corners[2] = d;
            weights[0] = 1 - u;
            weights[1] = u + v - 1;
            weights[2] = 1 - v;
          }
          const at = j * (n + 1) + i;
          for (let k = 0; k < 3; k++) {
            const corner = corners[k]!;
            const w = weights[k]!;
            for (let axis = 0; axis < 3; axis++) {
              out.position[at * 3 + axis]! += w * position.array[corner * 3 + axis]!;
              out.normal[at * 3 + axis]! += w * normal.array[corner * 3 + axis]!;
              out.tint[at * 3 + axis]! += w * tint[corner * 3 + axis]!;
            }
            out.floor[at]! += w * floor[corner]!;
            out.rock[at]! += w * rock[corner]!;
            out.snow[at]! += w * snow[corner]!;
            out.bank[at * 2]! += w * bank[corner * 2]!;
            out.bank[at * 2 + 1]! += w * bank[corner * 2 + 1]!;
          }
          const length = Math.hypot(
            out.normal[at * 3]!,
            out.normal[at * 3 + 1]!,
            out.normal[at * 3 + 2]!,
          );
          for (let axis = 0; axis < 3; axis++) out.normal[at * 3 + axis]! /= length || 1;
        }
      }
      return out;
    },
    // Every square is two triangles, six numbers in a row, left to right and
    // top to bottom: zeroing them leaves nothing to draw there.
    hide: (cellX, cellZ) => {
      if (cellX < 0 || cellZ < 0 || cellX >= segments || cellZ >= segments) return;
      const first = (cellZ * segments + cellX) * 6;
      for (let i = 0; i < 6; i++) index.setX(first + i, 0);
      index.needsUpdate = true;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      for (const part of underground.children)
        if (part instanceof THREE.Mesh) {
          if (part.geometry !== geometry) part.geometry.dispose();
          (part.material as THREE.Material).dispose();
        }
    },
  };
}
