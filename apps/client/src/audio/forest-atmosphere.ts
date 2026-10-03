import type { ForestEnvironment, ForestPoint, FootstepSurface } from './forest-environment';

export type ForestSound =
  | { kind: 'step'; surface: FootstepSurface; volume: number; pan: number }
  | { kind: 'bird' | 'rustle'; volume: number; pan: number; variant: number };
export interface ForestListener extends ForestPoint {
  readonly grounded: boolean;
  readonly indoors: boolean;
  readonly active: boolean;
  readonly night: boolean;
  readonly cameraYaw: number;
}

/** Cosmetic scheduling uses the existing frame, never background timers. */
export class ForestAtmosphere {
  private previous: ForestListener | null = null;
  private stride = 0;
  private brushDistance = 0;
  private birdIn = 5;
  private rustleIn = 2;
  private foot = 1;
  constructor(
    private readonly emit: (event: ForestSound) => void,
    private readonly random: () => number = Math.random,
  ) {}

  update(delta: number, listener: ForestListener, environment: ForestEnvironment | null): void {
    const previous = this.previous;
    this.previous = { ...listener };
    if (
      !listener.active ||
      delta >= 0.25 ||
      previous === null ||
      !previous.active ||
      previous.indoors !== listener.indoors
    ) {
      this.stride = this.brushDistance = 0;
      // No old calls replay after a pause, space change or background tab.
      this.birdIn = 4 + this.random() * 5;
      this.rustleIn = 1.5 + this.random() * 3;
      return;
    }
    const distance = Math.hypot(listener.x - previous.x, listener.z - previous.z);
    if (distance > 2) {
      this.stride = this.brushDistance = 0;
      return;
    }
    const surface = listener.indoors
      ? 'wood'
      : (environment?.surfaceAt(listener.x, listener.z) ?? 'grass');
    if (listener.grounded) {
      const landed = !previous.grounded;
      this.stride += previous.grounded ? distance : 0;
      const running = distance / Math.max(delta, 0.001) > 5;
      if (landed || this.stride >= (running ? 2.1 : 1.55)) {
        this.stride = 0;
        this.foot *= -1;
        this.emit({
          kind: 'step',
          surface,
          volume: landed ? 0.8 : running ? 0.7 : 0.5,
          pan: this.foot * 0.06,
        });
      }
    } else this.stride = 0;
    if (listener.indoors || environment === null) return;
    const trees = environment.treesNear(listener.x, listener.z);
    this.birdIn -= delta;
    this.rustleIn -= delta;
    if (this.birdIn <= 0) {
      this.birdIn = (listener.night ? 30 : 9) + this.random() * (listener.night ? 30 : 13);
      const tree = trees[Math.floor(this.random() * trees.length)];
      if (tree !== undefined && !listener.night) this.spatial('bird', tree, listener, 0.48, 32);
    }
    let nearest: ForestPoint | undefined;
    let nearestDistance = 16;
    for (const tree of trees) {
      const gap = Math.hypot(tree.x - listener.x, tree.z - listener.z);
      if (gap < nearestDistance) {
        nearest = tree;
        nearestDistance = gap;
      }
    }
    if (this.rustleIn <= 0) {
      this.rustleIn = 4 + this.random() * 7;
      if (nearest !== undefined) this.spatial('rustle', nearest, listener, 0.26, 18);
    }
    this.brushDistance += listener.grounded ? distance : 0;
    if (nearestDistance < 3.5 && this.brushDistance >= 3 && nearest !== undefined) {
      this.brushDistance = 0;
      this.spatial('rustle', nearest, listener, 0.32, 8);
      this.rustleIn = Math.max(this.rustleIn, 2);
    }
  }

  private spatial(
    kind: 'bird' | 'rustle',
    source: ForestPoint,
    listener: ForestListener,
    level: number,
    reach: number,
  ): void {
    const dx = source.x - listener.x,
      dz = source.z - listener.z;
    const distance = Math.hypot(dx, dz);
    const volume = level * Math.max(0, 1 - distance / reach) ** 1.5;
    if (volume < 0.005) return;
    const pan =
      (dx * Math.cos(listener.cameraYaw) + dz * Math.sin(listener.cameraYaw)) /
      Math.max(1, distance);
    this.emit({ kind, volume, pan: pan * 0.8, variant: Math.floor(this.random() * 3) });
  }
}
