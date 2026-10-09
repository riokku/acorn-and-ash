import * as THREE from 'three';
import { SUPPORT_HEIGHT, SUPPORT_MAX_COUNT, VOXEL, type Support } from '@acorn/shared';

/**
 * Mine supports (decision 0119): two wooden posts against the walls of a
 * tunnel and a beam across under the roof, with a short brace at each corner.
 * Placeholder shapes for now; the art replaces them once supports are fun.
 *
 * Every support is drawn from three shared meshes (posts, beams, braces), so a
 * long mine costs three draws however many supports it has.
 */

const POST = 0.16;
const BEAM_DEPTH = 0.2;
const BEAM_HEIGHT = 0.2;
const BRACE = 0.12;
const WOOD = 0xa4723f;
const WOOD_DARK = 0x7d5630;

/** The size of a support, in metres: one cell wide, as tall as a person standing in it. */
const WIDTH = 1;
const HEIGHT = SUPPORT_HEIGHT * VOXEL;

export interface MineSupports {
  readonly group: THREE.Group;
  /** Draw these. With `replace` the list is every support there is, otherwise only new ones. */
  apply(supports: readonly Support[], replace: boolean): void;
  dispose(): void;
}

/** The pieces of one support, as where each goes in a cell whose corner is the origin. */
interface Piece {
  readonly kind: 'post' | 'beam' | 'brace';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Turn about the vertical, in radians. */
  readonly yaw: number;
  readonly lean: number;
}

/** Where every piece of a support goes, for a tunnel running along this axis. */
export function supportPieces(axis: 0 | 1): Piece[] {
  // Written for a tunnel along X (posts either side in Z); a turn of a quarter does the other.
  const edge = POST / 2;
  const pieces: Piece[] = [
    { kind: 'post', x: WIDTH / 2, y: HEIGHT / 2 - BEAM_HEIGHT / 2, z: edge, yaw: 0, lean: 0 },
    {
      kind: 'post',
      x: WIDTH / 2,
      y: HEIGHT / 2 - BEAM_HEIGHT / 2,
      z: WIDTH - edge,
      yaw: 0,
      lean: 0,
    },
    { kind: 'beam', x: WIDTH / 2, y: HEIGHT - BEAM_HEIGHT / 2, z: WIDTH / 2, yaw: 0, lean: 0 },
    {
      kind: 'brace',
      x: WIDTH / 2,
      y: HEIGHT - BEAM_HEIGHT - 0.12,
      z: POST + 0.1,
      yaw: 0,
      lean: -Math.PI / 4,
    },
    {
      kind: 'brace',
      x: WIDTH / 2,
      y: HEIGHT - BEAM_HEIGHT - 0.12,
      z: WIDTH - POST - 0.1,
      yaw: 0,
      lean: Math.PI / 4,
    },
  ];
  if (axis === 0) return pieces;
  // Along Z instead: swap the two floor axes.
  return pieces.map((piece) => ({
    ...piece,
    x: piece.z,
    z: piece.x,
    yaw: piece.yaw + Math.PI / 2,
  }));
}

function geometryFor(kind: Piece['kind']): THREE.BufferGeometry {
  switch (kind) {
    // Posts and beams are boxes whose long side is X for the beam (rotated to run across Z).
    case 'post':
      return new THREE.BoxGeometry(POST, HEIGHT - BEAM_HEIGHT, POST);
    case 'beam':
      return new THREE.BoxGeometry(BEAM_DEPTH, BEAM_HEIGHT, WIDTH + 0.12);
    case 'brace':
      return new THREE.BoxGeometry(BRACE, BRACE, 0.42);
  }
}

