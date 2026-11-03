import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { uncoveredTriangles } from '../src/scene/hidden-under-clothes';

/** A flat square of skin or cloth, facing `up` (or down), made of `cells` × `cells` squares. */
function sheet(size: number, cells: number, height: number, up = true): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(size, size, cells, cells);
  geometry.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  geometry.translate(0, height, 0);
  return geometry;
}
const at = new THREE.Matrix4();

it('hides only the skin the cloth covers, and keeps the skin at its edge', () => {
  const skin = sheet(2, 8, 0);
  const cloth = sheet(0.9, 4, 0.02);
  const all = skin.getIndex()!.count / 3;
  const kept = uncoveredTriangles({ geometry: skin, toBone: at }, [
    { geometry: cloth, toBone: at },
  ]);
  // The middle 2 × 2 cells (8 triangles) lie wholly under the cloth; the ring of cells
  // round them touches its edge and stays.
  expect(kept.length / 3).toBe(all - 8);
});

it('hides skin standing just proud of the cloth, as a bulge would', () => {
  const skin = sheet(2, 8, 0.02);
  const cloth = sheet(0.9, 4, 0);
  const kept = uncoveredTriangles({ geometry: skin, toBone: at }, [
    { geometry: cloth, toBone: at },
  ]);
  expect(kept.length / 3).toBe(skin.getIndex()!.count / 3 - 8);
});

it('keeps skin that only sees the outside of cloth beyond it, like a chin over a collar', () => {
  // Skin facing down, with cloth below it facing up: the cloth's outside, so not covered.
  const chin = sheet(2, 8, 0.05, false);
  const collar = sheet(1, 4, 0.02);
  const kept = uncoveredTriangles({ geometry: chin, toBone: at }, [
    { geometry: collar, toBone: at },
  ]);
  expect(kept.length).toBe(chin.getIndex()!.count);
});

it('lines skin and cloth up in one bone frame, however each file packed its vertices', () => {
  // The skin packed at half size, its bind pose doubling it back.
  const skin = sheet(1, 8, 0);
  const cloth = sheet(0.9, 4, 0.02);
  const kept = uncoveredTriangles(
    { geometry: skin, toBone: new THREE.Matrix4().makeScale(2, 2, 2) },
    [{ geometry: cloth, toBone: at }],
  );
  expect(kept.length / 3).toBe(skin.getIndex()!.count / 3 - 8);
});
