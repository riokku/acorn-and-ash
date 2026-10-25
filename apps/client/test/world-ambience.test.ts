import { beforeEach, expect, it, vi } from 'vitest';
import { STREAM, streamPointAt } from '@acorn/shared';
const audio = vi.hoisted(() => {
  const sources: Array<{ stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> =
    [];
  const nodes: Array<{ disconnect: ReturnType<typeof vi.fn> }> = [];
  const param = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => {
    const n = { connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
    nodes.push(n);
    return n;
  };
  const context = {
    currentTime: 0,
    destination: {},
    createBufferSource: () => {
      const s = { ...node(), stop: vi.fn(), start: vi.fn(), buffer: null, loop: false };
      sources.push(s);
      return s;
    },
    createGain: () => ({ ...node(), gain: param() }),
    createStereoPanner: () => ({ ...node(), pan: param() }),
    createBiquadFilter: () => ({ ...node(), type: '', Q: param(), frequency: param() }),
  };
  return {
    context,
    sources,
    nodes,
    volume: 1,
    cancel: null as (() => void) | null,
    unregister: vi.fn(),
  };
});
vi.mock('../src/audio/sound', () => ({
  effectsVolume: () => audio.volume,
  noiseBuffer: () => null,
  soundContext: () => audio.context,
  registerSustainedEffect: (cancel: () => void) => {
    audio.cancel = cancel;
    return audio.unregister;
  },
}));
import { ambienceAt, WorldAmbience, type AmbienceListener } from '../src/audio/world-ambience';
const fall = STREAM.falls[0]!;
const point = streamPointAt(STREAM, Math.round((fall.at / STREAM.length) * (STREAM.count - 1)));
const listener: AmbienceListener = {
  ...point,
  cameraYaw: 0,
  wind: 0.5,
  cover: 0,
  indoors: false,
  frozen: false,
  underground: 0,
};
beforeEach(() => {
  audio.sources.length = 0;
  audio.nodes.length = 0;
  audio.volume = 1;
  audio.cancel = null;
  audio.unregister.mockClear();
});
it('anchors the water mix to the stream and falls, with stereo and shelter attenuation', () => {
  const near = ambienceAt(listener);
  expect(near.water).toBeCloseTo(0.065);
  expect(ambienceAt({ ...listener, x: 0, z: 0 }).water).toBe(0);
  expect(ambienceAt({ ...listener, indoors: true }).water).toBeCloseTo(near.water * 0.12);
  expect(ambienceAt({ ...listener, frozen: true }).water).toBe(0);
  expect(ambienceAt({ ...listener, underground: 1 }).water).toBe(0);
  expect(ambienceAt({ ...listener, cover: 1 }).wind).toBeCloseTo(near.wind * 0.3);
  const side = { ...listener, x: point.x + 8 };
  expect(ambienceAt(side).pan).toBeLessThan(0);
  expect(ambienceAt({ ...side, cameraYaw: Math.PI }).pan).toBeGreaterThan(0);
});
it('keeps exactly two voices and disconnects them immediately on mute, pause and disposal', () => {
  const ambience = new WorldAmbience();
  ambience.update(1 / 60, listener, false);
  expect(audio.sources).toHaveLength(0);
  for (let i = 0; i < 100; i++) ambience.update(1 / 60, listener, true);
  expect(audio.sources).toHaveLength(2);
  audio.volume = 0;
  audio.cancel?.();
  expect(audio.unregister).toHaveBeenCalledTimes(1);
  expect(audio.sources.every((s) => s.stop.mock.calls.length === 1)).toBe(true);
  expect(audio.nodes.every((n) => n.disconnect.mock.calls.length === 1)).toBe(true);
  ambience.update(1 / 60, listener, true);
  expect(audio.sources).toHaveLength(2);
  audio.volume = 1;
  ambience.update(1 / 60, listener, true);
  expect(audio.sources).toHaveLength(4);
  ambience.setActive(false);
  ambience.dispose();
  expect(audio.sources.every((s) => s.stop.mock.calls.length === 1)).toBe(true);
});
