import * as THREE from 'three/webgpu';
import {
  color,
  cos,
  float,
  mix,
  sin,
  smoothstep,
  uniform,
  uv,
  vec3,
  positionLocal,
} from 'three/tsl';
import { wornWeapon } from './gear-models';

export const KING_VICTORY_SECONDS = 11;
/** A reusable, prewarmed celebration in the live renderer; it never owns shared weapon assets. */
export class KingVictoryEffect {
  readonly group = new THREE.Group();
  private readonly elapsed = uniform(0);
  private readonly rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly ribbons: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicNodeMaterial>[] = [];
  private readonly weapon = new THREE.Group();
  private readonly sparkMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe6aa,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly sparks = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.055),
    this.sparkMaterial,
    72,
  );
  private readonly transform = new THREE.Object3D();
  private reduced = false;
  constructor() {
    this.group.name = 'hollow-king-victory';
    this.group.visible = false;
    for (let i = 0; i < 3; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xd6a9ff : 0x9ff8ee,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.07 + i * 0.02;
      ring.frustumCulled = false;
      this.rings.push(ring);
      this.group.add(ring);
    }
    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.PlaneGeometry(0.22, 1, 1, 80);
      const material = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const rise = uv().y.add(this.elapsed.mul(0.13)).fract();
      const angle = rise
        .mul(14)
        .add(this.elapsed.mul(0.6))
        .add((i * Math.PI * 2) / 3);
      const radius = float(1).sub(rise).mul(3.3).add(0.35);
      material.positionNode = vec3(
        cos(angle).mul(radius).add(positionLocal.x),
        rise.mul(12),
        sin(angle).mul(radius),
      );
      material.colorNode = mix(color(0x8173ed), color(0xb7fff4), rise).mul(1.7);
      material.opacityNode = float(1)
        .sub(uv().x.sub(0.5).abs().mul(2))
        .pow(0.7)
        .mul(sin(rise.mul(Math.PI)).max(0))
        .mul(smoothstep(0.5, 1.8, this.elapsed))
        .mul(float(1).sub(smoothstep(7, 10, this.elapsed)))
        .mul(0.65);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      this.ribbons.push(mesh);
      this.group.add(mesh);
    }
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks, this.weapon);
    // The actual enchanted blade, rendered by the existing scene, without another canvas/context.
    for (const part of wornWeapon('kingsRequiem')?.parts ?? []) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.frustumCulled = false;
      this.weapon.add(mesh);
    }
  }
  start(at: { x: number; y: number; z: number }, reduced = false): void {
    this.reduced = reduced;
    this.group.position.set(at.x, at.y, at.z);
    this.group.visible = true;
    this.update(0);
  }
  update(seconds: number): void {
    this.elapsed.value = seconds;
    this.group.visible = seconds >= 0 && seconds < KING_VICTORY_SECONDS;
    const fade = Math.max(0, Math.min(1, (KING_VICTORY_SECONDS - seconds) / 1.5));
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i]!;
      const t = Math.max(0, seconds - 0.55 - i * 0.35);
      const expansion = this.reduced ? 4 + i : 1 + Math.min(t / 2, 1) * (16 + i * 3);
      ring.scale.setScalar(expansion);
      ring.material.opacity = t > 0 ? Math.max(0, 1 - t / 3) * 0.65 * fade : 0;
    }
    for (const ribbon of this.ribbons) ribbon.visible = !this.reduced;
    const reveal = this.reduced
      ? seconds >= 2.7
        ? 1
        : 0
      : Math.max(0, Math.min(1, (seconds - 2.7) / 1.1));
    this.weapon.visible = reveal > 0 && seconds < 10;
    this.weapon.scale.setScalar(
      2.8 * reveal * (this.reduced ? 1 : Math.min(1, Math.max(0, (10 - seconds) / 1.2))),
    );
    this.weapon.position.y = this.reduced ? 2 : 1.2 + reveal * 1.6 + Math.sin(seconds * 1.3) * 0.12;
    this.weapon.rotation.y = this.reduced ? 0 : seconds * 0.45;
    this.sparks.count = this.reduced ? 8 : 72;
    this.sparkMaterial.opacity = Math.min(1, seconds) * fade * 0.8;
    for (let i = 0; i < this.sparks.count; i++) {
      const phase = this.reduced ? i / 8 : (((seconds * 0.14 + i / 72) % 1) + 1) % 1;
      const angle = i * 2.39996 + (this.reduced ? 0 : seconds * 0.35);
      const radius = (1 - phase) * 4 + 0.4;
      this.transform.position.set(
        Math.cos(angle) * radius,
        phase * 10 + 0.15,
        Math.sin(angle) * radius,
      );
      this.transform.scale.setScalar(Math.sin(phase * Math.PI) * (0.65 + (i % 4) * 0.2));
      this.transform.rotation.set(
        this.reduced ? 0 : seconds + i,
        0,
        this.reduced ? 0 : seconds * 0.5,
      );
      this.transform.updateMatrix();
      this.sparks.setMatrixAt(i, this.transform.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
  }
  clear(): void {
    this.group.visible = false;
  }
  dispose(): void {
    this.group.removeFromParent();
    for (const mesh of this.rings) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const mesh of this.ribbons) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.sparks.geometry.dispose();
    this.sparkMaterial.dispose();
    this.sparks.dispose();
    this.group.clear();
  }
}
