import * as THREE from 'three/webgpu';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

/**
 * Teach Three.js to use bounding volume hierarchies for raycasts.
 *
 * This is what makes the camera's "is a tree in the way?" check cheap enough to
 * run every frame against the whole clearing.
 */
export function installBvhRaycasting(): void {
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}
