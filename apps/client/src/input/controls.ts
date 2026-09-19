/**
 * Keyboard and mouse.
 *
 * Desktop keyboard and mouse comes first. Gamepad is a later phase, and there is
 * no mobile support at launch, so nothing here worries about touch.
 */

export interface MoveIntent {
  /** -1 is left, 1 is right. */
  readonly x: number;
  /** -1 is towards the camera, 1 is away from it. */
  readonly z: number;
}

const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
]);

export class Controls {
  private readonly held = new Set<string>();
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
    if (MOVE_KEYS.has(event.code)) event.preventDefault();
    this.held.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  /** Clicking away must not leave the player walking into a tree forever. */
  private readonly handleBlur = (): void => {
    this.held.clear();
  };

  private readonly handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked) this.held.clear();
    this.onPointerLockChange(this.pointerLocked);
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += event.movementX;
    this.mouseDeltaY += event.movementY;
  };
}
