import type { ForestSound } from './forest-atmosphere';
import { effectsVolume, noiseBuffer, soundContext } from './sound';

/** A small, disposable forest bus. All voices are short and bounded. */
export class ForestAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = false;
  private readonly voices = new Map<AudioScheduledSourceNode, () => void>();

  update(active: boolean): void {
    if (!active && this.active) this.stop();
    this.active = active;
    if (this.master !== null) this.master.gain.value = active ? effectsVolume() : 0;
  }

  play(event: ForestSound): void {
    if (!this.active || effectsVolume() <= 0 || event.volume <= 0 || this.voices.size >= 17) return;
    this.context ??= soundContext();
    const context = this.context;
    if (context === null) return;
    if (this.master === null) {
      this.master = context.createGain();
      this.master.gain.value = effectsVolume();
      this.master.connect(context.destination);
    }
    const at = context.currentTime + 0.015;
    if (event.kind === 'step') {
      const variation = 0.9 + Math.random() * 0.2;
      const volume = event.volume * variation;
      if (event.surface === 'wood') {
        this.tone(at, 125 * variation, 65, 0.13, volume * 0.12, event.pan);
        this.noise(at, 0.085, 650, volume * 0.075, event.pan);
      } else {
        const floor = event.surface === 'forestFloor';
        const soil = event.surface === 'soil';
        this.noise(
          at,
          floor ? 0.2 : 0.14,
          floor ? 1700 : soil ? 500 : 950,
          volume * (floor ? 0.16 : 0.12),
          event.pan,
        );
        this.tone(at, 78 * variation, 42, 0.095, volume * 0.065, event.pan);
        if (floor) this.noise(at + 0.045, 0.11, 2600, volume * 0.035, event.pan);
      }
    } else if (event.kind === 'rustle') {
      // A slow, soft swell, with finer needles moving above the low canopy wash.
      this.noise(at, 1.8, 1100, event.volume * 0.15, event.pan, 0.55);
      this.noise(at + 0.22, 1.1, 2800, event.volume * 0.035, event.pan, 0.35);
    } else {
      // Stylized small woodland birds, rather than a claim to a recorded species.
      const phrases = [
        [
          [0, 1650, 2200, 0.16],
          [0.22, 2050, 1540, 0.22],
          [0.58, 1720, 1980, 0.18],
        ],
        [
          [0, 2450, 2100, 0.09],
          [0.14, 2400, 2050, 0.09],
          [0.36, 1680, 1480, 0.32],
        ],
        [
          [0, 1380, 1860, 0.27],
          [0.4, 1720, 1400, 0.3],
        ],
      ] as const;
      const pitch = 0.94 + Math.random() * 0.12;
      for (const [offset, from, to, duration] of phrases[event.variant % phrases.length]!) {
        this.tone(
          at + offset,
          from * pitch,
          to * pitch,
          duration,
          event.volume * 0.12,
          event.pan,
          0.025,
          true,
        );
      }
    }
  }

  private tone(
    at: number,
    from: number,
    to: number,
    seconds: number,
    volume: number,
    pan: number,
    attack = 0.008,
    bird = false,
  ): void {
    const context = this.context!;
    const source = context.createOscillator();
    source.type = 'sine';
    source.frequency.setValueAtTime(from, at);
    if (bird) {
      for (let point = 1; point <= 12; point++) {
        const t = point / 12;
        source.frequency.exponentialRampToValueAtTime(
          from + (to - from) * t + Math.sin(t * Math.PI * 6) * 35,
          at + seconds * t,
        );
      }
    } else source.frequency.exponentialRampToValueAtTime(to, at + seconds);
    this.connectVoice(source, source, at, seconds, volume, pan, attack);
  }

  private noise(
    at: number,
    seconds: number,
    frequency: number,
    volume: number,
    pan: number,
    attack = 0.01,
  ): void {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context);
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.45;
    filter.frequency.setValueAtTime(frequency, at);
    filter.frequency.exponentialRampToValueAtTime(frequency * 0.45, at + seconds);
    source.connect(filter);
    this.connectVoice(source, filter, at, seconds, volume, pan, attack);
  }

  private connectVoice(
    source: AudioScheduledSourceNode,
    input: AudioNode,
    at: number,
    seconds: number,
    volume: number,
    pan: number,
    attack: number,
  ): void {
    const context = this.context!;
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.00001, at + seconds);
    input.connect(gain).connect(panner).connect(this.master!);
    const release = () => {
      source.disconnect();
      if (input !== source) input.disconnect();
      gain.disconnect();
      panner.disconnect();
      this.voices.delete(source);
    };
    this.voices.set(source, release);
    source.onended = release;
    source.start(at);
    source.stop(at + seconds + 0.02);
  }

  private stop(): void {
    for (const [source, release] of this.voices) {
      source.stop();
      release();
    }
  }

  dispose(): void {
    this.stop();
    this.master?.disconnect();
    this.master = null;
    this.context = null;
    this.active = false;
  }
}
