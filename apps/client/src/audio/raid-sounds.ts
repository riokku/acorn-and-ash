import { effectsVolume, noiseBuffer, soundContext } from './sound';

/**
 * The sounds of a skeleton raid, all made on the spot with WebAudio like the
 * swish of a swing (see `playSwoosh`), so there are no recordings to licence:
 * the horn that warns one is coming, the rattle of bone, the ring of a
 * skeleton drawing back to swing, the clang of a blow it shrugs off, and a
 * little fanfare once it is over (see decision 0063).
 *
 * `volume` is from 0 to 1, lower for something further off.
 */

/** A raid is coming: two long, low notes on a war horn, the second higher. */
export function playRaidHorn(volume = 1): void {
  const context = soundContext();
  if (context === null) return;
  const now = context.currentTime + 0.02;
  hornNote(context, now, 98, 1.05, 0.2 * volume);
  hornNote(context, now + 1.1, 131, 1.4, 0.22 * volume);
}

function hornNote(
  context: AudioContext,
  at: number,
  pitch: number,
  seconds: number,
  loudness: number,
): void {
  const gain = context.createGain();
  const level = loudness * effectsVolume();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.22);
  gain.gain.setValueAtTime(Math.max(0.0002, level * 0.85), at + seconds - 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 2;
  // Brassy: the filter opens as the note swells, like breath behind it.
  filter.frequency.setValueAtTime(260, at);
  filter.frequency.exponentialRampToValueAtTime(1100, at + 0.35);
  filter.frequency.exponentialRampToValueAtTime(700, at + seconds);
  filter.connect(gain).connect(context.destination);
  // A slow wobble, as a horn blown by somebody, not a machine.
  const wobble = context.createOscillator();
  wobble.frequency.value = 5.2;
  const wobbleDepth = context.createGain();
  wobbleDepth.gain.value = pitch * 0.012;
  wobble.connect(wobbleDepth);
  for (const detune of [-6, 5]) {
    const voice = context.createOscillator();
    voice.type = 'sawtooth';
    // Scooping up into the note.
    voice.frequency.setValueAtTime(pitch * 0.93, at);
    voice.frequency.exponentialRampToValueAtTime(pitch, at + 0.18);
    voice.detune.value = detune;
    wobbleDepth.connect(voice.frequency);
    voice.connect(filter);
    voice.start(at);
    voice.stop(at + seconds + 0.05);
  }
  wobble.start(at);
  wobble.stop(at + seconds + 0.05);
}

/**
 * Bone knocking on bone: a handful of sharp little clicks. More of them,
 * and spread out longer, for a skeleton falling apart (`collapse`).
 */
export function playBoneClatter(volume = 1, collapse = false): void {
  const context = soundContext();
  if (context === null) return;
  const clicks = collapse ? 14 : 5;
  const spread = collapse ? 0.7 : 0.16;
  const now = context.currentTime + 0.01;
  for (let n = 0; n < clicks; n++) {
    // Bunched up at the start, then trailing off, as bits settle.
    const at = now + spread * (n / clicks) ** 1.6 + Math.random() * 0.02;
    click(context, at, 1400 + Math.random() * 2600, 0.28 * volume * (1 - (n / clicks) * 0.6));
  }
}

function click(context: AudioContext, at: number, pitch: number, loudness: number): void {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = pitch;
  filter.Q.value = 6;
  const gain = context.createGain();
  const level = Math.max(0.0002, loudness * effectsVolume());
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(at, Math.random() * 0.4);
  source.stop(at + 0.06);
}

/**
 * The tell before a skeleton swings: a bright ring of steel as it draws
 * back, so a swing can be heard coming as well as seen, even from behind.
 */
export function playWindupRing(volume = 1): void {
  const context = soundContext();
  if (context === null) return;
  const at = context.currentTime + 0.01;
  const level = Math.max(0.0002, 0.09 * volume * effectsVolume());
  for (const [pitch, share] of [
    [2350, 1],
    [3720, 0.6],
    [5180, 0.35],
  ] as const) {
    const tone = context.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(pitch * 0.92, at);
    tone.frequency.exponentialRampToValueAtTime(pitch, at + 0.08);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level * share, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    tone.connect(gain).connect(context.destination);
    tone.start(at);
    tone.stop(at + 0.5);
  }
}

/** A blow that did not stop it: a dull clang, like hitting armour. */
export function playClank(volume = 1): void {
  const context = soundContext();
  if (context === null) return;
  const at = context.currentTime + 0.005;
  const level = Math.max(0.0002, 0.16 * volume * effectsVolume());
  // Partials that are not in tune with each other, which is what makes
  // struck metal sound like metal.
  for (const [pitch, share, ring] of [
    [410, 1, 0.35],
    [1093, 0.55, 0.25],
    [1720, 0.35, 0.18],
    [2610, 0.2, 0.12],
  ] as const) {
    const tone = context.createOscillator();
    tone.type = 'sine';
    tone.frequency.value = pitch * (0.97 + Math.random() * 0.06);
    const gain = context.createGain();
    gain.gain.setValueAtTime(level * share, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + ring);
    tone.connect(gain).connect(context.destination);
    tone.start(at);
    tone.stop(at + ring + 0.02);
  }
  click(context, at, 3000, 0.25 * volume);
}

/** Something climbing up out of the ground: a low, rising rumble. */
export function playEarthRumble(volume = 1): void {
  const context = soundContext();
  if (context === null) return;
  const at = context.currentTime + 0.01;
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 3;
  filter.frequency.setValueAtTime(90, at);
  filter.frequency.exponentialRampToValueAtTime(260, at + 0.9);
  const gain = context.createGain();
  const level = Math.max(0.0002, 0.5 * volume * effectsVolume());
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(at);
  source.stop(at + 1.25);
}

/** The raid fought off: a short, bright fanfare, rising. */
export function playVictory(): void {
  const context = soundContext();
  if (context === null) return;
  const at = context.currentTime + 0.05;
  // C, E, G and the C above, the last one held.
  [523.25, 659.25, 783.99, 1046.5].forEach((pitch, index) => {
    note(context, at + index * 0.11, pitch, index === 3 ? 0.9 : 0.22, 0.12);
  });
}

/** The raid gave up and went: two soft notes, falling. */
export function playRaidOver(): void {
  const context = soundContext();
  if (context === null) return;
  const at = context.currentTime + 0.05;
  note(context, at, 587.33, 0.3, 0.08);
  note(context, at + 0.2, 440, 0.7, 0.08);
}

function note(
  context: AudioContext,
  at: number,
  pitch: number,
  seconds: number,
  loudness: number,
): void {
  const tone = context.createOscillator();
  tone.type = 'triangle';
  tone.frequency.value = pitch;
  const gain = context.createGain();
  const level = Math.max(0.0002, loudness * effectsVolume());
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  tone.connect(gain).connect(context.destination);
  tone.start(at);
  tone.stop(at + seconds + 0.02);
}
