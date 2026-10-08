import * as THREE from 'three/webgpu';

/** A fixed pool of shallow impressions; snowfall gently fills each one back in. */
export function createSnowFootprints(heightAt: (x: number, z: number) => number) {
  const geometry = new THREE.CircleGeometry(1, 10);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x8194a8,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, 160);
  mesh.name = 'snow-footprints';
  mesh.frustumCulled = false;
  const prints = Array.from({ length: 160 }, () => ({ x: 0, z: 0, yaw: 0, age: 60 }));
  const last = new Map<number, { x: number; z: number; foot: number }>();
  const dummy = new THREE.Object3D();
  let cursor = 0;
  return {
    mesh,
    visibleCount: () => (mesh.visible ? prints.filter((print) => print.age < 45).length : 0),
    step(id: number, x: number, z: number, yaw: number, grounded: boolean, snow: boolean) {
      const previous = last.get(id);
      if (
        !snow ||
        !grounded ||
        previous === undefined ||
        Math.hypot(x - previous.x, z - previous.z) > 3
      ) {
        if (last.size > 128) last.clear();
        last.set(id, { x, z, foot: 1 });
        return;
      }
      if (Math.hypot(x - previous.x, z - previous.z) < 0.55) return;
      previous.foot *= -1;
      const side = previous.foot * 0.13;
      Object.assign(prints[cursor]!, {
        x: x + Math.cos(yaw) * side,
        z: z - Math.sin(yaw) * side,
        yaw,
        age: 0,
      });
      cursor = (cursor + 1) % prints.length;
      previous.x = x;
      previous.z = z;
    },
    update(delta: number, snow: boolean, blizzard: boolean) {
      mesh.visible = snow;
      for (let i = 0; i < prints.length; i++) {
        const print = prints[i]!;
        print.age += Math.min(delta, 0.1) * (blizzard ? 3 : 1);
        const fade = Math.max(0, 1 - print.age / 45);
        dummy.position.set(print.x, heightAt(print.x, print.z) + 0.018, print.z);
        dummy.rotation.set(0, print.yaw, 0);
        dummy.scale.set(0.095 * fade, 1, 0.19 * fade);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
      mesh.removeFromParent();
      last.clear();
    },
  };
}
