import { afterEach, beforeEach, expect, it, vi } from 'vitest';
class AudioVoice {
  static created: AudioVoice[] = [];
  preload = '';
  volume = 1;
  paused = true;
  ended = false;
  currentTime = 0;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  constructor(readonly src: string) {
    AudioVoice.created.push(this);
  }
}
beforeEach(() => {
  vi.resetModules();
  AudioVoice.created = [];
  vi.stubGlobal('Audio', AudioVoice);
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('preloads without playing and bounds repeated overlapping voices', async () => {
  const sound = await import('../src/audio/sound');
  sound.preloadImpactSounds();
  expect(AudioVoice.created).toHaveLength(15);
  expect(AudioVoice.created.every((voice) => voice.play.mock.calls.length === 0)).toBe(true);
  for (let hit = 0; hit < 100; hit++) sound.playTreeHit();
  expect(AudioVoice.created.length).toBeLessThanOrEqual(17);
  expect(AudioVoice.created.reduce((sum, voice) => sum + voice.play.mock.calls.length, 0)).toBe(
    100,
  );
});
it('updates active effect volume and stops old sounds when the world is paused', async () => {
  const sound = await import('../src/audio/sound');
  sound.playTookDamage();
  const voice = AudioVoice.created[0]!;
  sound.setSfxVolume(0.2);
  expect(voice.volume).toBeCloseTo(0.15);
  sound.setImpactSoundsActive(false);
  expect(voice.paused).toBe(true);
  sound.playTookDamage();
  expect(voice.play).toHaveBeenCalledTimes(1);
  sound.setImpactSoundsActive(true);
  sound.playTookDamage();
  expect(voice.play).toHaveBeenCalledTimes(2);
});
it('does not allocate or play impact voices while effects are muted', async () => {
  const sound = await import('../src/audio/sound');
  sound.setSfxVolume(0);
  sound.preloadImpactSounds();
  sound.playTreeHit();
  sound.playThreatHit();
  expect(AudioVoice.created).toEqual([]);
});

it('cancels registered sustained effects when muted or the world is hidden, and unregisters finished effects', async () => {
  const sound = await import('../src/audio/sound');
  const cancel = vi.fn(),
    unregister = sound.registerSustainedEffect(cancel);
  sound.setSfxVolume(0);
  expect(cancel).toHaveBeenCalledTimes(1);
  sound.setImpactSoundsActive(false);
  expect(cancel).toHaveBeenCalledTimes(2);
  unregister();
  sound.setSfxVolume(0);
  expect(cancel).toHaveBeenCalledTimes(2);
});
