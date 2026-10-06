import * as THREE from 'three/webgpu';

import { ActionKind, type CharacterId } from '@acorn/shared';

import { readSettings } from '../settings';
import { preloadCharacterAnimations } from '../scene/character-animations';
import { preloadCharacterModels } from '../scene/character-model';
import { createCharacter, type Character, type CharacterFrame } from '../scene/character';
import {
  FrameBudget,
  KEY_TURN,
  Showcase,
  frame,
  isClick,
  normalizeYaw,
  turnedByDrag,
  type Placement,
} from './showcase';

/**
 * The character on the character screen, standing in front of the painting
 * (decision 0107).
 *
 * It is its own small scene with its own renderer on its own transparent canvas,
 * so the painted valley shows through behind it and the game's own canvas is
 * left alone until the player goes in. It shows the same real character the game
 * draws, in the same idle stance, and can be turned by dragging and clicked for
 * a little flourish.
 *
 * What it does is decided by `showcase.ts`; this is the part that touches the
 * graphics card and the page.
 */

/** A character's look on this screen. */
export interface StageLook {
  readonly character: CharacterId;
  readonly tint: number;
}

/** What a character does when it is simply standing there. */
const STANDING: CharacterFrame = {
  move: {
    kind: ActionKind.Idle,
    step: 0,
    age: 0,
    atTree: false,
    flinchVariant: 0,
    roll: 'forward',
  },
  locomotion: { speed: 0, airborne: false },
};
const AIRBORNE: CharacterFrame = { ...STANDING, locomotion: { speed: 0, airborne: true } };

/** Above this many metres up, a hop is drawn as being in the air. */
const AIRBORNE_ABOVE = 0.04;

/** How long a newly shown character takes to settle to full size, in seconds. */
const SETTLE_SECONDS = 0.35;

/** Seconds a reduced-motion character is let to fall into its idle pose before it is held. */
const SETTLE_POSE_SECONDS = 0.6;

/** Where the character is shown until the page says otherwise. */
const DEFAULT_PLACEMENT: Placement = { across: 0.5, feet: 0.16, share: 0.6 };

/** How big a character is when its real height has not been measured yet, in metres. */
const FALLBACK_HEIGHT = 1.2;

