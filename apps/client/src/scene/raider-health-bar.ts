import * as THREE from 'three/webgpu';

/**
 * A skeleton's health over its head: a red bar that drops the moment a blow
 * lands, with a pale strip behind it showing what that blow took, which
 * catches up a beat later - so every blow reads, even in a crowd. Named
 * when it is the one in front of the player, the one a swing would hit.
 *
 * Drawn to a small canvas, like a nameplate (see nameplate.ts), and only
 * redrawn when something about it changes.
 */

const WIDTH = 192;
const HEIGHT = 56;
const BAR_TOP = 34;
const BAR_HEIGHT = 16;
/** World size, by eye against a standing skeleton. */
const WORLD_WIDTH = 0.82;
/** How long the pale strip waits before catching up, and how fast it does, per second. */
const TRAIL_HOLD_SECONDS = 0.35;
const TRAIL_CATCH_UP = 1.6;
/** How fast it fades in and out, per second. */
const FADE_RATE = 5;

const FONT =
  "600 22px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export class RaiderHealthBar {
  readonly sprite: THREE.Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.SpriteMaterial;
  private health = 1;
  private trailing = 1;
  private hold = 0;
  private named = false;
  private wanted = false;
  private opacity = 0;
  private dirty = true;

  constructor(private readonly name: string) {
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    const context = this.canvas.getContext('2d');
    if (context === null) throw new Error('2D canvas context unavailable');
    this.context = context;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.renderOrder = 11;
    this.sprite.scale.set(WORLD_WIDTH, (WORLD_WIDTH * HEIGHT) / WIDTH, 1);
    this.sprite.visible = false;
  }

  /** How much health is left, from 0 to 1. */
  setHealth(fraction: number): void {
    const next = Math.min(1, Math.max(0, fraction));
    if (next === this.health) return;
    if (next < this.health) this.hold = TRAIL_HOLD_SECONDS;
    else this.trailing = next;
    this.health = next;
    this.dirty = true;
  }

  /** Shown or not: worth seeing once it is hurt, close, or in front of the player. */
  setWanted(wanted: boolean, named: boolean): void {
    this.wanted = wanted;
    if (named !== this.named) {
      this.named = named;
      this.dirty = true;
    }
  }

  update(deltaSeconds: number): void {
    const fadeTo = this.wanted ? 1 : 0;
    this.opacity +=
      Math.sign(fadeTo - this.opacity) *
      Math.min(Math.abs(fadeTo - this.opacity), FADE_RATE * deltaSeconds);
    this.material.opacity = this.opacity;
    this.sprite.visible = this.opacity > 0.01;
    if (this.trailing > this.health) {
      if (this.hold > 0) {
        this.hold -= deltaSeconds;
      } else {
        this.trailing = Math.max(this.health, this.trailing - TRAIL_CATCH_UP * deltaSeconds);
        this.dirty = true;
      }
    }
    if (this.dirty && this.sprite.visible) this.draw();
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }

  private draw(): void {
    this.dirty = false;
    const context = this.context;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (this.named) {
      context.font = FONT;
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.lineWidth = 4;
      context.strokeStyle = 'rgba(20, 16, 14, 0.75)';
      context.strokeText(this.name, WIDTH / 2, BAR_TOP - 4);
      context.fillStyle = '#f3efe4';
      context.fillText(this.name, WIDTH / 2, BAR_TOP - 4);
    }
    const inset = 3;
    const left = 8;
    const width = WIDTH - left * 2;
    context.fillStyle = 'rgba(20, 16, 14, 0.78)';
    context.beginPath();
    context.roundRect(left, BAR_TOP, width, BAR_HEIGHT, 5);
    context.fill();
    const inner = width - inset * 2;
    const innerHeight = BAR_HEIGHT - inset * 2;
    if (this.trailing > this.health) {
      context.fillStyle = '#f4e3c0';
      context.fillRect(left + inset, BAR_TOP + inset, inner * this.trailing, innerHeight);
    }
    context.fillStyle = '#d9473a';
    context.fillRect(left + inset, BAR_TOP + inset, inner * this.health, innerHeight);
    // A lighter top edge, so it reads as a bar rather than a flat stripe.
    context.fillStyle = 'rgba(255, 255, 255, 0.22)';
    context.fillRect(left + inset, BAR_TOP + inset, inner * this.health, innerHeight / 3);
    this.texture.needsUpdate = true;
  }
}
