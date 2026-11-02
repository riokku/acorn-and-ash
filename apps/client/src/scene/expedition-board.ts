import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ModelBuilder, placed } from '../art/shapes';
import { paintedMaterial } from '../art/materials';
import { polyforkPaint, polyforkPiece } from './polyfork-piece';

/**
 * Polyfork's free Camp Notice Board (decision 0272), roof, notices and
 * leaflets, shrunk from 2.2 m wide and 2.4 m tall so it stands beside the
 * door without reaching the tent or cabin.
 */
const NOTICE_BOARD_SCALE = 0.8;
const noticeBoard = polyforkPiece(
  'camp-notice-board',
  new THREE.Matrix4().makeScale(NOTICE_BOARD_SCALE, NOTICE_BOARD_SCALE, NOTICE_BOARD_SCALE),
);
let mergedBoard: THREE.BufferGeometry | null | undefined;

/**
 * Polyfork's board once it has downloaded; otherwise a cedar trail board with
 * three weathered notices, merged into five draw calls. Each board gets its
 * own geometry, because the home stretches its feet down to the ground.
 */
export function createExpeditionBoard(): { group: THREE.Group; dispose(): void } {
  const parts = noticeBoard.parts();
  if (parts !== undefined) mergedBoard ??= mergeGeometries([...parts.values()]);
  if (mergedBoard) {
    const geometry = mergedBoard.clone();
    const mesh = new THREE.Mesh(geometry, polyforkPaint);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.name = 'expedition-board';
    group.add(mesh);
    return { group, dispose: () => geometry.dispose() };
  }

  const cedar = paintedMaterial('wood', { tint: 0x9b7650, roughness: 1 });
  const dark = paintedMaterial('wood', { tint: 0x574333, roughness: 1 });
  const paper = paintedMaterial('burlap', { tint: 0xe1cea0, roughness: 1 });
  const ink = paintedMaterial('burlap', { tint: 0x597567, roughness: 1 });
  const brass = paintedMaterial('wood', { tint: 0xb7965f, roughness: 0.65 });
  const b = new ModelBuilder();
  for (const x of [-0.55, 0.55])
    b.add(dark, new THREE.BoxGeometry(0.13, 1.8, 0.13), placed(x, 0.9, 0));
  for (let row = 0; row < 4; row++)
    b.add(cedar, new THREE.BoxGeometry(1.4, 0.17, 0.08), placed(0, 1.17 + row * 0.18, 0));
  for (const side of [-1, 1])
    b.add(
      dark,
      new THREE.BoxGeometry(0.83, 0.08, 0.36),
      placed(side * 0.36, 1.99, 0, { z: side * -0.16 }),
    );
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.4,
      y = 1.49 + (i % 2) * 0.025;
    b.add(
      paper,
      new THREE.BoxGeometry(0.3, 0.43, 0.012),
      placed(x, y, 0.052, { z: (i - 1) * 0.045 }),
    );
    b.add(brass, new THREE.SphereGeometry(0.022, 6, 4), placed(x, y + 0.18, 0.068));
    b.add(
      ink,
      new THREE.BoxGeometry(0.09, 0.09, 0.015),
      placed(x, y + 0.06, 0.068, { z: Math.PI / 4 }),
    );
    for (let row = 0; row < 3; row++)
      b.add(
        ink,
        new THREE.BoxGeometry(0.2 - row * 0.025, 0.013, 0.014),
        placed(x, y - 0.04 - row * 0.04, 0.068),
      );
  }
  return b.build();
}
