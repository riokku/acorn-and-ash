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

describe('right-click loot and dodge gestures', () => {
  let canvas: EventTarget & { requestPointerLock: ReturnType<typeof vi.fn> };
  let windowEvents: EventTarget;
  let controls: Controls;
  let now: number;
  let dodging: boolean;
  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    canvas = Object.assign(new EventTarget(), { requestPointerLock: vi.fn() });
    windowEvents = new EventTarget();
    vi.stubGlobal('window', windowEvents);
    vi.stubGlobal(
      'document',
      Object.assign(new EventTarget(), { exitPointerLock: vi.fn(), pointerLockElement: null }),
    );
    dodging = false;
    controls = new Controls(canvas as unknown as HTMLCanvasElement, () => dodging);
  });
  afterEach(() => {
    controls.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function mouse(target: EventTarget, type: string, movementX = 0): void {
    target.dispatchEvent(
      Object.assign(new Event(type), {
        button: 2,
        clientX: 120,
        clientY: 240,
        movementX,
        movementY: 0,
      }),
    );
  }
  it('sends the dodge slam on press once, without camera capture or loot on release', () => {
    dodging = true;
    mouse(canvas, 'mousedown');
    expect(controls.buttons()).toBe(PlayerButton.Charge);
    expect(controls.takeClickPoint()).toEqual({ x: 120, y: 240 });
    expect(canvas.requestPointerLock).not.toHaveBeenCalled();
    controls.forgetTaps();
    mouse(canvas, 'mousemove', 15);
    expect(controls.buttons()).toBe(0);
    expect(controls.takeMouseDelta()).toEqual({ x: 0, y: 0 });
    // Landing before release must not turn this attack into a loot/camera gesture.
    dodging = false;
    mouse(windowEvents, 'mouseup');
    expect(controls.takeRightClickTap()).toBe(false);
    expect(controls.takeRightClickPoint()).toBeNull();
    mouse(canvas, 'mousedown');
    now = 100;
    mouse(windowEvents, 'mouseup');
    expect(controls.takeRightClickTap()).toBe(true);
    expect(canvas.requestPointerLock).toHaveBeenCalledOnce();
  });

  it('preserves a complete quick dodge click between ticks and clears it on pause', () => {
    dodging = true;
    mouse(canvas, 'mousedown');
    mouse(windowEvents, 'mouseup');
    expect(controls.buttons()).toBe(PlayerButton.Charge);
    controls.setGameplayEnabled(false);
    expect(controls.buttons()).toBe(0);
    expect(controls.takeClickPoint()).toBeNull();
    expect(controls.takeRightClickPoint()).toBeNull();
  });

  it('does not start a dodge slam from a left-button hold', () => {
    dodging = true;
    canvas.dispatchEvent(Object.assign(new Event('mousedown'), { button: 0 }));
    now = 500;
    expect(controls.buttons()).toBe(0);
    windowEvents.dispatchEvent(Object.assign(new Event('mouseup'), { button: 0 }));
    dodging = false;
    expect(controls.buttons()).toBe(0);
  });

  it('keeps settings and loading input idle until gameplay resumes', () => {
    controls.setGameplayEnabled(false);
    mouse(canvas, 'mousedown');
    now = 100;
    mouse(windowEvents, 'mouseup');
    for (const code of ['KeyW', 'KeyE', 'Space', 'KeyI'])
      windowEvents.dispatchEvent(Object.assign(new Event('keydown'), { code }));
    expect(controls.moveIntent()).toEqual({ x: 0, z: 0 });
    expect(controls.buttons()).toBe(0);
    expect(controls.takeInventoryToggle()).toBe(false);
    expect(controls.takeRightClickPoint()).toBeNull();
    windowEvents.dispatchEvent(Object.assign(new Event('keydown'), { code: 'Escape' }));
    expect(controls.takeEscapeToggle()).toBe(true);
    controls.setGameplayEnabled(true);
    windowEvents.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyW' }));
    expect(controls.moveIntent().z).toBe(1);
  });

  it('returns the point from a short tap once, without attacking or interacting', () => {
    mouse(canvas, 'mousedown');
    now = 100;
    mouse(windowEvents, 'mouseup');
    expect(controls.takeRightClickTap()).toBe(true);
    expect(controls.takeRightClickPoint()).toEqual({ x: 120, y: 240 });
    expect(controls.takeRightClickPoint()).toBeNull();
    expect(controls.buttons()).toBe(0);
  });
  it('does not loot after a camera drag even when pointer capture is unavailable', () => {
    mouse(canvas, 'mousedown');
    mouse(canvas, 'mousemove', 15);
    now = 100;
    mouse(windowEvents, 'mouseup');
    expect(controls.takeRightClickTap()).toBe(false);
    expect(controls.takeRightClickPoint()).toBeNull();
    expect(controls.takeMouseDelta()).toEqual({ x: 15, y: 0 });
  });
  it('does not loot on a held camera gesture or after a blur', () => {
    mouse(canvas, 'mousedown');
    now = 600;
    mouse(windowEvents, 'mouseup');
    expect(controls.takeRightClickPoint()).toBeNull();
    mouse(canvas, 'mousedown');
    windowEvents.dispatchEvent(new Event('blur'));
    now += 100;
    mouse(windowEvents, 'mouseup');
    expect(controls.takeRightClickTap()).toBe(false);
    expect(controls.takeRightClickPoint()).toBeNull();
  });
});

