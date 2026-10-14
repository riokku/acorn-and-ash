import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const ramp = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
let gains: ReturnType<typeof ramp>[];
let sources: Array<{
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}>;
class Context {
  currentTime = 10;
  sampleRate = 100;
  state = 'running';
  destination = {};
  createBuffer() {
    return { getChannelData: () => new Float32Array(60) };
  }
  createBufferSource() {
    const source = {
      buffer: null,
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
    };
    sources.push(source);
    return source;
  }
  createBiquadFilter() {
    return {
      type: '',
      Q: { value: 0 },
      frequency: ramp(),
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    };
  }
  createGain() {
    const gain = ramp();
    gains.push(gain);
    return { gain, connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
  }
}
beforeEach(() => {
  vi.resetModules();
  gains = [];
  sources = [];
  vi.stubGlobal('AudioContext', Context);
});
afterEach(() => vi.unstubAllGlobals());
it.each([0.03, 0.1, 0.4])('peaks at the actual impact with %s seconds left', async (remaining) => {
  const { playSwoosh } = await import('../src/audio/sound');
  const cancel = playSwoosh(remaining)!;
  expect(gains[0]!.exponentialRampToValueAtTime.mock.calls[0]![1]).toBeCloseTo(10 + remaining);
  sources[0]!.onended?.();
  expect(sources[0]!.disconnect).toHaveBeenCalledTimes(1);
  cancel();
  expect(sources[0]!.stop).toHaveBeenCalledTimes(1);
});
it('cancels pending voices on pause/mute and never allocates muted or distant voices', async () => {
  const sound = await import('../src/audio/sound');
  const cancel = sound.playSwoosh(0.2)!;
  sound.setImpactSoundsActive(false);
  cancel();
  expect(sources[0]!.stop).toHaveBeenCalledTimes(2);
  expect(sound.playSwoosh(0.2)).toBeNull();
  sound.setImpactSoundsActive(true);
  sound.playSwoosh(0.2);
  sound.setSfxVolume(0);
  expect(sources[1]!.stop).toHaveBeenCalledTimes(2);
  expect(sound.playSwoosh(0.2)).toBeNull();
  sound.setSfxVolume(1);
  expect(sound.playSwoosh(0.2, 1, 0)).toBeNull();
  expect(sources).toHaveLength(2);
});
