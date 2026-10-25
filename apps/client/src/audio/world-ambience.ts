import { STREAM, nearestOnStream, streamPointAt } from '@acorn/shared';
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
}
export interface AmbienceLevels {
  water: number;
  wind: number;
  pan: number;
  muffled: boolean;
}
const falls = STREAM.falls.map((fall) =>
  streamPointAt(STREAM, Math.round((fall.at / STREAM.length) * (STREAM.count - 1))),
);

/** Bounded, world-anchored mix, sampled four times a second rather than every frame. */
export function ambienceAt(listener: AmbienceListener): AmbienceLevels {
  const stream = nearestOnStream(STREAM, listener.x, listener.z, 24);
  let water = stream === null ? 0 : 0.028 * (1 - stream.distance / 24) ** 2;
  let source = stream;
  for (const fall of falls) {
    const distance = Math.hypot(fall.x - listener.x, fall.z - listener.z);
    const level = 0.065 * Math.max(0, 1 - distance / 55) ** 2;
    if (level > water) {
      water = level;
      source = { ...fall, distance, along: 0 };
    }
  }
  const shelter =
    (listener.indoors ? 0.12 : 1) * (1 - Math.max(0, Math.min(1, listener.underground)));
  const wind =
    Math.min(1, Math.max(0, listener.wind)) *
    (1 - Math.min(1, Math.max(0, listener.cover)) * 0.7) *
    0.026;
  const dx = (source?.x ?? listener.x) - listener.x,
    dz = (source?.z ?? listener.z) - listener.z;
  const pan =
    (dx * Math.cos(listener.cameraYaw) + dz * Math.sin(listener.cameraYaw)) /
    Math.max(1, Math.hypot(dx, dz));
  return {
    water: listener.frozen ? 0 : water * shelter,
    wind: wind * shelter,
    pan: pan * 0.75,
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
      volume !== this.lastVolume
    ) {
      this.sampleIn = 0.25;
      this.levels = ambienceAt(listener);
      this.wasIndoors = listener.indoors;
      this.wasFrozen = listener.frozen;
      this.lastVolume = volume;
      if (this.voices.length === 0 && this.levels.water + this.levels.wind > 0.0001) this.start();
      if (this.context)
        for (const [i, voice] of this.voices.entries()) {
          voice.gain.gain.setTargetAtTime(
            (i === 0 ? this.levels.water : this.levels.wind) * volume,
            this.context.currentTime,
            0.45,
          );
          voice.pan.pan.setTargetAtTime(
            i === 0 ? this.levels.pan : 0,
            this.context.currentTime,
            0.3,
          );
          voice.filter.frequency.setTargetAtTime(
            this.levels.muffled ? 360 : i === 0 ? 2400 : 850,
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
