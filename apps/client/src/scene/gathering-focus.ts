import * as THREE from 'three/webgpu';

/** A glow on just the next item E will take, with a small ground marker. */
export class GatheringFocus {
  readonly group = new THREE.Group();
  private readonly ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffdf98,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  private target: THREE.Object3D | null = null;
  private radius = 0.4;
  private age = 0;
  private readonly position = new THREE.Vector3();
  private readonly materials: Array<{
    mesh: THREE.Mesh;
    original: THREE.Material | THREE.Material[];
    highlighted: THREE.Material[];
  }> = [];

  constructor() {
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.ring);
    this.group.visible = false;
  }

  setTarget(target: THREE.Object3D | null, radius = 0.4, blocked = false): void {
    if (target !== this.target) {
      this.restore();
      this.target = target;
      target?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const original = object.material as THREE.Material | THREE.Material[];
        const highlighted = (Array.isArray(original) ? original : [original]).map((material) =>
          material.clone(),
        );
        object.material = Array.isArray(original) ? highlighted : highlighted[0]!;
        this.materials.push({ mesh: object, original, highlighted });
      });
    }
    this.radius = radius;
    const tint = blocked ? 0xe6aa72 : 0xffdf98;
    this.ring.material.color.set(tint);
    for (const entry of this.materials)
      for (const material of entry.highlighted) {
        if ('emissive' in material && material.emissive instanceof THREE.Color) {
          material.emissive.set(tint);
          (material as THREE.MeshStandardMaterial).emissiveIntensity = 0.28;
        }
      }
    this.group.visible = target !== null;
  }

  update(deltaSeconds: number): void {
    if (this.target === null) return;
    this.age += deltaSeconds;
    this.target.updateWorldMatrix(true, false);
    this.target.getWorldPosition(this.position);
    this.group.position.copy(this.position);
    this.group.position.y += 0.025;
    this.ring.scale.setScalar(this.radius * (1 + Math.sin(this.age * 3.5) * 0.035));
  }

  private restore(): void {
    for (const entry of this.materials) {
      entry.mesh.material = entry.original;
      for (const material of entry.highlighted) material.dispose();
    }
    this.materials.length = 0;
  }

  dispose(): void {
    this.restore();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
  }
}
