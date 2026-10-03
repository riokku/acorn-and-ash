import { beforeEach, describe, expect, it, vi } from 'vitest';

const audio = vi.hoisted(() => {
  const sources: Array<{
    onended: (() => void) | null;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const gains: Array<{ gain: { value: number }; disconnect: ReturnType<typeof vi.fn> }> = [];
  const node = () => ({ connect: vi.fn().mockReturnThis(), disconnect: vi.fn() });
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const source = () => {
    const value = {
      ...node(),
      frequency: param(),
      type: '',
      loop: false,
      buffer: null,
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
    sources.push(value);
    return value;
  };
  const context = {
    currentTime: 0,
    destination: {},
    createOscillator: source,
    createBufferSource: source,
    createGain: () => {
      const value = { ...node(), gain: param() };
      gains.push(value);
      return value;
    },
    createStereoPanner: () => ({ ...node(), pan: param() }),
    createBiquadFilter: () => ({ ...node(), type: '', Q: param(), frequency: param() }),
  };
  return { sources, gains, context, volume: vi.fn(() => 1), getContext: vi.fn(() => context) };
});
vi.mock('../src/audio/sound', () => ({
  effectsVolume: audio.volume,
  soundContext: audio.getContext,
  noiseBuffer: () => null,
}));
import { ForestAudio } from '../src/audio/forest-sounds';

beforeEach(() => {
  audio.sources.length = audio.gains.length = 0;
  audio.volume.mockReturnValue(1);
  audio.getContext.mockClear();
});

describe('forest audio lifecycle', () => {
  it('creates no audio before starting or while muted', () => {
    const forest = new ForestAudio();
    const event = { kind: 'bird', pan: 0, volume: 1, variant: 0 } as const;
    forest.play(event);
    forest.update(true);
    audio.volume.mockReturnValue(0);
    forest.play(event);
    expect(audio.getContext).not.toHaveBeenCalled();
    forest.dispose();
  });

  it('applies slider changes to existing sounds, and stops every voice on pause and disposal', () => {
    const forest = new ForestAudio();
    forest.update(true);
    forest.play({ kind: 'rustle', pan: 0, volume: 1, variant: 0 });
    const master = audio.gains[0]!;
    audio.volume.mockReturnValue(0);
    forest.update(true);
    expect(master.gain.value).toBe(0);
    forest.update(false);
    for (const voice of audio.sources) {
      expect(voice.stop).toHaveBeenCalledTimes(2);
      expect(voice.disconnect).toHaveBeenCalled();
    }
    forest.dispose();
    expect(master.disconnect).toHaveBeenCalled();
  });

  it('bounds voices even when effects are repeatedly requested, then releases finished nodes', () => {
    const forest = new ForestAudio();
    forest.update(true);
    for (let i = 0; i < 100; i++) forest.play({ kind: 'bird', pan: -0.5, volume: 0.3, variant: i });
    expect(audio.sources.length).toBeLessThanOrEqual(20);
    for (const source of [...audio.sources]) source.onended?.();
    const before = audio.sources.length;
    forest.play({ kind: 'step', surface: 'grass', pan: 0, volume: 0.5 });
    expect(audio.sources.length).toBeGreaterThan(before);
    forest.dispose();
  });
});