export class CharacterStage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  private readonly showcase = new Showcase();
  private readonly budget = new FrameBudget();
  private readonly reducedMotion: boolean;
  private readonly clock = { last: 0 };

  private character: Character | null = null;
  private look: StageLook | null = null;
  private height = FALLBACK_HEIGHT;
  private placement = DEFAULT_PLACEMENT;
  private turn = 0;
  private settle = 1;
  private frameHandle: number | null = null;
  private dirty = true;
  private disposed = false;
  private playingGesture = false;

  private press: { id: number; x: number; startedAt: number; moved: number } | null = null;
  private readonly cleanups: Array<() => void> = [];

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: THREE.WebGPURenderer,
  ) {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    addLights(this.scene);
    this.listen();
  }

  /**
   * Starts a stage on this canvas. Rejects when the browser cannot draw it, so
   * the screen can carry on without a character rather than not at all.
   */
  static async open(canvas: HTMLCanvasElement): Promise<CharacterStage> {
    const renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: true,
      forceWebGL: readSettings(window.location.search).forceWebGL,
    });
    try {
      await renderer.init();
      // The models and moves are the game's own, so what is fetched here is not
      // wasted: the game uses the same copies when the player goes in.
      await Promise.all([preloadCharacterModels(), preloadCharacterAnimations()]);
    } catch (error) {
      renderer.dispose();
      throw error;
    }
    renderer.setClearColor(0x000000, 0);
    const stage = new CharacterStage(canvas, renderer);
    stage.resize();
    stage.report('ready');
    stage.begin();
    return stage;
  }

  /** Stands this character on the stage, in place of whoever was there. */
  show(look: StageLook): void {
    if (this.disposed) return;
    const previous = this.look;
    if (previous?.character === look.character && this.character !== null) {
      // The same character in another tint: no need to start over.
      if (previous.tint !== look.tint) this.character.setColor(look.tint);
      this.look = look;
      this.dirty = true;
      this.report('ready');
      return;
    }
    this.removeCharacter();
    const character = createCharacter(look.character, look.tint);
    character.setName(null);
    character.group.rotation.y = Math.PI + this.turn;
    this.scene.add(character.group);
    this.character = character;
    this.look = look;
    // Let them fall into their idle stance before they are measured or seen.
    character.update(SETTLE_POSE_SECONDS, STANDING);
    this.height = measure(character.group) ?? FALLBACK_HEIGHT;
    this.settle = this.reducedMotion || previous === null ? 1 : 0;
    this.layout();
    this.dirty = true;
    this.report('ready');
  }

  /** Where on the screen the character stands and how big. */
  place(placement: Placement): void {
    this.placement = placement;
    this.layout();
    this.dirty = true;
  }

  /** Match the canvas to the size it is shown at. Called when the window changes. */
  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.budget.sharpness);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.layout();
    this.dirty = true;
  }

  /** Turn the character to face a direction, as when somebody drags or presses an arrow key. */
  turnTo(yaw: number): void {
    this.turn = normalizeYaw(yaw);
    this.dirty = true;
    this.report('ready');
  }

  /** Give a flourish, as when somebody clicks the character. */
  flourish(): void {
    if (this.showcase.click()) {
      this.playingGesture = false;
      this.dirty = true;
      this.report('ready');
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    for (const cleanup of this.cleanups) cleanup();
    this.removeCharacter();
    this.renderer.dispose();
  }

  // -- the page -------------------------------------------------------------

  /** Tells the page, and the browser tests, how the stage is getting on. */
  private report(state: 'ready'): void {
    const data = this.canvas.dataset;
    data.state = state;
    data.character = this.look?.character ?? '';
    data.tint = this.look === null ? '' : this.look.tint.toString(16).padStart(6, '0');
    data.turn = String(Math.round((this.turn * 180) / Math.PI));
    data.flourishes = String(this.showcase.count);
  }

  private listen(): void {
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
    ): void => {
      this.canvas.addEventListener(type, handler);
      this.cleanups.push(() => this.canvas.removeEventListener(type, handler));
    };

    on('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.canvas.setPointerCapture(event.pointerId);
      this.press = {
        id: event.pointerId,
        x: event.clientX,
        startedAt: performance.now(),
        moved: 0,
      };
      this.canvas.classList.add('is-turning');
    });
    on('pointermove', (event) => {
      const press = this.press;
      if (press === null || press.id !== event.pointerId) return;
      const dx = event.clientX - press.x;
      press.x = event.clientX;
      press.moved += Math.abs(dx);
      this.turnTo(turnedByDrag(this.turn, dx));
    });
    const release = (event: PointerEvent): void => {
      const press = this.press;
      if (press === null || press.id !== event.pointerId) return;
      this.press = null;
      this.canvas.classList.remove('is-turning');
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
      if (
        event.type === 'pointerup' &&
        isClick(press.moved, (performance.now() - press.startedAt) / 1000)
      ) {
        this.flourish();
      }
    };
    on('pointerup', release);
    on('pointercancel', release);

    on('keydown', (event) => {
      if (event.key === 'ArrowLeft') this.turnTo(this.turn - KEY_TURN);
      else if (event.key === 'ArrowRight') this.turnTo(this.turn + KEY_TURN);
      else if (event.key === ' ' || event.key === 'Enter') this.flourish();
      else return;
      event.preventDefault();
    });

    const onResize = (): void => this.resize();
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));
  }

  // -- the scene ------------------------------------------------------------

  private layout(): void {
    const framing = frame(this.height, this.camera.aspect, this.placement);
    this.camera.position.set(framing.x, framing.lookY + 0.25, framing.distance);
    this.camera.lookAt(framing.x, framing.lookY, 0);
    this.camera.updateProjectionMatrix();
  }

  private removeCharacter(): void {
    if (this.character === null) return;
    this.scene.remove(this.character.group);
    this.character.dispose();
    this.character = null;
  }

  private begin(): void {
    this.clock.last = performance.now();
    const tick = (now: number): void => {
      this.frameHandle = requestAnimationFrame(tick);
      const seconds = Math.min(0.1, (now - this.clock.last) / 1000);
      this.clock.last = now;
      if (document.hidden) return;
      this.draw(seconds);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }

  private draw(seconds: number): void {
    const character = this.character;
    if (character === null) return;

    // Standing still is a held pose for somebody who asked for less motion, and
    // for a computer that could not keep up; a flourish still plays when asked for.
    const moving = this.showcase.playing || (!this.reducedMotion && !this.budget.stopped);
    if (!moving && !this.dirty) return;

    const began = performance.now();
    this.showcase.step(seconds);
    const view = this.showcase.view();
    if (view.flourish !== null && view.flourish.gesture !== null && !this.playingGesture) {
      character.playGesture(view.flourish.gesture, null);
      this.playingGesture = true;
    }
    if (view.flourish === null) this.playingGesture = false;

    if (this.settle < 1) this.settle = Math.min(1, this.settle + seconds / SETTLE_SECONDS);
    const size = 0.9 + 0.1 * easeOut(this.settle);
    character.group.scale.setScalar(size);
    character.group.position.y = view.lift;
    character.group.rotation.y = Math.PI + this.turn;

    character.update(moving ? seconds : 0, view.lift > AIRBORNE_ABOVE ? AIRBORNE : STANDING);
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;

    if (this.budget.record(performance.now() - began)) this.resize();
  }
}

/** How tall a drawn character is, in metres, or null when it has no body to measure. */
function measure(group: THREE.Object3D): number | null {
  const box = new THREE.Box3().setFromObject(group);
  const height = box.max.y - box.min.y;
  return Number.isFinite(height) && height > 0.2 ? height : null;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** The light the painting is lit by: soft from the sky, warm from the front, a cool edge from behind. */
function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xcfe3f0, 0x6a5a45, 1.5));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.4);
  key.position.set(-2.5, 3.2, 3.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.1);
  rim.position.set(2.6, 2.2, -3);
  scene.add(rim);
}
