import * as THREE from 'three/webgpu';
import { attribute, float } from 'three/tsl';

/**
 * A pale streak swept behind whatever is swung, fading from the weapon back
 * along its path (see decision 0056): it makes a quick swing easy to read,
 * and a charged one look like it means it.
 *
 * Built afresh each frame from where the weapon has been over the last
 * moment - the head end of it, from partway up the handle to the tip - so
 * it follows any swing of any length without knowing anything about it.
 */

/** How long the streak lingers behind the weapon, in seconds. */
const TRAIL_SECONDS = 0.14;
/** At most this many moments along it. */
const MAX_SAMPLES = 24;
/** How far up from the hand the streak starts, as a share of the way to the tip. */
const TRAIL_FROM = 0.45;
const TRAIL_COLOR = 0xfff4dc;
const TRAIL_OPACITY = 0.55;

interface Sample {
  readonly base: THREE.Vector3;
  readonly tip: THREE.Vector3;
  age: number;
}

export class WeaponTrail {
  readonly mesh: THREE.Mesh;
  private readonly samples: Sample[] = [];
  private readonly spare: Sample[] = [];
  private readonly positions = new Float32Array(MAX_SAMPLES * 2 * 3);
  private readonly fades = new Float32Array(MAX_SAMPLES * 2);
  private readonly geometry = new THREE.BufferGeometry();

  constructor() {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('fade', new THREE.BufferAttribute(this.fades, 1));
    const indices: number[] = [];
    for (let i = 0; i < MAX_SAMPLES - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(indices);
    this.geometry.setDrawRange(0, 0);
    const material = new THREE.MeshBasicNodeMaterial({
      color: TRAIL_COLOR,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.opacityNode = attribute('fade', 'float').mul(float(TRAIL_OPACITY));
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /**
   * Move the streak on: `hand` and `tip` are where the weapon is now, or null
   * when it is not being swung, which lets the streak trail away to nothing.
   */
  update(deltaSeconds: number, hand: THREE.Vector3 | null, tip: THREE.Vector3 | null): void {
    for (const sample of this.samples) sample.age += deltaSeconds;
    while (this.samples.length > 0 && (this.samples[0]?.age ?? 0) > TRAIL_SECONDS) {
      const old = this.samples.shift();
      if (old !== undefined) this.spare.push(old);
    }
    if (hand !== null && tip !== null) {
      if (this.samples.length >= MAX_SAMPLES) {
        const old = this.samples.shift();
        if (old !== undefined) this.spare.push(old);
      }
      const sample = this.spare.pop() ?? {
        base: new THREE.Vector3(),
        tip: new THREE.Vector3(),
        age: 0,
      };
      sample.base.lerpVectors(hand, tip, TRAIL_FROM);
      sample.tip.copy(tip);
      sample.age = 0;
      this.samples.push(sample);
    }
    this.rebuild();
  }

  dispose(): void {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  private rebuild(): void {
    const count = this.samples.length;
    this.samples.forEach((sample, index) => {
      // Faint at the old end, strongest at the weapon; the base edge fainter
      // than the tip's, so it reads as the head sweeping round.
      const fade = Math.max(0, 1 - sample.age / TRAIL_SECONDS);
      sample.base.toArray(this.positions, index * 6);
      sample.tip.toArray(this.positions, index * 6 + 3);
      this.fades[index * 2] = fade * 0.35;
      this.fades[index * 2 + 1] = fade;
    });
    const position = this.geometry.getAttribute('position');
    const fade = this.geometry.getAttribute('fade');
    position.needsUpdate = true;
    fade.needsUpdate = true;
    this.geometry.setDrawRange(0, count < 2 ? 0 : (count - 1) * 6);
    this.mesh.visible = count >= 2;
  }
}
