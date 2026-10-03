import { createRng, hashSeed, treeLogSpots, type PlacedProp } from '@acorn/shared';
import * as THREE from 'three/webgpu';
import { attribute, texture } from 'three/tsl';

/** A fixed pool: simultaneous falls still cost one draw call, with no per-frame allocations. */
export const TREE_DUST_CAPACITY = 128;
interface Puff {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  opacity: number;
  roll: number;
}

/** Soft, irregular dust, authored procedurally rather than adding an external asset. */
function dustTexture(): THREE.DataTexture {
  const side = 64;
  const pixels = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const u = ((x + 0.5) / side) * 2 - 1;
      const v = ((y + 0.5) / side) * 2 - 1;
      const radius = Math.hypot(u, v);
      const wisps =
        0.72 + 0.16 * Math.sin(u * 13 + Math.sin(v * 7)) + 0.12 * Math.cos(v * 17 + u * 6);
      const alpha = Math.max(0, 1 - radius) ** 1.6 * wisps;
      const at = (y * side + x) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = 255;
      pixels[at + 3] = Math.round(alpha * 255);
    }
  }
  const result = new THREE.DataTexture(pixels, side, side);
  result.magFilter = result.minFilter = THREE.LinearFilter;
  result.needsUpdate = true;
  return result;
}

export class TreeLandingEffects {
  readonly group = new THREE.Group();
  private readonly texture = dustTexture();
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly material = new THREE.MeshStandardNodeMaterial({
    color: 0xd0b695,
    roughness: 1,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly alpha = new THREE.InstancedBufferAttribute(
    new Float32Array(TREE_DUST_CAPACITY),
    1,
  );
  private readonly mesh: THREE.InstancedMesh;
  private readonly puffs: Puff[] = [];
  private next = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly scale = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly roll = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3(0, 0, 1);
  private readonly color = new THREE.Color();

  constructor() {
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('puffOpacity', this.alpha);
    this.material.opacityNode = texture(this.texture).a.mul(attribute('puffOpacity', 'float'));
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, TREE_DUST_CAPACITY);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    for (let i = 0; i < TREE_DUST_CAPACITY; i++) {
      this.puffs.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
        life: 0,
        size: 0,
        opacity: 0,
        roll: 0,
      });
      this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.color.set(0xffffff));
    }
    this.group.add(this.mesh);
  }

  burst(tree: PlacedProp, yaw: number): void {
    this.mesh.visible = true;
    const random = createRng(hashSeed(tree.id, tree.scale, yaw));
    const spots = treeLogSpots(tree, yaw);
    for (const spot of spots) {
      // Dense low dirt spreads sideways; lighter wisps rise and hang after the logs appear.
      for (let n = 0; n < 8; n++) {
        const index = this.next;
        this.next = (this.next + 1) % TREE_DUST_CAPACITY;
        const puff = this.puffs[index]!;
        const lifted = n >= 3;
        const side = n % 2 === 0 ? 1 : -1;
        const speed = random.nextRange(0.8, 2.4) * tree.scale;
        puff.position.set(
          spot.x + random.nextRange(-0.2, 0.2),
          (tree.y ?? 0) + (lifted ? 0.35 : 0.12),
          spot.z + random.nextRange(-0.2, 0.2),
        );
        puff.velocity.set(
          Math.cos(yaw) * side * speed + Math.sin(yaw) * 0.4,
          lifted ? random.nextRange(0.35, 0.8) : 0.08,
          -Math.sin(yaw) * side * speed + Math.cos(yaw) * 0.4,
        );
        puff.age = 0;
        puff.life = lifted ? random.nextRange(1.3, 2.1) : random.nextRange(0.65, 1);
        puff.size = random.nextRange(1.3, 2.2) * tree.scale;
        puff.opacity = lifted ? 0.36 : 0.6;
        puff.roll = random.nextRange(-Math.PI, Math.PI);
        this.mesh.setColorAt(index, this.color.set(lifted ? 0xe7d7bd : 0x9d8466));
      }
    }
    if (this.mesh.instanceColor !== null) this.mesh.instanceColor.needsUpdate = true;
  }

  update(deltaSeconds: number, camera: THREE.Camera): void {
    if (!this.mesh.visible) return;
    let alive = false;
    const keep = Math.exp(-2.4 * deltaSeconds);
    for (let i = 0; i < this.puffs.length; i++) {
      const puff = this.puffs[i]!;
      if (puff.life === 0) continue;
      puff.age += deltaSeconds;
      if (puff.age >= puff.life) {
        puff.life = 0;
        this.alpha.setX(i, 0);
        this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
        continue;
      }
      alive = true;
      puff.position.addScaledVector(puff.velocity, deltaSeconds);
      puff.velocity.x *= keep;
      puff.velocity.z *= keep;
      const t = puff.age / puff.life;
      const size = puff.size * (0.35 + 0.85 * (1 - Math.exp(-t * 5)));
      this.alpha.setX(i, puff.opacity * Math.min(1, puff.age / 0.045) * (1 - t) ** 1.5);
      this.turn
        .copy(camera.quaternion)
        .multiply(this.roll.setFromAxisAngle(this.axis, puff.roll + t * 0.18));
      this.matrix.compose(puff.position, this.turn, this.scale.setScalar(size));
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.visible = alive;
    this.alpha.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
