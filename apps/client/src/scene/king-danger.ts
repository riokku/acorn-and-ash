import * as THREE from 'three/webgpu';
import { ActionKind, HOLLOW_KING, STRIKE } from '@acorn/shared';

/** Danger follows the interpolated body, using the same reach and cone as damage. */
export class KingDanger {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshBasicMaterial({
    color: 0xff8759,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly circle = new THREE.Mesh(
    new THREE.RingGeometry(HOLLOW_KING.reach - 0.12, HOLLOW_KING.reach, 72),
    this.material,
  );
  private readonly cone = new THREE.Mesh(
    new THREE.RingGeometry(
      0.5,
      HOLLOW_KING.reach,
      48,
      1,
      Math.PI / 2 - Math.acos(0.25),
      2 * Math.acos(0.25),
    ),
    this.material,
  );
  constructor(parent: THREE.Object3D) {
    for (const mesh of [this.circle, this.cone]) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 2;
    }
    this.group.add(this.circle, this.cone);
    this.group.visible = false;
    parent.add(this.group);
  }
  update(at: { x: number; y: number; z: number; yaw: number }, kind: ActionKind, age: number) {
    const spin = kind === ActionKind.Charge || (kind === ActionKind.Strike && age < STRIKE.spinEnd);
    const cleave = kind === ActionKind.Windup || kind === ActionKind.Swing;
    this.group.visible = spin || cleave;
    this.group.position.set(at.x, at.y + 0.045, at.z);
    this.group.rotation.y = at.yaw;
    this.circle.visible = spin;
    this.cone.visible = cleave;
    this.material.opacity = spin ? 0.48 : 0.12;
    this.material.color.setHex(spin ? 0xc897ff : 0xff8759);
  }
  dispose() {
    this.group.removeFromParent();
    this.circle.geometry.dispose();
    this.cone.geometry.dispose();
    this.material.dispose();
  }
}
