import type * as THREE from 'three/webgpu';

import { navigableWaterSurfaceAt, boatYawFor } from '@acorn/shared';

import { createRowboat, type Rowboat } from './rowboat';

interface DrawnBoat {
  readonly boat: Rowboat;
  seen: boolean;
}

/**
 * The boat under everybody who is rowing one (see decision 0093).
 *
 * A boat being rowed is not where it was moored: the moored boat is hidden
 * while somebody has it, and this one is drawn under the rider instead,
 * wherever they are this frame, so it moves exactly as smoothly as they do.
 */
export class RowingBoats {
  private readonly drawn = new Map<number, DrawnBoat>();

  constructor(private readonly parent: THREE.Object3D) {}

  /** A boat under this rider this frame, turned the way they face. Its rider owns the held paddle. */
  place(netId: number, x: number, z: number, facingYaw: number): void {
    let entry = this.drawn.get(netId);
    if (entry === undefined) {
      const boat = createRowboat();
      this.parent.add(boat.group);
      boat.setOccupied(true);
      entry = { boat, seen: true };
      this.drawn.set(netId, entry);
    }
    entry.seen = true;
    entry.boat.group.position.set(x, navigableWaterSurfaceAt(x, z), z);
    entry.boat.group.rotation.y = boatYawFor(facingYaw);
  }

  /**
   * Once everybody this frame has been placed: take away the boats of
   * anybody who is not rowing any more.
   */
  sweep(): void {
    for (const [netId, entry] of this.drawn) {
      if (entry.seen) {
        entry.seen = false;
        continue;
      }
      this.parent.remove(entry.boat.group);
      entry.boat.dispose();
      this.drawn.delete(netId);
    }
  }

  /** Every boat drawn under a rider right now, for tests to look at. */
  drawnBoats(): Array<{ netId: number; x: number; z: number; yaw: number }> {
    return [...this.drawn].map(([netId, { boat }]) => ({
      netId,
      x: boat.group.position.x,
      z: boat.group.position.z,
      yaw: boat.group.rotation.y,
    }));
  }

  dispose(): void {
    for (const entry of this.drawn.values()) {
      this.parent.remove(entry.boat.group);
      entry.boat.dispose();
    }
    this.drawn.clear();
  }
}
