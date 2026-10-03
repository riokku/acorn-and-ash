import * as THREE from 'three/webgpu';

/**
 * Little bits thrown off where a blow lands (see decision 0056): pale wood
 * chips and flecks of bark from a chopped tree, tufts of fur from a struck
 * animal, a puff of dust where a charged strike slams into the ground,
 * chips of bone off a skeleton, and sparks off one that took a blow
 * without flinching (see decision 0063).
 *
 * Every bit of one kind is drawn by one instanced mesh, reused round and
 * round, so a flurry of blows costs nothing extra to draw.
 */
export type BurstKind = 'wood' | 'fur' | 'dust' | 'bone' | 'spark' | 'gather';

interface BurstStyle {
  readonly geometry: THREE.BufferGeometry;
  /** Bits thrown per blow, and more for a charged one. */
  readonly count: number;
  /** How fast they fly off, in metres a second, slowest to fastest. */
  readonly speed: readonly [number, number];
  readonly lift: readonly [number, number];
  /** How hard they fall: fur drifts, chips drop. */
  readonly gravity: number;
  /** How much of their speed they keep each second: fur and dust slow down fast. */
  readonly drag: number;
  readonly life: readonly [number, number];
  /** How much of a spread either side of the blow's own direction, in radians. */
  readonly spread: number;
  /** Grows as it goes, for a puff that billows out. */
  readonly swell: number;
  readonly colors: readonly number[];
  /** See-through, for a puff rather than a solid thing. */
  readonly opacity?: number;
  /** Lit from within, for a spark. */
  readonly glow?: boolean;
}

const STYLES: Record<BurstKind, BurstStyle> = {
  gather: {
    geometry: new THREE.OctahedronGeometry(0.035, 0),
    count: 7,
    speed: [0.25, 0.65],
    lift: [0.6, 1.1],
    gravity: 0.25,
    drag: 1.8,
    life: [0.45, 0.75],
    spread: Math.PI,
    swell: 0.15,
    colors: [0xffe3a1, 0xf9ce79, 0xfff0c8],
    glow: true,
  },
  wood: {
    geometry: new THREE.BoxGeometry(0.07, 0.025, 0.045),
    count: 9,
    speed: [1.6, 3.6],
    lift: [1.2, 3],
    gravity: 11,
    drag: 0.4,
    life: [0.45, 0.8],
    spread: 1.1,
    swell: 0,
    colors: [0xecd2a2, 0xe2c188, 0xf3dfb8, 0x7a5638, 0x5e4230],
  },
  fur: {
    geometry: new THREE.IcosahedronGeometry(0.035, 0),
    count: 8,
    speed: [0.8, 2],
    lift: [0.6, 1.6],
    gravity: 2.2,
    drag: 2.4,
    life: [0.55, 0.9],
    spread: 1.4,
    swell: 0.6,
    colors: [0xf1ebe2, 0xd9d0c4, 0xc4b9ab],
  },
  dust: {
    geometry: new THREE.IcosahedronGeometry(0.09, 0),
    count: 10,
    speed: [1.2, 2.4],
    lift: [0.2, 0.7],
    gravity: 0.6,
    drag: 3,
    life: [0.5, 0.8],
    spread: Math.PI,
    swell: 1.8,
    colors: [0xb8a78c, 0xa89878, 0xc7b89e],
    opacity: 0.7,
  },
  bone: {
    geometry: new THREE.TetrahedronGeometry(0.045, 0).scale(1, 0.55, 1.6),
    count: 9,
    speed: [1.8, 3.6],
    lift: [1.4, 3.2],
    gravity: 12,
    drag: 0.5,
    life: [0.5, 0.85],
    spread: 1.2,
    swell: 0,
    colors: [0xf1e9d2, 0xe6dcc0, 0xd4c8a8, 0xfaf4e4],
  },
  spark: {
    geometry: new THREE.BoxGeometry(0.012, 0.012, 0.09),
    count: 10,
    speed: [3, 6],
    lift: [0.8, 2.6],
    gravity: 9,
    drag: 1.2,
    life: [0.18, 0.34],
    spread: 1.5,
    swell: 0,
    colors: [0xfff3c4, 0xffd36b, 0xffb347],
    glow: true,
  },
};

/** How many bits of each kind can be in the air at once. */
const CAPACITY = 72;

interface Bit {
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly spin: THREE.Vector3;
  readonly rotation: THREE.Euler;
  age: number;
  life: number;
  size: number;
}

class BurstPool {
  readonly mesh: THREE.InstancedMesh;
  private readonly bits: Bit[] = [];
  private next = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly color = new THREE.Color();

