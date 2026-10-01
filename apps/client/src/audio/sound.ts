import treeHit1 from '@assets/audio/sfx/tree-hit-1.ogg?url';
import treeHit2 from '@assets/audio/sfx/tree-hit-2.ogg?url';
import treeHit3 from '@assets/audio/sfx/tree-hit-3.ogg?url';
import treeHit4 from '@assets/audio/sfx/tree-hit-4.ogg?url';
import treeHit5 from '@assets/audio/sfx/tree-hit-5.ogg?url';
import threatHit1 from '@assets/audio/sfx/threat-hit-1.ogg?url';
import threatHit2 from '@assets/audio/sfx/threat-hit-2.ogg?url';
import threatHit3 from '@assets/audio/sfx/threat-hit-3.ogg?url';
import threatHit4 from '@assets/audio/sfx/threat-hit-4.ogg?url';
import threatHit5 from '@assets/audio/sfx/threat-hit-5.ogg?url';
import tookDamage1 from '@assets/audio/sfx/took-damage-1.ogg?url';
import tookDamage2 from '@assets/audio/sfx/took-damage-2.ogg?url';
import tookDamage3 from '@assets/audio/sfx/took-damage-3.ogg?url';
import tookDamage4 from '@assets/audio/sfx/took-damage-4.ogg?url';
import tookDamage5 from '@assets/audio/sfx/took-damage-5.ogg?url';
import ambientLoopUrl from '@assets/audio/music/ambient-loop.ogg?url';

/**
 * Sound to go with the camera kick added alongside these same events (see
 * camera/follow-camera.ts and docs/decisions/0031-camera-shake.md) - five
 * variants each, played at random, so chopping doesn't sound like the exact
 * same clip on a loop.
 */
const TREE_HIT_URLS = [treeHit1, treeHit2, treeHit3, treeHit4, treeHit5];
const THREAT_HIT_URLS = [threatHit1, threatHit2, threatHit3, threatHit4, threatHit5];
const TOOK_DAMAGE_URLS = [tookDamage1, tookDamage2, tookDamage3, tookDamage4, tookDamage5];

const SFX_VOLUME = 0.6;
const DAMAGE_VOLUME = 0.75;
const MUSIC_VOLUME = 0.35;

let music: HTMLAudioElement | null = null;
/**
 * Multipliers on the tuned levels above, from the Settings menu's sliders. 1
 * (the default) leaves the tuned levels exactly as they were before the
 * Settings menu existed.
 */
let musicVolumeScale = 1;
let sfxVolumeScale = 1;

/**
 * Starts the background loop, once. Call this from a real click or key
 * press - autoplay policy blocks it otherwise - which is why it lives next
 * to `resume` in game.ts rather than kicking off at page load.
 */
export function startAmbientMusic(): void {
  if (music !== null) return;
  music = new Audio(ambientLoopUrl);
  music.loop = true;
  music.volume = MUSIC_VOLUME * musicVolumeScale;
  // Blocked autoplay throws here in some browsers; the game plays fine
  // without music, so this is worth logging but never worth failing over.
  void music.play().catch((error: unknown) => {
    console.error('Could not start the background music.', error);
  });
}

/** From the Settings menu. Takes effect immediately, even if the loop is already playing. */
export function setMusicVolume(scale: number): void {
  musicVolumeScale = scale;
  if (music !== null) music.volume = MUSIC_VOLUME * musicVolumeScale;
}

/** From the Settings menu. Applies to every sound effect played from here on. */
export function setSfxVolume(scale: number): void {
  sfxVolumeScale = scale;
}

export function playTreeHit(): void {
  playRandom(TREE_HIT_URLS, SFX_VOLUME);
}

export function playThreatHit(): void {
  playRandom(THREAT_HIT_URLS, SFX_VOLUME);
}

export function playTookDamage(): void {
  playRandom(TOOK_DAMAGE_URLS, DAMAGE_VOLUME);
}

/** A fresh Audio per call, so two hits landing close together both play in full. */
function playRandom(urls: readonly string[], volume: number): void {
  const url = urls[Math.floor(Math.random() * urls.length)];
  if (url === undefined) return;
  const clip = new Audio(url);
  clip.volume = volume * sfxVolumeScale;
  void clip.play().catch((error: unknown) => {
    console.error('Could not play a sound effect.', error);
  });
}

let swooshContext: AudioContext | null = null;
let swooshNoise: AudioBuffer | null = null;

/**
 * The swish of something swung through the air, peaking `peakInSeconds` from
 * now, as the blow lands; `strength` above 1 for a charged strike, deeper
 * and longer. Made on the spot from a burst of hiss swept up and back down
 * through a filter, so it never sounds quite the same twice and needs no
 * recording of its own.
 */
export function playSwoosh(peakInSeconds: number, strength = 1): void {
  if (typeof AudioContext === 'undefined') return;
  try {
    swooshContext ??= new AudioContext();
  } catch (error) {
    console.error('Could not start the sound of swinging.', error);
    return;
  }
  const context = swooshContext;
  if (context.state === 'suspended') void context.resume();
  swooshNoise ??= makeNoise(context, 0.6);

  const rise = 0.13 * strength;
  const fall = 0.12 * strength;
  const start = context.currentTime + Math.max(0, peakInSeconds - rise);
  const peak = start + rise;
  const end = peak + fall;
  const pitch = (0.85 + Math.random() * 0.3) / strength;

  const source = context.createBufferSource();
  source.buffer = swooshNoise;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(420 * pitch, start);
  filter.frequency.exponentialRampToValueAtTime(2300 * pitch, peak);
  filter.frequency.exponentialRampToValueAtTime(650 * pitch, end);
  const gain = context.createGain();
  const loudest = SWOOSH_VOLUME * sfxVolumeScale * Math.min(1.4, strength);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, loudest), peak);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start, Math.random() * 0.2);
  source.stop(end + 0.02);
}

const SWOOSH_VOLUME = 0.32;

function makeNoise(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * seconds),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
}