/** The matrices of one support's pieces, placed in the world. */
function placePieces(support: Support, into: Map<Piece['kind'], THREE.Matrix4[]>): void {
  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const lean = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (const piece of supportPieces(support.axis)) {
    turn.setFromAxisAngle(new THREE.Vector3(0, 1, 0), piece.yaw);
    // The brace rises from the post to the beam along the way the tunnel is not running.
    lean.setFromAxisAngle(new THREE.Vector3(1, 0, 0), piece.lean);
    turn.multiply(lean);
    matrix.compose(
      new THREE.Vector3(
        support.ix * VOXEL + piece.x,
        support.iy * VOXEL + piece.y,
        support.iz * VOXEL + piece.z,
      ),
      turn,
      scale,
    );
    into.get(piece.kind)?.push(matrix.clone());
  }
}

export function createMineSupports(): MineSupports {
  const group = new THREE.Group();
  group.name = 'mine-supports';
  const kinds: Piece['kind'][] = ['post', 'beam', 'brace'];
  const perSupport = { post: 2, beam: 1, brace: 2 };
  const meshes = new Map<Piece['kind'], THREE.InstancedMesh>();
  for (const kind of kinds) {
    const material = new THREE.MeshStandardMaterial({
      color: kind === 'brace' ? WOOD_DARK : WOOD,
      roughness: 0.9,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(
      geometryFor(kind),
      material,
      SUPPORT_MAX_COUNT * perSupport[kind],
    );
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.set(kind, mesh);
    group.add(mesh);
  }

  const seen = new Set<string>();
  const all: Support[] = [];

  const rebuild = (): void => {
    const matrices = new Map<Piece['kind'], THREE.Matrix4[]>(kinds.map((kind) => [kind, []]));
    for (const support of all) placePieces(support, matrices);
    for (const kind of kinds) {
      const mesh = meshes.get(kind)!;
      const list = matrices.get(kind)!;
      list.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    group,
    apply(supports, replace) {
      if (replace) {
        seen.clear();
        all.length = 0;
      }
      for (const support of supports) {
        const key = `${support.ix},${support.iy},${support.iz}`;
        if (seen.has(key) || all.length >= SUPPORT_MAX_COUNT) continue;
        seen.add(key);
        all.push(support);
      }
      rebuild();
    },
    dispose() {
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      group.removeFromParent();
    },
  };
}

/** A see-through support showing where the next one would stand: green if it can, red if not. */
export interface SupportPreview {
  readonly group: THREE.Group;
  show(cell: { ix: number; iy: number; iz: number } | null, axis: 0 | 1, allowed: boolean): void;
  dispose(): void;
}

export function createSupportPreview(): SupportPreview {
  const group = new THREE.Group();
  group.visible = false;
  group.renderOrder = 10;
  const material = new THREE.MeshBasicMaterial({
    color: 0x9be39b,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const geometries = new Map<Piece['kind'], THREE.BufferGeometry>();
  const pieces = new Map<'x' | 'z', THREE.Mesh[]>();
  for (const axis of [0, 1] as const) {
    const meshes: THREE.Mesh[] = [];
    for (const piece of supportPieces(axis)) {
      let geometry = geometries.get(piece.kind);
      if (geometry === undefined) {
        geometry = geometryFor(piece.kind);
        geometries.set(piece.kind, geometry);
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(piece.x, piece.y, piece.z);
      mesh.rotation.set(piece.lean, piece.yaw, 0, 'YXZ');
      mesh.visible = false;
      group.add(mesh);
      meshes.push(mesh);
    }
    pieces.set(axis === 0 ? 'x' : 'z', meshes);
  }
  return {
    group,
    show(cell, axis, allowed) {
      group.visible = cell !== null;
      if (cell === null) return;
      group.position.set(cell.ix * VOXEL, cell.iy * VOXEL, cell.iz * VOXEL);
      material.color.set(allowed ? 0x9be39b : 0xff6a5a);
      pieces.get('x')?.forEach((mesh) => (mesh.visible = axis === 0));
      pieces.get('z')?.forEach((mesh) => (mesh.visible = axis === 1));
    },
    dispose() {
      for (const geometry of geometries.values()) geometry.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
