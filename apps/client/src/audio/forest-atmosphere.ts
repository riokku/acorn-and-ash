import type { ForestEnvironment, ForestPoint, FootstepSurface } from './forest-environment';

export type ForestSound =
  | { kind: 'step'; surface: FootstepSurface; volume: number; pan: number }
  | { kind: 'bird' | 'rustle'; volume: number; pan: number; variant: number };
export interface ForestListener extends ForestPoint {
  readonly grounded: boolean;
  readonly y?: number;
  readonly indoors: boolean;
  readonly active: boolean;
  readonly night: boolean;
  readonly cameraYaw: number;
  readonly stridePhase?: number | null;
  readonly snow?: boolean;
  readonly precipitation?: number;
  readonly frozenWater?: boolean;
  readonly threatened?: boolean;
}

/** Cosmetic scheduling uses the existing frame, never background timers. */
export class ForestAtmosphere {
  private previous: ForestListener | null = null;
  private stride = 0;
  private airborneSeconds = 0;
  private brushDistance = 0;
  private birdIn = 5;
  private rustleIn = 2;
  private foot = 1;
  private contactPhase: number | null = null;
  scheduledSteps = 0;
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
      this.airborneSeconds = 0;
      this.stride = this.brushDistance = 0;
      this.contactPhase = listener.active ? (listener.stridePhase ?? null) : null;
      // No old calls replay after a pause, space change or background tab.
      this.birdIn = 4 + this.random() * 5;
      this.rustleIn = 1.5 + this.random() * 3;
      return;
    }
    const distance = Math.hypot(listener.x - previous.x, listener.z - previous.z);
    if (distance > 2) {
      this.airborneSeconds = 0;
      this.stride = this.brushDistance = 0;
      this.contactPhase = null;
      return;
    }
    if (listener.grounded) {
      const landed = !previous.grounded;
      const running = distance / Math.max(delta, 0.001) > 5;
      let contacted = false;
      if (listener.stridePhase === undefined) {
        this.contactPhase = null;
        // Placeholder models retain distance-based feedback until a rig is available.
        this.stride += previous.grounded ? distance : 0;
        contacted = this.stride >= (running ? 2.1 : 1.55);
        if (contacted) this.foot *= -1;
      } else {
        this.stride = 0;
        const before = this.contactPhase;
        const phase = listener.stridePhase;
        if (phase !== null && before !== null) {
          contacted = phase < before || (before < 0.5 && phase >= 0.5);
          if (contacted) this.foot = phase < before ? -1 : 1;
        }
        if (phase !== null) this.contactPhase = phase;
      }
      if (landed || contacted) {
        this.stride = 0;
        const ground = listener.indoors
          ? 'wood'
          : (environment?.surfaceAt(listener.x, listener.z, listener.y) ?? 'grass');
        const surface =
          ground === 'water' && listener.frozenWater
            ? 'ice'
            : ground === 'water' || listener.indoors
              ? ground
              : listener.snow
                ? 'snow'
                : ground;
        this.scheduledSteps++;
        this.emit({
          kind: 'step',
          surface,
          volume: landed ? Math.min(0.95, 0.45 + this.airborneSeconds * 0.55) : running ? 0.7 : 0.5,
          pan: landed ? 0 : this.foot * 0.06,
        });
      }
      this.airborneSeconds = 0;
    } else {
      this.airborneSeconds += delta;
      this.stride = 0;
      this.contactPhase = null;
    }
    if (listener.indoors || environment === null) return;
    const trees = environment.treesNear(listener.x, listener.z);
    this.birdIn -= delta;
    this.rustleIn -= delta;
    if (this.birdIn <= 0) {
      this.birdIn =
        ((listener.night ? 30 : 9) + this.random() * (listener.night ? 30 : 13)) *
        (1 + Math.max(0, Math.min(1, listener.precipitation ?? 0)) * 2 + (listener.snow ? 0.5 : 0));
      const tree = trees[Math.floor(this.random() * trees.length)];
      if (tree !== undefined && !listener.night && !listener.threatened)
        this.spatial(
          'bird',
          tree,
          listener,
          0.48 * (1 - Math.max(0, Math.min(1, listener.precipitation ?? 0)) * 0.7),
          32,
        );
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
      if (nearest !== undefined)
        this.spatial('rustle', nearest, listener, listener.threatened ? 0.09 : 0.26, 18);
    }
    this.brushDistance += listener.grounded ? distance : 0;
    if (nearestDistance < 3.5 && this.brushDistance >= 3 && nearest !== undefined) {
      this.brushDistance = 0;
      this.spatial('rustle', nearest, listener, listener.threatened ? 0.11 : 0.32, 8);
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
