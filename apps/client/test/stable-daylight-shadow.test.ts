import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { addDaylight } from '../src/scene/lighting';
import { centreDaylightShadow } from '../src/scene/stable-daylight-shadow';

const WORLD_POINT = new THREE.Vector3(5, 2, -4);
function projection(sun: THREE.DirectionalLight, at: THREE.Vector3) {
  centreDaylightShadow(sun, at);
  sun.updateMatrixWorld();
  sun.shadow.updateMatrices(sun);
  return WORLD_POINT.clone().applyMatrix4(sun.shadow.matrix);
}

describe('stable daylight shadows', () => {
  it.each([1024, 2048])(
    'keeps static scenery on the same sample grid through sub-texel movement at %s resolution',
    (resolution) => {
      const { sun } = addDaylight(new THREE.Scene());
      sun.shadow.mapSize.set(resolution, resolution);
      const before = projection(sun, new THREE.Vector3());
      for (const at of [
        new THREE.Vector3(0.001, 0, 0),
        new THREE.Vector3(0, 0.001, -0.001),
        new THREE.Vector3(-0.001, 0, 0.001),
      ]) {
        const after = projection(sun, at);
        expect(after.x).toBeCloseTo(before.x, 10);
        expect(after.y).toBeCloseTo(before.y, 10);
      }
    },
  );
  it('follows a larger movement by a whole pixel without rotating the light', () => {
    const { sun } = addDaylight(new THREE.Scene());
    const offset = new THREE.Vector3(28, 40, 18);
    const right = new THREE.Vector3(0, 1, 0).cross(offset).normalize();
    const texel = 110 / sun.shadow.mapSize.x;
    const before = projection(sun, new THREE.Vector3());
    const after = projection(sun, right.multiplyScalar(texel * 1.1));
    expect((after.x - before.x) * sun.shadow.mapSize.x).toBeCloseTo(-1, 8);
    expect(after.y).toBeCloseTo(before.y, 10);
    expect(sun.position.clone().sub(sun.target.position).distanceTo(offset)).toBeLessThan(1e-10);
  });
  it('keeps the map centred within half a texel per axis on distant slopes', () => {
    const { sun } = addDaylight(new THREE.Scene());
    for (const at of [new THREE.Vector3(450, 42, -500), new THREE.Vector3(-380, -12, 270)]) {
      projection(sun, at);
      expect(sun.target.position.distanceTo(at)).toBeLessThan(
        (Math.SQRT2 * 110) / 2048 / 2 + 1e-10,
      );
    }
  });
});
