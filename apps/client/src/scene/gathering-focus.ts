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
  private dirty = true;
  private refitDue = 0;
  private readonly fittedAt = new THREE.Vector3(Infinity, Infinity, Infinity);
  private readonly position = new THREE.Vector3();
  private readonly materials: Array<{
    mesh: THREE.Mesh;
    original: THREE.Material | THREE.Material[];
    highlighted: THREE.Material[];
  }> = [];

  constructor(private readonly groundAt?: (x: number, z: number, referenceY: number) => number) {
    this.ring.geometry.rotateX(-Math.PI / 2);
    this.group.add(this.ring);
    this.group.visible = false;
  }

  setTarget(target: THREE.Object3D | null, radius = 0.4, blocked = false): void {
    if (target !== this.target) {
      this.dirty = true;
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
    if (this.radius !== radius) this.dirty = true;
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
    if (this.dirty || !this.fittedAt.equals(this.position) || this.age >= this.refitDue) {
      const positions = this.ring.geometry.getAttribute('position');
      for (let vertex = 0; vertex < positions.count; vertex++) {
        // RingGeometry stores the inner rim first, then the outer rim.
        const angle = ((vertex % 49) / 48) * Math.PI * 2;
        const radius = (vertex < 49 ? 0.85 : 1) * this.radius;
        const x = Math.cos(angle) * radius,
          z = -Math.sin(angle) * radius;
        const ground =
          this.groundAt?.(this.position.x + x, this.position.z + z, this.position.y) ??
          this.position.y;
        positions.setXYZ(vertex, x, ground - this.position.y + 0.025, z);
      }
      positions.needsUpdate = true;
      this.ring.geometry.computeBoundingSphere();
      this.fittedAt.copy(this.position);
      this.dirty = false;
      this.refitDue = this.age + 0.25;
    }
    // Pulse opacity, not footprint size: scaling fitted vertices would lift
    // or bury the ring again on a hillside.
    this.ring.material.opacity = 0.78 + Math.sin(this.age * 3.5) * 0.07;
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
