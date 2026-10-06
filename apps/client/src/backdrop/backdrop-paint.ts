/**
 * Drawing the little living world in front of the painting (decision 0106).
 *
 * `BackdropWorld` works out where everything is; this puts it on a canvas the
 * size of the painting. Everything is drawn from a few soft shapes made once, so
 * a frame is a couple of hundred small, cheap draws.
 */

import {
  PAINTING_HEIGHT,
  PAINTING_WIDTH,
  SPOTS,
  fallerX,
  glintBrightness,
  puffLook,
  rippleStrength,
  windowGlow,
  type BackdropWorld,
  type Faller,
} from './backdrop-world';

/** The same colours as the leaves and petals that fall in the game itself. */
const LEAF_COLOURS = ['#c9742a', '#d9a13a', '#a6492a', '#8c5a2b', '#e0b04a'];
const PETAL_COLOURS = ['#f6d5df', '#fff2f4', '#f2b8cb', '#fff2f4', '#f6d5df'];

/** A soft round shape, solid in the middle and fading to nothing at the edge, in one colour. */
function softShape(
  width: number,
  height: number,
  colour: readonly [number, number, number],
): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = width;
  sprite.height = height;
  const context = sprite.getContext('2d');
  if (context === null) return sprite;
  const [r, g, b] = colour;
  context.translate(width / 2, height / 2);
  context.scale(width / 2, height / 2);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gradient.addColorStop(0.45, `rgba(${r},${g},${b},0.45)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  context.fillStyle = gradient;
  context.fillRect(-1, -1, 2, 2);
  return sprite;
}

export class BackdropPainter {
  private readonly context: CanvasRenderingContext2D;
  private readonly mistShape = softShape(256, 64, [206, 223, 233]);
  private readonly smokeShape = softShape(64, 64, [216, 212, 210]);
  private readonly lampShape = softShape(64, 64, [255, 176, 82]);
  private readonly pollenShape = softShape(32, 32, [255, 228, 142]);

  constructor(context: CanvasRenderingContext2D) {
    this.context = context;
  }

  paint(world: BackdropWorld): void {
    const context = this.context;
    context.clearRect(0, 0, PAINTING_WIDTH, PAINTING_HEIGHT);
    context.globalCompositeOperation = 'source-over';
    this.paintMist(world);
    context.globalCompositeOperation = 'lighter';
    this.paintWater(world);
    this.paintWindows(world);
    context.globalCompositeOperation = 'source-over';
    this.paintSmoke(world);
    this.paintFalling(world);
    context.globalAlpha = 1;
  }

  private paintMist(world: BackdropWorld): void {
    const context = this.context;
    for (const patch of world.mist) {
      const breathing = 0.85 + 0.15 * Math.sin(world.time * 0.2 + patch.phase);
      context.globalAlpha = Math.min(1, patch.alpha * world.weather.mist * breathing);
      const bob = Math.sin(world.time * 0.15 + patch.phase) * 6;
      context.drawImage(
        this.mistShape,
        patch.x - patch.width / 2,
        patch.y + bob - patch.height / 2,
        patch.width,
        patch.height,
      );
    }
  }

  private paintWater(world: BackdropWorld): void {
    const context = this.context;
    const { water, glow } = world.weather;
    const time = world.time;

    // Long, faint lines of light that drift along and fade, as a breeze crosses the lake.
    context.fillStyle = 'rgb(160,208,222)';
    for (const ripple of world.ripples) {
      context.globalAlpha = rippleStrength(ripple, time) * 0.09 * water;
      if (context.globalAlpha < 0.004) continue;
      context.fillRect(
        ripple.x + time * ripple.speed - ripple.length / 2,
        ripple.y,
        ripple.length,
        1.6,
      );
    }

    // Short bright twinkles of the sky on the water. Ice still glints, but sits still.
    context.fillStyle = 'rgb(255,228,192)';
    for (const glint of world.glints) {
      const brightness = glintBrightness(glint, time);
      if (brightness < 0.03) continue;
      context.globalAlpha = brightness * 0.8;
      context.fillRect(glint.x - glint.length / 2, glint.y, glint.length, 1.8);
    }

    // The cabin's light lying on the water, wobbling as the water does.
    const { x, top, bottom } = SPOTS.reflection;
    context.fillStyle = 'rgb(255,170,80)';
    const dashes = 10;
    for (let i = 0; i < dashes; i++) {
      const along = i / (dashes - 1);
      const wobble = Math.sin(time * 1.4 + i * 0.9) * 3.5 * water;
      const width = 30 - along * 12;
      context.globalAlpha = Math.max(0, (0.1 + 0.05 * Math.sin(time * 2.1 + i * 1.7)) * glow);
      context.fillRect(x - width / 2 + wobble, top + (bottom - top) * along, width, 2.4);
    }
  }

  private paintWindows(world: BackdropWorld): void {
    const context = this.context;
    const strength = windowGlow(world.time, world.weather);
    for (const window of SPOTS.windows) {
      const size = window.radius * 2;
      context.globalAlpha = Math.min(1, 0.5 * strength);
      context.drawImage(
        this.lampShape,
        window.x - window.radius,
        window.y - window.radius,
        size,
        size,
      );
    }
  }

  private paintSmoke(world: BackdropWorld): void {
    const context = this.context;
    for (const puff of world.puffs) {
      const look = puffLook(puff);
      if (look.alpha < 0.004) continue;
      context.globalAlpha = look.alpha;
      context.drawImage(
        this.smokeShape,
        look.x - look.radius,
        look.y - look.radius,
        look.radius * 2,
        look.radius * 2,
      );
    }
  }

  private paintFalling(world: BackdropWorld): void {
    const context = this.context;
    for (const faller of world.fallers) {
      if (!world.showing(faller)) continue;
      const x = fallerX(faller, world.time);
      switch (faller.kind) {
        case 'snow':
          context.globalAlpha = 0.5 + faller.size * 0.12;
          context.fillStyle = '#ffffff';
          context.beginPath();
          context.arc(x, faller.y, faller.size, 0, Math.PI * 2);
          context.fill();
          break;
        case 'leaves':
          this.paintTumbler(faller, x, world.time, LEAF_COLOURS, 0.95);
          break;
        case 'petals':
          this.paintTumbler(faller, x, world.time, PETAL_COLOURS, 0.9);
          break;
        case 'pollen': {
          const pulse = 0.5 + 0.5 * Math.sin(world.time * 1.7 + faller.phase);
          const size = faller.size * 5;
          context.globalCompositeOperation = 'lighter';
          context.globalAlpha = 0.25 + pulse * 0.5;
          context.drawImage(this.pollenShape, x - size / 2, faller.y - size / 2, size, size);
          context.globalCompositeOperation = 'source-over';
          break;
        }
      }
    }
  }

  /** A leaf or petal: a small oval turning over and over as it comes down. */
  private paintTumbler(
    faller: Faller,
    x: number,
    time: number,
    colours: readonly string[],
    alpha: number,
  ): void {
    const context = this.context;
    context.globalAlpha = alpha;
    context.fillStyle = colours[faller.colour % colours.length] ?? '#d9a13a';
    context.save();
    context.translate(x, faller.y);
    context.rotate(faller.turn);
    // Seen edge-on now and then, as a real leaf is when it flips.
    context.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(time * 1.5 + faller.phase)));
    context.beginPath();
    context.ellipse(0, 0, faller.size, faller.size * 0.55, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}
