/**
 * Keyboard and mouse.
 *
 * Desktop keyboard and mouse comes first. Gamepad is a later phase, and there is
 * no mobile support at launch, so nothing here worries about touch.
 */

import { PlayerButton } from '@acorn/shared';

export interface MoveIntent {
  /** -1 is left, 1 is right. */
  readonly x: number;
  /** -1 is towards the camera, 1 is away from it. */
  readonly z: number;
}

const mouseCode = (button: number): string => `Mouse${button}`;
const LEFT_MOUSE = mouseCode(0);
const LIGHT_ATTACK = 'LightAttack';
const CHARGED_ATTACK = 'ChargedAttack';

/**
 * Hotkeys for crafting or building, in menu order: 1 is the first entry, 2 the
 * second. Only live while that menu is open - the rest of the time these same
 * keys are the hotbar's. Six, not four: the build menu has grown past
 * campfire/cabin/flower bed/lantern to fence and garden path (see decision
 * 0048), and crafting shares this same list rather than keys of its own.
 */
const CRAFT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'] as const;
/** Hotkeys for the hotbar, one per slot. Only live while neither menu is open. */
const HOTBAR_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'] as const;
/**
 * How long the left mouse button has to stay down before it commits to a
 * charged attack instead of a light swing (see decision 0050). Comfortably
 * above a deliberate click, and comfortably below `CHARGE_SECONDS`'s own one
 * second, so there is real wind-up left once it commits.
 */
const CHARGE_HOLD_MS = 400;
/**
 * A right-button press shorter than this, that barely moved the mouse, is a
 * tap rather than the start of a camera drag - it puts away a piece being
 * placed (see decision 0052).
 */
const RIGHT_TAP_MAX_MS = 350;
const RIGHT_TAP_MAX_TRAVEL_PX = 6;
/**
 * A single notch of an ordinary mouse wheel reports about a hundred pixels;
 * a trackpad reports many small nudges instead. This much, added up, is one
 * step either way.
 */
const WHEEL_STEP_PX = 50;

/** Keys the browser must not act on itself: Space would otherwise scroll the page. */
const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
  'Space',
  'KeyB',
  'KeyC',
]);

