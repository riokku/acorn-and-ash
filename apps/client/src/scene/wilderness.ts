import * as THREE from 'three/webgpu';

import {
  PLAYABLE_HALF_EXTENT,
  PROP_KINDS,
  type PlacedProp,
  type Terrain,
  type Wilderness,
} from '@acorn/shared';

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
 * Build the generated wilderness out of placeholder shapes: one ground mesh
 * for the whole visible world, plus the trees and rocks scattered across it.
 *
 * Built once from `wilderness` and `terrain` and never touched again - there
 * is no per-tree bookkeeping here the way the clearing needs, because nothing
 * in the wilderness ever changes.
 */
export function buildWildernessScene(wilderness: Wilderness, terrain: Terrain): WildernessScene {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  const ground = createGround(terrain);
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
 * second, flatter ground plane to z-fight with.
 */
function createGround(terrain: Terrain): { mesh: THREE.Mesh; dispose(): void } {
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

  const material = new THREE.MeshStandardMaterial({ color: 0x5f7c46, roughness: 1 });
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
