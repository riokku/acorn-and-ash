import * as THREE from 'three/webgpu';

import {
  PLAYABLE_HALF_EXTENT,
  PROP_KINDS,
  type Clearing,
  type PlacedProp,
  type Terrain,
  type Wilderness,
} from '@acorn/shared';

import { createGroundShader, type GroundShader } from '../art/ground-shading';
import { createGroundMaterial } from '../art/materials';
import { blockerGeometry, createCameraBlockers, createPropMeshes, placeInstance } from './props';

/** How finely the hills are meshed. Small enough that slopes read as curves, not facets. */
const GROUND_SEGMENT_SIZE = 2.5;
/**
 * How far past the wall the ground still runs, so its edge is never visible:
 * it disappears into the fog long before it stops. Flat out there regardless -
 * `terrain.heightAt` flattens before the wall - so the extra reach costs
 * almost nothing to draw.
 */
const GROUND_FOG_MARGIN = 340;

export interface WildernessScene {
  readonly group: THREE.Group;
  /**
   * Every trunk and rock beyond the clearing, merged for camera raycasts.
   * Unlike the clearing's, this is never rebuilt: nothing out here is ever
   * chopped or picked up.
   */
  readonly cameraBlockers: THREE.Mesh;
  dispose(): void;
}

/**
 * Build the generated wilderness: one painted ground mesh for the whole
 * visible world, plus the trees and rocks scattered across it.
 *
 * Built once from `wilderness` and `terrain` and never touched again - there
 * is no per-tree bookkeeping here the way the clearing needs, because nothing
 * in the wilderness ever changes. The clearing is handed in too, only so the
 * ground knows where its trees and its pond are (see ground-shading.ts).
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
      props: [...clearing.props, ...wilderness.props],
    }),
  );
  group.add(ground.mesh);
  disposables.push(ground);

  const byKind = new Map<string, PlacedProp[]>();
  for (const prop of wilderness.props) {
    const existing = byKind.get(prop.kind);
    if (existing === undefined) byKind.set(prop.kind, [prop]);
    else existing.push(prop);
  }

  for (const [kindId, props] of byKind) {
    const kind = PROP_KINDS[kindId as keyof typeof PROP_KINDS];
    const parts = createPropMeshes(kind, props.length);
    for (const part of parts) {
      group.add(part.mesh);
      disposables.push(part);
    }
    props.forEach((prop, index) => placeInstance(parts, index, prop));
    for (const part of parts) part.mesh.instanceMatrix.needsUpdate = true;
  }

  const cameraBlockers = createCameraBlockers(
    wilderness.props.map((prop) => blockerGeometry(PROP_KINDS[prop.kind], prop)),
  );
  // Never drawn: it exists so the camera can feel the trees.
  cameraBlockers.visible = false;
  group.add(cameraBlockers);

  return {
    group,
    cameraBlockers,
    dispose: () => {
      for (const item of disposables) item.dispose();
      cameraBlockers.geometry.dispose();
    },
  };
}

/**
 * The ground for the whole visible world: flat through the hand-built
 * clearing, rolling into hills across the wilderness, and flat again past the
 * wall at the edge of the world - all one surface, so there is nothing for a
 * second, flatter ground plane to z-fight with. Every corner of it carries
 * how grassy or bare it is and a soft tint, which the painted ground
 * material blends by (see decision 0053).
 */
function createGround(
  terrain: Terrain,
  shader: GroundShader,
): { mesh: THREE.Mesh; dispose(): void } {
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
  const tint = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const up = Math.max(0.05, normal.getY(i));
    const slope = Math.sqrt(Math.max(0, 1 - up * up)) / up;
    const shade = shader.shadeAt(position.getX(i), position.getZ(i), slope);
    floor[i] = shade.floor;
    tint[i * 3] = shade.tint[0];
    tint[i * 3 + 1] = shade.tint[1];
    tint[i * 3 + 2] = shade.tint[2];
  }
  geometry.setAttribute('floor', new THREE.BufferAttribute(floor, 1));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 3));

  const material = createGroundMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
