import {
  LAKE,
  POND,
  POND_LEVEL,
  defineLake,
  STREAM,
  lakeDepthAt,
  nearestOnStream,
  streamFlowPaceAt,
  streamPointAt,
  streamPools,
} from '@acorn/shared';
import { effectsVolume, noiseBuffer, registerSustainedEffect, soundContext } from './sound';

export interface AmbienceListener {
  readonly x: number;
  readonly z: number;
  readonly cameraYaw: number;
  readonly wind: number;
  readonly cover: number;
  readonly indoors: boolean;
  readonly frozen: boolean;
  readonly underground: number;
  readonly threatened?: boolean;
}
export interface AmbienceLevels {
  water: number;
  wind: number;
  pan: number;
  muffled: boolean;
  waterTone: number;
}
const falls = STREAM.falls.map((fall) =>
  streamPointAt(STREAM, Math.round((fall.at / STREAM.length) * (STREAM.count - 1))),
);

/** Sample the actual union boundary once; overlapping circles do not become phantom shores. */
const shores = [LAKE, ...streamPools(STREAM), defineLake(POND_LEVEL, POND, [])].flatMap((lake) => {
  const points: Array<{ x: number; z: number }> = [];
  for (const circle of [...lake.basin, ...lake.islands.flatMap((island) => island.lobes)]) {
    const count = Math.min(96, Math.max(24, Math.ceil((2 * Math.PI * circle.radius) / 3)));
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2;
      const x = circle.x + Math.cos(angle) * circle.radius;
      const z = circle.z + Math.sin(angle) * circle.radius;
      if (Math.abs(lakeDepthAt(lake, x, z)) < 0.1) points.push({ x, z });
    }
  }
  return points;
});

/** Bounded, world-anchored mix, sampled four times a second rather than every frame. */
export function ambienceAt(listener: AmbienceListener): AmbienceLevels {
  let water = 0,
    weightedPan = 0,
    weightedTone = 0,
    weight = 0;
  const cos = Math.cos(listener.cameraYaw),
    sin = Math.sin(listener.cameraYaw);
  const add = (x: number, z: number, level: number, tone: number) => {
    if (level <= 0) return;
    const dx = x - listener.x,
      dz = z - listener.z;
    const energy = level * level;
    water = Math.max(water, level);
    weightedPan += ((dx * cos + dz * sin) / Math.max(1, Math.hypot(dx, dz))) * energy;
    weightedTone += tone * energy;
    weight += energy;
  };
  const stream = nearestOnStream(STREAM, listener.x, listener.z, 24);
  if (stream) {
    const pace = Math.min(1.8, streamFlowPaceAt(STREAM, stream.along));
    add(stream.x, stream.z, 0.028 * (1 - stream.distance / 24) ** 2, 1200 + pace * 900);
  }
  for (const fall of falls) {
    const distance = Math.hypot(fall.x - listener.x, fall.z - listener.z);
    add(fall.x, fall.z, 0.065 * Math.max(0, 1 - distance / 55) ** 2, 3100);
  }
  for (const shore of shores) {
    const distance = Math.hypot(shore.x - listener.x, shore.z - listener.z);
    if (distance < 18) add(shore.x, shore.z, 0.012 * (1 - distance / 18) ** 2, 850);
  }
  const shelter =
    (listener.indoors ? 0.12 : 1) * (1 - Math.max(0, Math.min(1, listener.underground)));
  const wind =
    Math.min(1, Math.max(0, listener.wind)) *
    (1 - Math.min(1, Math.max(0, listener.cover)) * 0.7) *
    0.026;
  return {
    water: listener.frozen ? 0 : water * shelter * (listener.threatened ? 0.55 : 1),
    wind: wind * shelter * (listener.threatened ? 0.45 : 1),
    pan: weight === 0 ? 0 : (weightedPan / weight) * 0.75,
    waterTone: weight === 0 ? 850 : weightedTone / weight,
    muffled: listener.indoors || listener.underground > 0.2,
  };
}

interface Voice {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  pan: StereoPannerNode;
}
/** Two sustained voices at most. No timers, fetches or unbounded sound spawning. */
export class WorldAmbience {
  private voices: Voice[] = [];
  private context: AudioContext | null = null;
  private unregister: (() => void) | null = null;
  private sampleIn = 0;
  private levels: AmbienceLevels | null = null;
  private wasIndoors: boolean | null = null;
  private wasFrozen: boolean | null = null;
  private wasThreatened = false;
  private lastVolume = -1;
  private active = false;

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.stop();
  }
  update(delta: number, listener: AmbienceListener, active: boolean): void {
    this.setActive(active);
    const volume = effectsVolume();
    if (!this.active || volume <= 0) {
      this.stop();
      return;
    }
    this.sampleIn -= Math.max(0, delta);
    if (
      this.levels === null ||
      this.sampleIn <= 0 ||
      this.wasIndoors !== listener.indoors ||
      this.wasFrozen !== listener.frozen ||
      this.wasThreatened !== Boolean(listener.threatened) ||
      volume !== this.lastVolume
    ) {
      this.sampleIn = 0.25;
      this.levels = ambienceAt(listener);
      this.wasIndoors = listener.indoors;
      this.wasFrozen = listener.frozen;
      this.wasThreatened = Boolean(listener.threatened);
      this.lastVolume = volume;
      if (this.voices.length === 0 && this.levels.water + this.levels.wind > 0.0001) this.start();
      if (this.context)
        for (const [i, voice] of this.voices.entries()) {
          voice.gain.gain.setTargetAtTime(
            (i === 0 ? this.levels.water : this.levels.wind) * volume,
            this.context.currentTime,
            listener.threatened ? 0.15 : 0.7,
          );
          voice.pan.pan.setTargetAtTime(
            i === 0 ? this.levels.pan : 0,
            this.context.currentTime,
            0.3,
          );
          voice.filter.frequency.setTargetAtTime(
            this.levels.muffled ? 360 : i === 0 ? this.levels.waterTone : 850,
            this.context.currentTime,
            0.4,
          );
        }
    }
  }
  private start(): void {
    this.context = soundContext();
    if (!this.context) return;
    const context = this.context;
    for (let i = 0; i < 2; i++) {
      const source = context.createBufferSource(),
        filter = context.createBiquadFilter(),
        gain = context.createGain(),
        pan = context.createStereoPanner();
      source.buffer = noiseBuffer(context);
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = i === 0 ? 2400 : 850;
      filter.Q.value = 0.35;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(pan).connect(context.destination);
      source.start(0, i * 0.23);
      this.voices.push({ source, filter, gain, pan });
    }
    this.unregister = registerSustainedEffect(() => this.stop());
  }
  private stop(): void {
    this.unregister?.();
    this.unregister = null;
    for (const { source, filter, gain, pan } of this.voices) {
      source.stop();
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan.disconnect();
    }
    this.voices = [];
    this.levels = null;
    this.context = null;
    this.sampleIn = 0;
  }
  dispose(): void {
    this.setActive(false);
  }
}
