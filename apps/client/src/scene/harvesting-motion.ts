import * as THREE from 'three/webgpu';
import type { CollectedEvent, ItemId } from '@acorn/shared';

export type GatheringHand = (into: THREE.Vector3) => THREE.Vector3 | null;
export const HARVEST_SECONDS = 0.65;
export const isPickedPlant = (item: ItemId): boolean =>
  item === 'flower' || item === 'reed' || item === 'berry' || item === 'mushroom';

interface Receipt {
  readonly event: CollectedEvent;
  readonly hand: GatheringHand;
  readonly at: number;
}
interface PickedPlant {
  readonly id: number;
  readonly item: ItemId;
  readonly x: number;
  readonly z: number;
  readonly object: THREE.Object3D;
  readonly start: THREE.Vector3;
  readonly scale: THREE.Vector3;
  readonly rotation: THREE.Quaternion;
  readonly materials: THREE.Material[];
  age: number;
  hand?: GatheringHand;
}

/** Animate existing pieces only: the server's counts and interaction targets change immediately. */
export class HarvestingMotion {
  readonly group = new THREE.Group();
  private readonly plants: PickedPlant[] = [];
  private readonly receipts: Receipt[] = [];
  private readonly target = new THREE.Vector3();
  private readonly inverse = new THREE.Matrix4();
  private clock = 0;

  collect(event: CollectedEvent, hand: GatheringHand): THREE.Object3D | null {
    if (!isPickedPlant(event.item)) return null;
    // Consume one confirmation per piece, including two players picking the same patch.
    const waiting = this.plants.find(
      (plant) => plant.hand === undefined && this.matches(plant, event),
    );
    if (waiting) {
      waiting.hand = hand;
      return waiting.object;
    }
    this.receipts.push({ event, hand, at: this.clock });
    if (this.receipts.length > 32) this.receipts.shift();
    return null;
  }

  pending(event: CollectedEvent): number {
    return this.receipts.filter((receipt) => this.matches(receipt.event, event)).length;
  }

  detach(id: number, item: ItemId, x: number, z: number, source: THREE.Object3D): void {
    if (!isPickedPlant(item)) return;
    while (this.plants.length >= 32) this.remove(this.plants[0]!);
    source.updateWorldMatrix(true, true);
    this.group.updateWorldMatrix(true, false);
    const object = source.clone(true);
    object.name = 'picked-plant';
    const materials: THREE.Material[] = [];
    // The focus glow owns temporary materials. Never borrow those, or dispose shared geometry.
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const clone = (material: THREE.Material) => {
        const own = material.clone();
        if ('emissiveIntensity' in own) own.emissiveIntensity = 0;
        materials.push(own);
        return own;
      };
      child.material = Array.isArray(child.material)
        ? child.material.map(clone)
        : clone(child.material);
      child.castShadow = false;
    });
    this.inverse
      .copy(this.group.matrixWorld)
      .invert()
      .multiply(source.matrixWorld)
      .decompose(object.position, object.quaternion, object.scale);
    object.visible = true;
    this.group.add(object);
    const receiptIndex = this.receipts.findIndex((r) => this.matches({ item, x, z }, r.event));
    const receipt = receiptIndex < 0 ? undefined : this.receipts.splice(receiptIndex, 1)[0];
    this.plants.push({
      id,
      item,
      x,
      z,
      object,
      start: object.position.clone(),
      scale: object.scale.clone(),
      rotation: object.quaternion.clone(),
      materials,
      age: 0,
      hand: receipt?.hand,
    });
  }

  update(seconds: number, reducedMotion = false): void {
    const dt = Math.max(0, Math.min(seconds, 0.1));
    this.clock += dt;
    while (this.receipts[0] && this.clock - this.receipts[0].at > 0.8) this.receipts.shift();
    for (const plant of [...this.plants]) {
      plant.age += dt;
      if (reducedMotion || plant.age >= HARVEST_SECONDS) {
        this.remove(plant);
        continue;
      }
      const release = Math.max(0, Math.min(1, (plant.age - 0.18) / 0.35));
      const ease = release * release * (3 - 2 * release);
      const hand = plant.hand?.(this.target);
      if (hand) this.group.worldToLocal(hand);
      if (!hand || hand.distanceTo(plant.start) > 3) {
        this.target.copy(plant.start);
        this.target.y += 0.25;
      }
      plant.object.position.lerpVectors(plant.start, this.target, ease);
      plant.object.position.y += Math.sin(release * Math.PI) * 0.08;
      plant.object.quaternion.copy(plant.rotation);
      plant.object.rotateZ(Math.sin(Math.min(1, plant.age / 0.3) * Math.PI) * 0.22);
      const fade = Math.max(0, Math.min(1, (plant.age - 0.46) / 0.19));
      plant.object.scale.copy(plant.scale).multiplyScalar(1 - fade * fade * (3 - 2 * fade));
    }
  }

  forget(id: number): void {
    for (const plant of [...this.plants]) if (plant.id === id) this.remove(plant);
  }
  clear(): void {
    for (const plant of [...this.plants]) this.remove(plant);
    this.receipts.length = 0;
  }
  private matches(plant: Pick<PickedPlant, 'item' | 'x' | 'z'>, event: CollectedEvent): boolean {
    return plant.item === event.item && Math.hypot(plant.x - event.x, plant.z - event.z) < 0.05;
  }
  private remove(plant: PickedPlant): void {
    plant.object.removeFromParent();
    plant.materials.forEach((material) => material.dispose());
    this.plants.splice(this.plants.indexOf(plant), 1);
  }
}
