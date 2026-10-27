import * as THREE from 'three/webgpu';
import {
  ActionKind,
  CHARGE_TICKS,
  CHOP_FACING_COSINE,
  CHOP_REACH,
  HOLLOW_KING,
  LIGHT_COMBO,
  STRIKE,
  windupTicks,
  type RaiderKindId,
} from '@acorn/shared';
import type { MoveView } from './character-moves';
import type { FootGroundHeight } from './standing-foot-contact';

/** A quiet footprint of the coming blow, following the same buffered body as its weapon. */
export class RaiderDanger {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  private readonly circle: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly cone: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly flat = new Map<THREE.Mesh, Float32Array>();
  private fitted: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    height?: FootGroundHeight;
  } | null = null;

  constructor(
    parent: THREE.Object3D,
    private readonly kind: RaiderKindId,
  ) {
    const king = kind === 'hollowKing';
    const reach = king ? HOLLOW_KING.reach : CHOP_REACH;
    const halfAngle = Math.acos(king ? 0.25 : CHOP_FACING_COSINE);
    this.circle = new THREE.Mesh(
      new THREE.RingGeometry(reach - (king ? 0.14 : 0.08), reach, 48),
      this.material,
    );
    this.cone = new THREE.Mesh(
      new THREE.RingGeometry(0.25, reach, 32, 1, Math.PI / 2 - halfAngle, 2 * halfAngle),
      this.material,
    );
    this.group.name = 'raider-attack-warning';
    this.circle.name = 'whirlwind-warning';
    this.cone.name = 'cleave-warning';
    for (const mesh of [this.circle, this.cone]) {
      mesh.geometry.rotateX(-Math.PI / 2);
      mesh.renderOrder = 2;
      this.flat.set(mesh, new Float32Array(mesh.geometry.getAttribute('position').array));
    }
    this.group.add(this.circle, this.cone);
    this.group.visible = false;
    parent.add(this.group);
  }

  update(
    at: { x: number; y: number; z: number; yaw: number },
    move: Pick<MoveView, 'kind' | 'step' | 'age'>,
    height?: FootGroundHeight,
  ): void {
    const { kind, step, age } = move;
    const spin = kind === ActionKind.Charge || (kind === ActionKind.Strike && age < STRIKE.spinEnd);
    const impact = LIGHT_COMBO[Math.min(Math.max(step, 1), 3) - 1]!.impact;
    // Fade promptly after contact: a recovering skeleton must not keep advertising a live blow.
    const cleave = kind === ActionKind.Windup || (kind === ActionKind.Swing && age < impact + 2);
    this.group.visible = spin || cleave;
    if (!this.group.visible) {
      // A fresh attack refits even if digging changed the ground under a stationary body.
      this.fitted = null;
      return;
    }
    this.group.position.set(at.x, at.y + 0.045, at.z);
    this.group.rotation.y = at.yaw;
    this.circle.visible = spin;
    this.cone.visible = cleave;
    const progress =
      kind === ActionKind.Windup
        ? clamp(age / windupTicks(step))
        : kind === ActionKind.Charge
          ? clamp(age / (this.kind === 'hollowKing' ? HOLLOW_KING.chargeTicks : CHARGE_TICKS))
          : 1;
    const fading = kind === ActionKind.Swing ? 1 - clamp((age - impact) / 2) : 1;
    const strength = this.kind === 'hollowKing' ? 1 : 0.65;
    this.material.opacity =
      (spin ? 0.2 + 0.3 * progress : 0.07 + 0.15 * progress) * fading * strength;
    this.material.color.setHex(spin ? 0xc897ff : 0xffb070);
    this.fitGround(at, height);
  }

  hide(): void {
    this.group.visible = false;
    this.fitted = null;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.circle.geometry.dispose();
    this.cone.geometry.dispose();
    this.material.dispose();
  }

  private fitGround(
    at: { x: number; y: number; z: number; yaw: number },
    height?: FootGroundHeight,
  ) {
    const last = this.fitted;
    // Reuse the fit while stationary and between tiny interpolated corrections.
    if (
      last &&
      last.height === height &&
      Math.hypot(last.x - at.x, last.z - at.z) < 0.04 &&
      Math.abs(last.y - at.y) < 0.02 &&
      Math.abs(last.yaw - at.yaw) < 0.01
    )
      return;
    const cos = Math.cos(at.yaw),
      sin = Math.sin(at.yaw);
    for (const mesh of [this.circle, this.cone]) {
      const positions = mesh.geometry.getAttribute('position');
      const flat = this.flat.get(mesh)!;
      for (let i = 0; i < positions.count; i++) {
        const x = flat[i * 3]!,
          z = flat[i * 3 + 2]!;
        const y = height?.(at.x + x * cos + z * sin, at.z - x * sin + z * cos, at.y) ?? at.y;
        positions.setY(i, Number.isFinite(y) ? y - at.y : 0);
      }
      positions.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    }
    this.fitted = { ...at, height };
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
