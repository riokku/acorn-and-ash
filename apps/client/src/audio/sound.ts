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
 * Starts the background loop, once. Call this from a real click or key
 * press - autoplay policy blocks it otherwise - which is why it lives next
 * to `requestPointerLock` in game.ts rather than kicking off at page load.
 */
export function startAmbientMusic(): void {
  if (music !== null) return;
  music = new Audio(ambientLoopUrl);
  music.loop = true;
  music.volume = MUSIC_VOLUME;
  // Blocked autoplay throws here in some browsers; the game plays fine
  // without music, so this is worth logging but never worth failing over.
  void music.play().catch((error: unknown) => {
    console.error('Could not start the background music.', error);
  });
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
  clip.volume = volume;
  void clip.play().catch((error: unknown) => {
    console.error('Could not play a sound effect.', error);
  });
}
