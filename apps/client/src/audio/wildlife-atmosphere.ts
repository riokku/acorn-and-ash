import type { AnimalKindId } from '@acorn/shared';
import type { ForestSound } from './forest-atmosphere';
export interface WildlifeListener {
  x: number;
  y: number;
  z: number;
  cameraYaw: number;
  active: boolean;
  indoors: boolean;
}
export interface WildlifeSoundPose {
  x: number;
  y: number;
  z: number;
  speed: number;
  tense: boolean;
  fleeing: boolean;
  defeated: boolean;
}
interface LastAnimal extends WildlifeSoundPose {
  stride: number;
  nextWarning: number;
}

/** Quiet location-based foley, driven by observed motion rather than background timers. */
export class WildlifeAtmosphere {
  private readonly animals = new Map<number, LastAnimal>();
  private listener: WildlifeListener | null = null;
  private previous: WildlifeListener | null = null;
  private clock = 0;
  private budget = 0;
  scheduledSounds = 0;
  constructor(private readonly emit: (event: ForestSound) => void) {}
  beginFrame(delta: number, listener: WildlifeListener): void {
    const previous = this.previous;
    this.previous = { ...listener };
    const reset =
      !listener.active ||
      listener.indoors ||
      !previous?.active ||
      previous.indoors ||
      delta >= 0.25 ||
      (previous &&
        Math.hypot(listener.x - previous.x, listener.y - previous.y, listener.z - previous.z) > 5);
    if (reset) {
      this.animals.clear();
      this.listener = null;
      this.budget = 0;
      return;
    }
    this.listener = listener;
    this.clock += Math.max(0, delta);
    this.budget = 4;
  }
  observe(id: number, kind: AnimalKindId, pose: WildlifeSoundPose): void {
    const listener = this.listener;
    if (!listener) return;
    const hooved = kind === 'elk' || kind === 'cedarStag';
    const previous = this.animals.get(id);
    const distance = previous
      ? Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z)
      : 0;
    const strideLength = hooved ? 0.9 : kind === 'woodlandGuardian' ? 1.1 : 0.5;
    const next: LastAnimal = {
      ...pose,
      stride: previous?.stride ?? 0,
      nextWarning: previous?.nextWarning ?? 0,
    };
    this.animals.set(id, next);
    // Arrival, snapping, corpses and pauses never become footsteps or surprise warnings.
    if (!previous || previous.defeated || distance > 3 || pose.defeated) {
      next.stride = 0;
      return;
    }
    const dx = pose.x - listener.x,
      dz = pose.z - listener.z;
    const gap = Math.hypot(dx, pose.y - listener.y, dz),
      reach = hooved ? 20 : 12;
    const level = Math.max(0, 1 - gap / reach) ** 2;
    if (level < 0.015) {
      next.stride = 0;
      return;
    }
    const pan =
      ((dx * Math.cos(listener.cameraYaw) + dz * Math.sin(listener.cameraYaw)) / Math.max(1, gap)) *
      0.8;
    const warning =
      (hooved && pose.tense && !previous.tense) || (pose.fleeing && !previous.fleeing);
    if (warning && this.clock >= next.nextWarning) {
      this.sound(hooved && pose.tense ? 'snort' : 'brush', level * 0.55, pan);
      next.nextWarning = this.clock + 4;
    }
    if (pose.speed < 0.15 || distance < 0.001) return;
    next.stride += distance;
    if (next.stride >= strideLength) {
      next.stride %= strideLength;
      this.sound(hooved ? 'hoof' : 'brush', level * (pose.fleeing ? 0.48 : 0.25), pan);
    }
  }
  private sound(cue: 'hoof' | 'brush' | 'snort', volume: number, pan: number): void {
    if (this.budget <= 0) return;
    this.budget--;
    this.scheduledSounds++;
    this.emit({ kind: 'wildlife', cue, volume, pan });
  }
  forget(id: number): void {
    this.animals.delete(id);
  }
  clear(): void {
    this.animals.clear();
    this.previous = null;
    this.listener = null;
    this.budget = 0;
  }
}
