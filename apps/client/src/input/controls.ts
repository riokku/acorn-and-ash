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
   * hands over each thing exactly once.
   */
  buttons(): number {
    let buttons = 0;
    if (this.held.has('Space') || this.tapped.has('Space')) buttons |= PlayerButton.Jump;
    if (this.held.has('ShiftLeft') || this.held.has('ShiftRight')) buttons |= PlayerButton.Sprint;
    if (this.held.has('KeyE') || this.tapped.has('KeyE')) buttons |= PlayerButton.Interact;
    return buttons;
  }

  /** Called once a tick has actually carried the taps, so they are not sent twice. */
  forgetTaps(): void {
    this.tapped.clear();
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
}
