import type * as THREE from 'three/webgpu';
import { polyforkPiece } from './polyfork-piece';

/**
 * Polyfork's free woodland scenery (decision 0272). Each file is one painted
 * mesh with its base on the ground, so a copy only needs moving into place.
 */
const WOODLAND_PIECES = {
  fallenLog: polyforkPiece('fallen-log'),
  deadTree: polyforkPiece('dead-tree'),
  treeRoots: polyforkPiece('exposed-tree-roots'),
  firewoodStack: polyforkPiece('firewood-stack'),
};

export type WoodlandPiece = keyof typeof WOODLAND_PIECES;

/** The piece's mesh, shared by every copy, or undefined until it has downloaded. */
export function woodlandGeometry(piece: WoodlandPiece): THREE.BufferGeometry | undefined {
  const parts = WOODLAND_PIECES[piece].parts();
  return parts === undefined ? undefined : [...parts.values()][0];
}
