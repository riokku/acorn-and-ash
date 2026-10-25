import * as THREE from 'three/webgpu';
import {
  color,
  cos,
  sin,
  float,
  uniform,
  uv,
  vec3,
  normalWorld,
  positionWorld,
  cameraPosition,
} from 'three/tsl';
import {
  CROWNBREAKER_HOLD,
  KING_WARDS,
  SOUL_STORM,
  type KingStormView,
  type Terrain,
} from '@acorn/shared';

/** Reusable runtime ward/shroud overlays around the existing broken-stone cairns. */
export class KingStormEffect {
  readonly group = new THREE.Group();
  private readonly age = uniform(0);
  private readonly strength = uniform(0);
  private readonly owned: THREE.Mesh[] = [];
  private readonly wards: THREE.Mesh[] = [];
  private readonly boundary: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly ribbons: THREE.Mesh[] = [];
  constructor(terrain: Terrain) {
    this.group.name = 'hollow-king-soul-storm';
    this.group.visible = false;
    const center = CROWNBREAKER_HOLD;
    const ground = terrain.heightAt(center.x, center.z);
    this.group.position.set(center.x, ground, center.z);
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0xc6a3fa,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.boundary = new THREE.Mesh(
      new THREE.RingGeometry(SOUL_STORM.radius - 0.2, SOUL_STORM.radius, 128),
      edgeMaterial,
    );
    this.boundary.geometry.rotateX(-Math.PI / 2);
    const edge = this.boundary.geometry.getAttribute('position');
    for (let i = 0; i < edge.count; i++)
      edge.setY(i, terrain.heightAt(center.x + edge.getX(i), center.z + edge.getZ(i)) - ground);
    this.boundary.geometry.computeVertexNormals();
    this.boundary.position.y = 0.05;
    this.add(this.boundary);
    for (const ward of KING_WARDS) {
      const dx = ward.x - center.x,
        dz = ward.z - center.z,
        y = terrain.heightAt(ward.x, ward.z) - ground;
      const material = new THREE.MeshBasicMaterial({
        color: 0x80f7d7,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(SOUL_STORM.shelterRadius - 0.16, SOUL_STORM.shelterRadius, 72),
        material,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(dx, y + 0.09, dz);
      this.add(ring);
      this.wards.push(ring);
      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(SOUL_STORM.shelterRadius, 72),
        new THREE.MeshBasicMaterial({
          color: 0x56dcb5,
          transparent: true,
          opacity: 0.07,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(dx, y + 0.07, dz);
      this.add(fill);
      this.wards.push(fill);
      const shieldMaterial = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      shieldMaterial.colorNode = color(0x89ffe2);
      const view = cameraPosition.sub(positionWorld).normalize();
      shieldMaterial.opacityNode = float(1).sub(normalWorld.dot(view).abs()).pow(3).mul(0.22);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(SOUL_STORM.shelterRadius, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        shieldMaterial,
      );
      dome.position.set(dx, y + 0.07, dz);
      this.add(dome);
      this.wards.push(dome);
    }
    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const rise = uv().y;
      const angle = rise
        .mul(3)
        .add(this.age.mul(0.18))
        .add((i * Math.PI) / 2);
      const radius = rise.mul(-3).add(SOUL_STORM.radius - 1);
      const spread = radius.add(uv().x.sub(0.5).mul(1.4));
      material.positionNode = vec3(cos(angle).mul(spread), rise.mul(9), sin(angle).mul(spread));
      // Across the ribbon's width, a small radial offset; no square flame/sprite edges.
      const geometry = new THREE.PlaneGeometry(1.4, 1, 1, 70);

      material.colorNode = color(0xb19aef).mul(1.4);
      material.opacityNode = sin(rise.mul(Math.PI))
        .max(0)
        .mul(float(1).sub(uv().x.sub(0.5).abs().mul(2)))
        .mul(this.strength);
      const ribbon = new THREE.Mesh(geometry, material);
      this.add(ribbon);
      this.ribbons.push(ribbon);
    }
  }
  private add(mesh: THREE.Mesh): void {
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.owned.push(mesh);
  }
  update(storm: KingStormView | null, seconds: number, reduced = false): void {
    this.group.visible = storm !== null;
    if (!storm) return;
    this.age.value = reduced ? 0 : seconds;
    this.strength.value = storm.phase === 'storm' ? 0.45 : 0.12;
    this.boundary.material.opacity = storm.phase === 'storm' ? 0.6 : 0.3;
    for (const ward of this.wards) ward.visible = storm.phase !== 'recovery';
    for (const ribbon of this.ribbons) ribbon.visible = !reduced && storm.phase !== 'recovery';
    if (storm.phase === 'recovery') this.boundary.material.opacity = 0.12;
  }
  clear(): void {
    this.group.visible = false;
  }
  dispose(): void {
    this.group.removeFromParent();
    for (const mesh of this.owned) {
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    }
    this.group.clear();
  }
}