describe('taking a press of E for something done on this side', () => {
  let controls: Controls;
  let windowEvents: EventTarget;

  beforeEach(() => {
    windowEvents = new EventTarget();
    vi.stubGlobal('window', windowEvents);
    vi.stubGlobal('document', new EventTarget());
    controls = new Controls(new EventTarget() as HTMLCanvasElement);
  });

  afterEach(() => {
    controls.dispose();
    vi.unstubAllGlobals();
  });

  function key(type: 'keydown' | 'keyup'): void {
    windowEvents.dispatchEvent(Object.assign(new Event(type), { code: 'KeyE' }));
  }

  it('sends interact to the server when nobody takes the press', () => {
    key('keydown');
    expect(controls.buttons() & PlayerButton.Interact).toBe(PlayerButton.Interact);
  });

  it('keeps a claimed press from being sent as interact, however long E is held', () => {
    key('keydown');
    expect(controls.claimInteractPress()).toBe(true);
    expect(controls.buttons() & PlayerButton.Interact).toBe(0);
    // The key repeating while held is neither a new claim nor a leaked interact.
    key('keydown');
    expect(controls.claimInteractPress()).toBe(false);
    expect(controls.buttons() & PlayerButton.Interact).toBe(0);
  });

  it('is back to normal for the next press once E is let go', () => {
    key('keydown');
    controls.claimInteractPress();
    key('keydown');
    key('keyup');
    expect(controls.buttons() & PlayerButton.Interact).toBe(0);
    key('keydown');
    expect(controls.buttons() & PlayerButton.Interact).toBe(PlayerButton.Interact);
    expect(controls.claimInteractPress()).toBe(true);
  });

  it('has nothing to claim when E was not pressed', () => {
    expect(controls.claimInteractPress()).toBe(false);
  });
});

describe('X, to sit down on the ground', () => {
  let controls: Controls;
  let windowEvents: EventTarget;

  beforeEach(() => {
    windowEvents = new EventTarget();
    vi.stubGlobal('window', windowEvents);
    vi.stubGlobal('document', new EventTarget());
    controls = new Controls(new EventTarget() as HTMLCanvasElement);
  });

  afterEach(() => {
    controls.dispose();
    vi.unstubAllGlobals();
  });

  function key(type: 'keydown' | 'keyup'): void {
    windowEvents.dispatchEvent(Object.assign(new Event(type), { code: 'KeyX' }));
  }

  it('sends the sit button while X is held, and not otherwise', () => {
    expect(controls.buttons() & PlayerButton.Sit).toBe(0);
    key('keydown');
    expect(controls.buttons() & PlayerButton.Sit).toBe(PlayerButton.Sit);
    key('keyup');
    controls.forgetTaps();
    expect(controls.buttons() & PlayerButton.Sit).toBe(0);
  });

  it('keeps a quick tap that starts and ends between ticks', () => {
    key('keydown');
    key('keyup');
    expect(controls.buttons() & PlayerButton.Sit).toBe(PlayerButton.Sit);
  });

  it('sits down once when held, rather than bouncing back up', () => {
    const state = createActionState();
    const ground = { canAttack: false, castInstead: false, canSit: true };
    key('keydown');
    let previous = 0;
    for (let seq = 1; seq <= 40; seq++) {
      const input = createInput(seq, 0, 0, 0, controls.buttons(), 0);
      advanceAction(state, input, previous, ground);
      previous = input.buttons;
      controls.forgetTaps();
    }
    expect(state.kind).toBe(ActionKind.SitGround);
  });
});

describe('Tab target input', () => {
  let controls: Controls;
  let events: EventTarget;
  let canTarget: boolean;
  beforeEach(() => {
    events = new EventTarget();
    vi.stubGlobal('window', events);
    vi.stubGlobal('document', new EventTarget());
    canTarget = true;
    controls = new Controls(
      new EventTarget() as HTMLCanvasElement,
      () => false,
      () => canTarget,
    );
  });
  afterEach(() => {
    controls.dispose();
    vi.unstubAllGlobals();
  });
  const press = (props = {}): Event => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), {
      code: 'Tab',
      ...props,
    });
    events.dispatchEvent(event);
    return event;
  };
  it('queues individual presses with their original direction, without key repeats', () => {
    expect(press().defaultPrevented).toBe(true);
    press({ repeat: true });
    press({ shiftKey: true });
    controls.forgetTaps();
    expect(controls.takeTargetCycles()).toEqual([1, -1]);
    expect(controls.takeTargetCycles()).toEqual([]);
    expect(controls.buttons()).toBe(0);
  });
  it('preserves browser Tab navigation when paused, in panels, or using browser shortcuts', () => {
    controls.setGameplayEnabled(false);
    expect(press().defaultPrevented).toBe(false);
    controls.setGameplayEnabled(true);
    canTarget = false;
    expect(press().defaultPrevented).toBe(false);
    canTarget = true;
    expect(press({ ctrlKey: true }).defaultPrevented).toBe(false);
    Object.assign(events, { closest: () => ({}) });
    expect(press().defaultPrevented).toBe(false);
    expect(controls.takeTargetCycles()).toEqual([]);
  });
  it('drops pending presses on blur and pause', () => {
    press();
    events.dispatchEvent(new Event('blur'));
    expect(controls.takeTargetCycles()).toEqual([]);
    press();
    controls.setGameplayEnabled(false);
    expect(controls.takeTargetCycles()).toEqual([]);
  });
});
