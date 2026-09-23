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

/** Hotkeys for crafting, in recipe order: 1 is the first recipe, 2 the second. */
const CRAFT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'] as const;

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

  private readonly canvas: HTMLCanvasElement;
  private readonly onPointerLockChange: (locked: boolean) => void;

  constructor(canvas: HTMLCanvasElement, onPointerLockChange: (locked: boolean) => void) {
    this.canvas = canvas;
    this.onPointerLockChange = onPointerLockChange;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    // On the window, so letting go outside the canvas still counts as letting go.
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  /** Ask the browser to capture the mouse so the camera can turn freely. */
  requestPointerLock(): void {
    void this.canvas.requestPointerLock();
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
   * hands over each thing exactly once. Holding the mouse button chops at a
   * steady rhythm, because the server decides how often an axe may swing.
   */
  buttons(): number {
    let buttons = 0;
    if (this.held.has('Space') || this.tapped.has('Space')) buttons |= PlayerButton.Jump;
    if (this.held.has('ShiftLeft') || this.held.has('ShiftRight')) buttons |= PlayerButton.Sprint;
    if (this.held.has('KeyE') || this.tapped.has('KeyE')) buttons |= PlayerButton.Interact;
    if (this.held.has(LEFT_MOUSE) || this.tapped.has(LEFT_MOUSE)) buttons |= PlayerButton.Swing;
    if (this.held.has('ControlLeft') || this.tapped.has('ControlLeft')) {
      buttons |= PlayerButton.Dodge;
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

  /** How far the mouse has moved since this was last asked, then reset. */
  takeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
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
    this.held.clear();
    this.tapped.clear();
  };

  private readonly handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked) {
      this.held.clear();
      this.tapped.clear();
    }
    this.onPointerLockChange(this.pointerLocked);
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += event.movementX;
    this.mouseDeltaY += event.movementY;
  };

  /**
   * Mouse buttons are kept alongside the keys, under made-up names.
   *
   * Only while the mouse is captured: the click that starts the game must not
   * also be read as a swing at whatever happens to be in front of you.
   */
  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.held.add(mouseCode(event.button));
    this.tapped.add(mouseCode(event.button));
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    this.held.delete(mouseCode(event.button));
  };
}