export class Controls {
  private readonly held = new Set<string>();
  /**
   * Keys pressed since the last tick was built.
   *
   * A frame does not always produce a simulation tick, and a fast tap of Space
   * can start and finish inside one frame. Remembering the press until a tick
   * carries it means a jump is never quietly swallowed.
   */
  private readonly tapped = new Set<string>();
  private pointerLocked = false;
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  /** When the left button last went down, so a hold can be told apart from a tap - see `CHARGE_HOLD_MS`. */
  private leftMouseDownAt: number | null = null;
  private leftChargeSent = false;
  private leftSwingSent = false;
  /** Where the screen a left click landed, until `takeClickPoint` reads it. */
  private pendingClickPoint: { x: number; y: number } | null = null;
  /** Where the cursor last was over the game, for a piece being placed to follow. */
  private pointer: { x: number; y: number } | null = null;
  /** When the right button went down, and how far the mouse has moved since, to tell a tap from a drag. */
  private rightDownAt: number | null = null;
  private rightTravelPx = 0;
  private rightTapped = false;
  /** Wheel movement not yet turned into whole steps, and the steps not yet read. */
  private wheelRemainder = 0;
  private wheelSteps = 0;

  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    // On the window, so letting go outside the canvas still counts as letting go.
    window.addEventListener('mouseup', this.handleMouseUp);
    // The browser's own right-click menu would otherwise pop up over the
    // game every time it is held to turn the camera.
    canvas.addEventListener('contextmenu', this.handleContextMenu);
    // Not passive: the page itself must not scroll or zoom while the wheel
    // turns a piece being placed.
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  get isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  /** Which way the player is asking to go, before the camera is taken into account. */
  moveIntent(): MoveIntent {
    let x = 0;
    let z = 0;
    if (this.held.has('KeyW') || this.held.has('ArrowUp')) z += 1;
    if (this.held.has('KeyS') || this.held.has('ArrowDown')) z -= 1;
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) x += 1;
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) x -= 1;
    return { x, z };
  }

  /**
   * Which action buttons to put on this tick, as the bit field the server expects.
   *
   * Holding Space keeps the jump bit set, so the player hops again the moment
   * they land. The shared rule only lets a jump start from the ground, so that
   * cannot climb the sky. Holding E is harmless in the same way: the server
   * hands over each thing exactly once. A short left click swings on release;
   * holding it charges without first swinging. Fishing uses immediate clicks
   * so casting and reacting to a bite never wait for an attack decision.
   */
  buttons(immediateSwing = false): number {
    let buttons = 0;
    if (this.held.has('Space') || this.tapped.has('Space')) buttons |= PlayerButton.Jump;
    if (this.held.has('ShiftLeft') || this.held.has('ShiftRight')) buttons |= PlayerButton.Sprint;
    if (this.held.has('KeyE') || this.tapped.has('KeyE')) buttons |= PlayerButton.Interact;
    if (this.held.has('ControlLeft') || this.tapped.has('ControlLeft')) {
      buttons |= PlayerButton.Dodge;
    }

    const leftHeldPastThreshold =
      this.leftMouseDownAt !== null && performance.now() - this.leftMouseDownAt >= CHARGE_HOLD_MS;
    if (immediateSwing) {
      if (this.held.has(LEFT_MOUSE) || this.tapped.has(LEFT_MOUSE)) {
        buttons |= PlayerButton.Swing;
        this.leftSwingSent = true;
      }
    } else if (!this.leftSwingSent && (leftHeldPastThreshold || this.tapped.has(CHARGED_ATTACK))) {
      buttons |= PlayerButton.Charge;
      this.leftChargeSent = true;
    } else if (this.tapped.has(LIGHT_ATTACK)) {
      buttons |= PlayerButton.Swing;
    }
    return buttons;
  }

  /** Called once a tick has actually carried the taps, so they are not sent twice. */
  forgetTaps(): void {
    this.tapped.clear();
  }

  /**
   * Which craft hotkeys were pressed since this was last asked, as indices
   * into recipe order (0 for the first recipe, 1 for the second, and so on).
   *
   * Read and cleared eagerly, on its own, rather than waiting on a produced
   * tick the way movement taps do: crafting is not part of the fixed-step
   * simulation, so there is no tick for it to ride along on.
   */
  takeCraftTaps(): number[] {
    const indices: number[] = [];
    CRAFT_KEYS.forEach((key, index) => {
      if (this.tapped.has(key)) {
        indices.push(index);
        this.tapped.delete(key);
      }
    });
    return indices;
  }

  /**
   * Which build-menu slots were picked since this was last asked, in the same
   * order and on the same keys as `takeCraftTaps` - the menu takes them over
   * while it is open rather than needing keys of its own.
   */
  takeBuildTaps(): number[] {
    return this.takeCraftTaps();
  }

  /** Whether B was pressed since this was last asked, to toggle the build menu. */
  takeBuildMenuToggle(): boolean {
    const pressed = this.tapped.has('KeyB');
    this.tapped.delete('KeyB');
    return pressed;
  }

  /** Whether C was pressed since this was last asked, to toggle the craft menu. */
  takeCraftMenuToggle(): boolean {
    const pressed = this.tapped.has('KeyC');
    this.tapped.delete('KeyC');
    return pressed;
  }

  /** Whether M was pressed since this was last asked, to open or put away the big map. */
  takeMapToggle(): boolean {
    const pressed = this.tapped.has('KeyM');
    this.tapped.delete('KeyM');
    return pressed;
  }

  /** Whether I was pressed since this was last asked, to toggle the inventory panel. */
  takeInventoryToggle(): boolean {
    const pressed = this.tapped.has('KeyI');
    this.tapped.delete('KeyI');
    return pressed;
  }

  /** Whether Escape was pressed since this was last asked - closes a panel, or pauses. */
  takeEscapeToggle(): boolean {
    const pressed = this.tapped.has('Escape');
    this.tapped.delete('Escape');
    return pressed;
  }

  /**
   * Which hotbar slots were picked since this was last asked, as indices into
   * the slot order (0 for the first slot, 1 for the second, and so on).
   *
   * Read and cleared eagerly, the same reason `takeCraftTaps` is: using an
   * item is not part of the fixed-step simulation, so there is no tick for it
   * to ride along on.
   */
  takeHotbarTaps(): number[] {
    const indices: number[] = [];
    HOTBAR_KEYS.forEach((key, index) => {
      if (this.tapped.has(key)) {
        indices.push(index);
        this.tapped.delete(key);
      }
    });
    return indices;
  }

  /** Whether either Shift key is down right now. */
  isShiftHeld(): boolean {
    return this.held.has('ShiftLeft') || this.held.has('ShiftRight');
  }

  /**
   * Where the cursor is over the game, in screen pixels, or null if it has
   * not been over it yet. Stays put while the right button drags the camera,
   * when the cursor is hidden and captured.
   */
  pointerPosition(): { x: number; y: number } | null {
    return this.pointer;
  }

  /**
   * Whole mouse-wheel steps since this was last asked, then reset: positive
   * for rolling it towards you, negative for away.
   */
  takeWheelSteps(): number {
    const steps = this.wheelSteps;
    this.wheelSteps = 0;
    return steps;
  }

  /** Whether the right button was tapped, rather than held to drag the camera, since this was last asked. */
  takeRightClickTap(): boolean {
    const tapped = this.rightTapped;
    this.rightTapped = false;
    return tapped;
  }

  /**
   * Forget the left button's current press, as if it had already been let
   * go: the click that places a piece is not also a swing, and holding it a
   * moment too long must not start charging one either.
   */
  swallowLeftPress(): void {
    this.held.delete(LEFT_MOUSE);
    this.tapped.delete(LEFT_MOUSE);
    this.tapped.delete(LIGHT_ATTACK);
    this.tapped.delete(CHARGED_ATTACK);
    this.leftMouseDownAt = null;
    this.leftChargeSent = false;
    this.leftSwingSent = false;
  }

  /** How far the mouse has moved since this was last asked, then reset. */
  takeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  /**
   * Where on screen a left click landed on the game world since this was
   * last asked, or null if there was none - read and cleared eagerly, the
   * same as a craft or hotbar tap, since it rides along on whichever tick
   * happens to carry the swing it triggers rather than waiting on one itself.
   */
  takeClickPoint(): { x: number; y: number } | null {
    const point = this.pendingClickPoint;
    this.pendingClickPoint = null;
    return point;
  }

  /**
   * Let go of every held key and button, as if the player had released them
   * all at once. Used when the game pauses, so a walk or a chop in progress
   * does not silently keep going underneath the curtain.
   */
  releaseAll(): void {
    this.held.clear();
    this.tapped.clear();
    this.leftMouseDownAt = null;
    this.leftChargeSent = false;
    this.leftSwingSent = false;
    this.pendingClickPoint = null;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    this.held.add(event.code);
    this.tapped.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  /** Clicking away must not leave the player walking into a tree forever. */
  private readonly handleBlur = (): void => {
    this.releaseAll();
  };

  /**
   * Only ever tracks a right-button drag now (see `handleMouseDown`), so
   * losing it just means that drag ended - unlike the old always-locked
   * scheme, that must not clear WASD or anything else still genuinely held.
   */
  private readonly handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  /**
   * Turns the camera only during a right-button drag, when the mouse is
   * captured - see `handleMouseDown`. The rest of the time it just keeps
   * track of where the cursor is.
   */
  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) {
      this.pointer = { x: event.clientX, y: event.clientY };
      return;
    }
    this.mouseDeltaX += event.movementX;
    this.mouseDeltaY += event.movementY;
    if (this.rightDownAt !== null) {
      this.rightTravelPx += Math.abs(event.movementX) + Math.abs(event.movementY);
    }
  };

  /**
   * The right button turns the camera, WoW-style: capture the mouse for as
   * long as it is held so the drag can turn any distance without the cursor
   * hitting the edge of the screen, then let go the moment it is released
   * (see `handleMouseUp`). It never becomes a game button in its own right.
   *
   * Every other button is kept alongside the keys, under a made-up name, the
   * mouse otherwise being completely free to click on the world or the HUD -
   * see decision 0050.
   */
  private readonly handleMouseDown = (event: MouseEvent): void => {
    this.pointer = { x: event.clientX, y: event.clientY };
    if (event.button === 2) {
      this.rightDownAt = performance.now();
      this.rightTravelPx = 0;
      this.requestPointerLock();
      return;
    }
    this.held.add(mouseCode(event.button));
    this.tapped.add(mouseCode(event.button));
    if (event.button === 0) {
      this.leftMouseDownAt = performance.now();
      this.leftChargeSent = false;
      this.leftSwingSent = false;
      this.pendingClickPoint = { x: event.clientX, y: event.clientY };
    }
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) {
      if (this.pointerLocked) document.exitPointerLock();
      if (
        this.rightDownAt !== null &&
        performance.now() - this.rightDownAt < RIGHT_TAP_MAX_MS &&
        this.rightTravelPx < RIGHT_TAP_MAX_TRAVEL_PX
      ) {
        this.rightTapped = true;
      }
      this.rightDownAt = null;
      return;
    }
    this.held.delete(mouseCode(event.button));
    if (event.button === 0) {
      if (this.leftMouseDownAt !== null && !this.leftChargeSent && !this.leftSwingSent) {
        this.tapped.add(
          performance.now() - this.leftMouseDownAt < CHARGE_HOLD_MS ? LIGHT_ATTACK : CHARGED_ATTACK,
        );
      }
      this.leftMouseDownAt = null;
    }
  };

  /** Ask the browser to capture the mouse, for a right-button camera drag. */
  private requestPointerLock(): void {
    void this.canvas.requestPointerLock();
  }

  /** Adds up wheel movement into whole steps - see `WHEEL_STEP_PX`. */
  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    // Lines and pages are rare, but some mice report them instead of pixels.
    const scale =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 33
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? 400
          : 1;
    const delta = event.deltaY * scale;
    // One ordinary notch is always exactly one step, however many pixels
    // this particular mouse says a notch is worth.
    if (Math.abs(delta) >= WHEEL_STEP_PX) {
      this.wheelSteps += Math.sign(delta);
      this.wheelRemainder = 0;
      return;
    }
    this.wheelRemainder += delta;
    while (Math.abs(this.wheelRemainder) >= WHEEL_STEP_PX) {
      const sign = Math.sign(this.wheelRemainder);
      this.wheelSteps += sign;
      this.wheelRemainder -= sign * WHEEL_STEP_PX;
    }
  };

  /** The game canvas never shows the browser's own right-click menu. */
  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
