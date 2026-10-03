import { beforeEach, describe, expect, it, vi } from 'vitest';

const audio = vi.hoisted(() => {
  const peaks: number[] = [];
  const ended: Array<{ onended: (() => void) | null; disconnect: ReturnType<typeof vi.fn> }> = [];
  const context = {
    currentTime: 10,
    destination: {},
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: (value: number) => peaks.push(value),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    }),
    createBiquadFilter: () => ({
      type: '',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    }),
    createOscillator: () => {
      const source = {
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        type: '',
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      ended.push(source);
      return source;
    },
    createBufferSource: () => {
      const source = {
        buffer: null,
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      ended.push(source);
      return source;
    },
  };
  return { peaks, ended, context, volume: vi.fn(() => 1), getContext: vi.fn(() => context) };
});
vi.mock('../src/audio/sound', () => ({
  effectsVolume: audio.volume,
  soundContext: audio.getContext,
  noiseBuffer: () => null,
}));
import { playCollection, playPickupRefused, playTreeLanding } from '../src/audio/feedback';

beforeEach(() => {
  audio.peaks.length = 0;
  audio.ended.length = 0;
  audio.volume.mockReturnValue(1);
  audio.getContext.mockClear();
});

describe('feedback audio', () => {
  it('scales collection sounds by distance and releases their voices', () => {
    for (const item of ['log', 'stick', 'flower'] as const) {
      audio.peaks.length = 0;
      playCollection(item, true);
      const loud = [...audio.peaks];
      audio.peaks.length = 0;
      playCollection(item, true, 0.25);
      expect(audio.peaks.length).toBe(loud.length);
      audio.peaks.forEach((value, index) => expect(value).toBeCloseTo(loud[index]! * 0.25));
    }
    for (const voice of audio.ended) {
      voice.onended?.();
      expect(voice.disconnect).toHaveBeenCalled();
    }
  });

  it('keeps muted effects and distant landings silent without creating voices', () => {
    audio.volume.mockReturnValue(0);
    playPickupRefused();
    playTreeLanding(1);
    playCollection('log', true);
    audio.volume.mockReturnValue(1);
    playTreeLanding(0);
    playCollection('flower', true, 0);
    expect(audio.getContext).not.toHaveBeenCalled();
    expect(audio.ended).toHaveLength(0);
  });

  it('scales the landing by distance and the SFX slider, and releases voices', () => {
    playTreeLanding(1);
    const loud = [...audio.peaks];
    audio.peaks.length = 0;
    audio.volume.mockReturnValue(0.5);
    playTreeLanding(0.4);
    expect(audio.peaks.length).toBe(loud.length);
    audio.peaks.forEach((value, index) => expect(value).toBeCloseTo(loud[index]! * 0.2));
    for (const voice of audio.ended) {
      voice.onended?.();
      expect(voice.disconnect).toHaveBeenCalled();
    }
  });
});
