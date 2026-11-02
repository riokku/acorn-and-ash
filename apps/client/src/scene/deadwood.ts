import * as THREE from 'three/webgpu';
import {
  buildableFootprint,
  footprintGap,
  roundFootprint,
  type BuiltPropView,
  type DeadwoodKind,
  type DeadwoodPiece,
} from '@acorn/shared';
import { polyforkPaint } from './polyfork-piece';
import { HIDDEN_INSTANCE } from './props';
import { woodlandGeometry } from './woodland-pieces';

/** How far each kind is set into the ground, at its own size, so a slope never shows daylight under it. */
const SINK: Record<DeadwoodKind, number> = { deadTree: 0.12, fallenLog: 0.06, treeRoots: 0.08 };
/** The round patch each kind keeps clear of anything built, in metres at its own size. */
const FOOTPRINT: Record<DeadwoodKind, number> = { deadTree: 0.6, fallenLog: 1.5, treeRoots: 1.2 };
const KINDS: readonly DeadwoodKind[] = ['deadTree', 'fallenLog', 'treeRoots'];
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The dead wood in the wilderness (see `buildDeadwood`), one draw call per
 * kind. Polyfork's models must have downloaded first; a kind whose file is
 * missing is simply left out, as there was never a placeholder for it.
 */
export function createDeadwood(pieces: readonly DeadwoodPiece[]) {
  const group = new THREE.Group();
  group.name = 'deadwood';
  const layers: {
    mesh: THREE.InstancedMesh;
    pieces: DeadwoodPiece[];
    matrices: THREE.Matrix4[];
  }[] = [];
  for (const kind of KINDS) {
    const geometry = woodlandGeometry(kind);
    const ofKind = pieces.filter((piece) => piece.kind === kind);
    if (geometry === undefined || ofKind.length === 0) continue;
    const mesh = new THREE.InstancedMesh(geometry, polyforkPaint, ofKind.length);
    mesh.name = `deadwood-${kind}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const matrices = ofKind.map((piece) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(piece.x, piece.y - SINK[kind] * piece.scale, piece.z),
        new THREE.Quaternion().setFromAxisAngle(UP, piece.rotationY),
        new THREE.Vector3(piece.scale, piece.scale, piece.scale),
      ),
    );
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.computeBoundingSphere();
    group.add(mesh);
    layers.push({ mesh, pieces: ofKind, matrices });
  }
  return {
    group,
    /** Hides any piece something has been built on top of. Call again when buildings change. */
    setBuildings(buildings: readonly BuiltPropView[]) {
      const footprints = buildings.map((prop) =>
        buildableFootprint(prop.kind, prop.x, prop.z, prop.yaw),
      );
      for (const { mesh, pieces: ofKind, matrices } of layers) {
        ofKind.forEach((piece, index) => {
          const own = roundFootprint(
            piece.x,
            piece.z,
            FOOTPRINT[piece.kind] * piece.scale,
            'deadwood',
          );
          const covered = footprints.some((footprint) => footprintGap(own, footprint) < 0);
          mesh.setMatrixAt(index, covered ? HIDDEN_INSTANCE : matrices[index]!);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    /** The models are shared with the discovery sites, so only the instances are freed. */
    dispose() {
      for (const { mesh } of layers) mesh.dispose();
    },
  };
}
