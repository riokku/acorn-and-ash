import { effectsVolume, noiseBuffer, soundContext } from './sound';

/** A quiet descending double knock, distinct from gaining an item or taking damage. */
export function playPickupRefused(): void {
  if (effectsVolume() <= 0) return;
  const context = soundContext();
  if (context === null) return;
  tone(context, context.currentTime, 330, 250, 0.09, 0.095);
  tone(context, context.currentTime + 0.1, 235, 180, 0.13, 0.075);
}

/** Ground weight, a woody crack and a dusty tail; quieter for distant observers. */
export function playTreeLanding(volume: number): void {
  if (volume <= 0 || effectsVolume() <= 0) return;
  const context = soundContext();
  if (context === null) return;
  const start = context.currentTime;
  tone(context, start, 105, 38, 0.48, volume * 0.3);
  noise(context, start, 0.14, 1500, volume * 0.2);
  noise(context, start + 0.025, 0.56, 550, volume * 0.28);
}

function tone(
  context: AudioContext,
  start: number,
  from: number,
  to: number,
  duration: number,
  volume: number,
): void {
  const source = context.createOscillator();
  const gain = context.createGain();
  source.type = 'sine';
  source.frequency.setValueAtTime(from, start);
  source.frequency.exponentialRampToValueAtTime(to, start + duration);
  envelope(gain, start, duration, volume);
  source.connect(gain).connect(context.destination);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
  source.start(start);
  source.stop(start + duration);
}

function noise(
  context: AudioContext,
  start: number,
  duration: number,
  frequency: number,
  volume: number,
): void {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(frequency, start);
  filter.frequency.exponentialRampToValueAtTime(160, start + duration);
  const gain = context.createGain();
  envelope(gain, start, duration, volume);
  source.connect(filter).connect(gain).connect(context.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
  source.start(start);
  source.stop(start + duration);
}

function envelope(gain: GainNode, start: number, duration: number, volume: number): void {
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume * effectsVolume(), start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.00001, start + duration);
}
