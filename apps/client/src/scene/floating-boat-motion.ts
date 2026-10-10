import { driftBoat, navigableWaterSurfaceAt, type BoatPlace } from '@acorn/shared';

/** Predict only water drift between server updates, blending small position corrections. */
export class FloatingBoatMotion {
  private readonly place: { x: number; z: number; yaw: number };
  private locked: boolean;
  private correctionX = 0;
  private correctionZ = 0;

  constructor(boat: BoatPlace & { locked?: boolean }) {
    this.place = { ...boat };
    this.locked = boat.locked === true;
  }

  sync(boat: BoatPlace & { locked?: boolean }): void {
    const dx = this.place.x + this.correctionX - boat.x;
    const dz = this.place.z + this.correctionZ - boat.z;
    const close = Math.hypot(dx, dz) < 3;
    this.correctionX = close ? dx : 0;
    this.correctionZ = close ? dz : 0;
    Object.assign(this.place, boat);
    this.locked = boat.locked === true;
  }

  update(deltaSeconds: number, frozen: boolean): { x: number; y: number; z: number; yaw: number } {
    // The renderer can stall while a tab is hidden. Reconcile from the server
    // instead of taking one enormous physics step through a bend on return.
    if (!frozen && !this.locked) driftBoat(this.place, Math.min(deltaSeconds, 0.1));
    const decay = Math.exp(-deltaSeconds * 6);
    this.correctionX *= decay;
    this.correctionZ *= decay;
    const x = this.place.x + this.correctionX,
      z = this.place.z + this.correctionZ;
    return { x, y: navigableWaterSurfaceAt(x, z), z, yaw: this.place.yaw };
  }
}