  constructor(private readonly style: BurstStyle) {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    if (style.glow === true) {
      material.emissive.set(0xffc870);
      material.emissiveIntensity = 2.2;
    }
    if (style.opacity !== undefined) {
      material.transparent = true;
      material.opacity = style.opacity;
      material.depthWrite = false;
    }
    this.mesh = new THREE.InstancedMesh(style.geometry, material, CAPACITY);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    for (let i = 0; i < CAPACITY; i++) {
      this.bits.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        age: 0,
        life: 0,
        size: 1,
      });
      this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.color.set(style.colors[0] ?? 0xffffff));
    }
  }

  throw(at: Readonly<THREE.Vector3>, awayX: number, awayZ: number, strength: number): void {
    const style = this.style;
    const heading = Math.atan2(awayX, awayZ);
    const count = Math.round(style.count * strength);
    for (let n = 0; n < count; n++) {
      const index = this.next;
      this.next = (this.next + 1) % CAPACITY;
      const bit = this.bits[index];
      if (bit === undefined) continue;
      const angle = heading + (Math.random() * 2 - 1) * style.spread;
      const speed = between(style.speed) * (0.8 + 0.2 * strength);
      bit.position.set(
        at.x + (Math.random() - 0.5) * 0.12,
        at.y + (Math.random() - 0.5) * 0.12,
        at.z + (Math.random() - 0.5) * 0.12,
      );
      bit.velocity.set(Math.sin(angle) * speed, between(style.lift), Math.cos(angle) * speed);
      bit.spin.set(rand(14), rand(14), rand(14));
      bit.rotation.set(rand(Math.PI), rand(Math.PI), rand(Math.PI));
      bit.age = 0;
      bit.life = between(style.life);
      bit.size = 0.7 + Math.random() * 0.6;
      const colors = style.colors;
      this.mesh.setColorAt(
        index,
        this.color.set(colors[Math.floor(Math.random() * colors.length)] ?? 0xffffff),
      );
    }
    if (this.mesh.instanceColor !== null) this.mesh.instanceColor.needsUpdate = true;
  }

  update(deltaSeconds: number): void {
    const style = this.style;
    const keep = Math.exp(-style.drag * deltaSeconds);
    for (let i = 0; i < CAPACITY; i++) {
      const bit = this.bits[i];
      if (bit === undefined || bit.life <= 0) continue;
      bit.age += deltaSeconds;
      if (bit.age >= bit.life) {
        bit.life = 0;
        this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
        continue;
      }
      bit.velocity.multiplyScalar(keep);
      bit.velocity.y -= style.gravity * deltaSeconds;
      bit.position.addScaledVector(bit.velocity, deltaSeconds);
      bit.rotation.x += bit.spin.x * deltaSeconds;
      bit.rotation.y += bit.spin.y * deltaSeconds;
      bit.rotation.z += bit.spin.z * deltaSeconds;
      const through = bit.age / bit.life;
      // Full size, then gone over the last third.
      const shrink = through < 0.66 ? 1 : 1 - (through - 0.66) / 0.34;
      const size = bit.size * shrink * (1 + style.swell * through);
      this.turn.setFromEuler(bit.rotation);
      this.matrix.compose(bit.position, this.turn, this.scale.setScalar(size));
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

export class ImpactBursts {
  readonly group = new THREE.Group();
  private readonly pools: Record<BurstKind, BurstPool>;

  constructor() {
    this.pools = {
      gather: new BurstPool(STYLES.gather),
      wood: new BurstPool(STYLES.wood),
      fur: new BurstPool(STYLES.fur),
      dust: new BurstPool(STYLES.dust),
      bone: new BurstPool(STYLES.bone),
      spark: new BurstPool(STYLES.spark),
    };
    for (const pool of Object.values(this.pools)) this.group.add(pool.mesh);
  }

  /**
   * Throw off a burst of `kind` at `at`, flying mostly along the blow -
   * `awayX`, `awayZ`, away from whoever struck it - and more of them, and
   * harder, for a charged strike (`strength` above 1).
   */
  burst(
    kind: BurstKind,
    at: Readonly<THREE.Vector3>,
    awayX: number,
    awayZ: number,
    strength = 1,
  ): void {
    this.pools[kind].throw(at, awayX, awayZ, strength);
  }

  update(deltaSeconds: number): void {
    for (const pool of Object.values(this.pools)) pool.update(deltaSeconds);
  }

  dispose(): void {
    for (const pool of Object.values(this.pools)) pool.dispose();
  }
}

function between([low, high]: readonly [number, number]): number {
  return low + Math.random() * (high - low);
}

function rand(size: number): number {
  return (Math.random() * 2 - 1) * size;
}
