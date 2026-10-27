import { describe, expect, it } from 'vitest';
import type { ForestSound } from '../src/audio/forest-atmosphere';
import {
  WildlifeAtmosphere,
  type WildlifeSoundPose,
  type WildlifeListener,
} from '../src/audio/wildlife-atmosphere';
const listener: WildlifeListener = { x: 0, y: 0, z: 0, cameraYaw: 0, active: true, indoors: false };
const pose: WildlifeSoundPose = {
  x: 3,
  y: 0,
  z: 0,
  speed: 1,
  tense: false,
  fleeing: false,
  defeated: false,
};
function setup() {
  const events: ForestSound[] = [];
  const wildlife = new WildlifeAtmosphere((event) => events.push(event));
  wildlife.beginFrame(1 / 60, listener);
  wildlife.beginFrame(1 / 60, listener);
  return { events, wildlife };
}
describe('wildlife field sounds', () => {
  it('stays quiet on arrival and while standing, then follows actual animal motion', () => {
    const { events, wildlife } = setup();
    wildlife.observe(1, 'elk', pose);
    for (let i = 0; i < 120; i++) {
      wildlife.beginFrame(1 / 60, listener);
      wildlife.observe(1, 'elk', pose);
    }
    expect(events).toEqual([]);
    wildlife.observe(1, 'elk', { ...pose, x: 4 });
    expect(events).toMatchObject([{ kind: 'wildlife', cue: 'hoof' }]);
    wildlife.observe(2, 'rabbit', pose);
    wildlife.observe(2, 'rabbit', { ...pose, z: 0.6 });
    expect(events[1]).toMatchObject({ kind: 'wildlife', cue: 'brush' });
  });
  it('gives an elk warning once on tensing, with a cooldown instead of repeated snorts', () => {
    const { events, wildlife } = setup();
    wildlife.observe(1, 'elk', pose);
    wildlife.observe(1, 'elk', { ...pose, tense: true });
    wildlife.observe(1, 'elk', pose);
    wildlife.observe(1, 'elk', { ...pose, tense: true });
    expect(events).toMatchObject([{ cue: 'snort' }]);
    for (let i = 0; i < 250; i++) wildlife.beginFrame(1 / 60, listener);
    wildlife.observe(1, 'elk', pose);
    wildlife.observe(1, 'elk', { ...pose, tense: true });
    expect(events).toHaveLength(2);
  });
  it('pans with the camera, fades with distance and ignores animals beyond hearing', () => {
    const { events, wildlife } = setup();
    wildlife.observe(1, 'rabbit', pose);
    wildlife.observe(1, 'rabbit', { ...pose, fleeing: true });
    expect(events[0]!.pan).toBeGreaterThan(0);
    wildlife.beginFrame(1 / 60, { ...listener, cameraYaw: Math.PI });
    wildlife.observe(2, 'rabbit', { ...pose, x: 8 });
    wildlife.observe(2, 'rabbit', { ...pose, x: 8, fleeing: true });
    expect(events[1]!.pan).toBeLessThan(0);
    expect(events[1]!.volume).toBeLessThan(events[0]!.volume);
    wildlife.observe(3, 'elk', { ...pose, y: 30 });
    wildlife.observe(3, 'elk', { ...pose, y: 30, tense: true });
    expect(events).toHaveLength(2);
  });
  it('silences corpses, teleports, hidden/indoor play and long-frame catch-up', () => {
    const { events, wildlife } = setup();
    wildlife.observe(1, 'rabbit', pose);
    wildlife.observe(1, 'rabbit', { ...pose, x: 8, fleeing: true });
    wildlife.observe(1, 'rabbit', { ...pose, x: 9, defeated: true });
    wildlife.observe(1, 'rabbit', { ...pose, x: 10 });
    expect(events).toEqual([]);
    for (const change of [{ active: false }, { indoors: true }, {}]) {
      wildlife.beginFrame(1, { ...listener, ...change });
      wildlife.observe(1, 'rabbit', { ...pose, fleeing: true });
      wildlife.beginFrame(1 / 60, listener);
      wildlife.observe(1, 'rabbit', { ...pose, fleeing: true });
    }
    wildlife.beginFrame(1 / 60, { ...listener, x: 30 });
    wildlife.observe(1, 'rabbit', { ...pose, fleeing: true });
    expect(events).toEqual([]);
  });
  it('bounds a busy forest and forgets removed animals without replaying their last step', () => {
    const { events, wildlife } = setup();
    for (let id = 1; id <= 30; id++) {
      wildlife.observe(id, 'rabbit', pose);
      wildlife.observe(id, 'rabbit', { ...pose, fleeing: true });
    }
    expect(events).toHaveLength(4);
    wildlife.beginFrame(1 / 60, listener);
    wildlife.forget(1);
    wildlife.observe(1, 'rabbit', { ...pose, x: 4 });
    wildlife.clear();
    wildlife.beginFrame(1 / 60, listener);
    wildlife.observe(2, 'rabbit', { ...pose, x: 4 });
    expect(events).toHaveLength(4);
  });
});
