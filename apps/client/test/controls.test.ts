import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ActionKind,
  PlayerButton,
  advanceAction,
  createActionState,
  createInput,
} from '@acorn/shared';

import { Controls } from '../src/input/controls';

describe('left-click attacks', () => {
  let controls: Controls;
  let canvas: EventTarget;
  let windowEvents: EventTarget;
  let now: number;

  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    canvas = new EventTarget();
    windowEvents = new EventTarget();
    vi.stubGlobal('window', windowEvents);
    vi.stubGlobal('document', new EventTarget());
    controls = new Controls(canvas as HTMLCanvasElement);
  });

  afterEach(() => {
    controls.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mouse(target: EventTarget, type: string): void {
    const event = Object.assign(new Event(type), { button: 0, clientX: 10, clientY: 20 });
    target.dispatchEvent(event);
  }

  it('waits for a short release before sending a single light swing', () => {
    mouse(canvas, 'mousedown');
    expect(controls.buttons()).toBe(0);
    controls.forgetTaps();
    now = 100;
    mouse(windowEvents, 'mouseup');
    expect(controls.buttons()).toBe(PlayerButton.Swing);
    controls.forgetTaps();
    expect(controls.buttons()).toBe(0);
  });

  it('starts a strong attack directly, without a light swing before or after it', () => {
    const state = createActionState();
    let previous = 0;
    mouse(canvas, 'mousedown');
    for (let tick = 0; tick < 16; tick++) {
      now = tick * 50;
      const buttons = controls.buttons();
      expect(buttons & PlayerButton.Swing).toBe(0);
      advanceAction(state, createInput(tick, 0, 0, 0, buttons), previous, {
        canAttack: true,
        castInstead: false,
      });
      previous = buttons;
      controls.forgetTaps();
    }
    expect(state.kind).toBe(ActionKind.Charge);
    mouse(windowEvents, 'mouseup');
    expect(controls.buttons()).toBe(0);
  });

  it('remembers a hold that starts and ends between simulation ticks', () => {
    mouse(canvas, 'mousedown');
    now = 500;
    mouse(windowEvents, 'mouseup');
    expect(controls.buttons()).toBe(PlayerButton.Charge);
    controls.forgetTaps();
    expect(controls.buttons()).toBe(0);
  });

  it('keeps fishing immediate without charging or sending another swing on release', () => {
    mouse(canvas, 'mousedown');
    expect(controls.buttons(true)).toBe(PlayerButton.Fish);
    controls.forgetTaps();
    now = 600;
    expect(controls.buttons(true)).toBe(PlayerButton.Fish);
    // Catching or cancelling the line during the same hold must not charge a weapon.
    expect(controls.buttons()).toBe(0);
    mouse(windowEvents, 'mouseup');
    expect(controls.buttons()).toBe(0);
  });

  it('consumes a complete fishing click between frames even when the catch clears the mode immediately', () => {
    mouse(canvas, 'mousedown');
    now = 80;
    mouse(windowEvents, 'mouseup');
    expect(controls.buttons(true)).toBe(PlayerButton.Fish);
    // Before a simulation tick forgets taps, the server can say the line ended.
    expect(controls.buttons(false)).toBe(0);
    controls.forgetTaps();
    mouse(canvas, 'mousedown');
    now = 150;
    mouse(windowEvents, 'mouseup');
    expect(controls.buttons(false)).toBe(PlayerButton.Swing);
  });

  it.each(['blur', 'placement', 'pause'])(
    'does not attack after a press cancelled by %s',
    (reason) => {
      mouse(canvas, 'mousedown');
      if (reason === 'blur') windowEvents.dispatchEvent(new Event('blur'));
      else if (reason === 'placement') controls.swallowLeftPress();
      else controls.releaseAll();
      now = 600;
      mouse(windowEvents, 'mouseup');
      expect(controls.buttons()).toBe(0);
    },
  );
});
