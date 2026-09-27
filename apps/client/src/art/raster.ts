/**
 * A square of pixels to paint a texture onto, in code (see decision 0053).
 *
 * Everything drawn wraps around the edges - a dab that hangs off the right
 * reappears on the left - so the finished texture tiles with no seam, the
 * same promise `tileableNoise` makes. Colours are plain 0-1 sRGB, the way a
 * painter picks them, never linear light.
 *
 * No DOM and no Three.js, so it can be tested on its own; `texture.ts` turns
 * a finished raster into something the renderer can use.
 */

export type Rgb = readonly [number, number, number];

export class Raster {
  readonly size: number;
  /** Red, green and blue for every pixel, row by row. */
  readonly rgb: Float32Array;

  constructor(size: number) {
    this.size = size;
    this.rgb = new Float32Array(size * size * 3);
  }

  /** Colour every pixel from where it is: `u` and `v` both run 0 to 1 across the texture. */
  fill(colourAt: (u: number, v: number, out: [number, number, number]) => void): void {
    const out: [number, number, number] = [0, 0, 0];
    const { size, rgb } = this;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        colourAt((x + 0.5) / size, (y + 0.5) / size, out);
        const index = (y * size + x) * 3;
        rgb[index] = out[0];
        rgb[index + 1] = out[1];
        rgb[index + 2] = out[2];
      }
    }
  }

  /** The colour at a pixel, wrapping around the edges. */
  get(x: number, y: number): Rgb {
    const index = (this.wrapIndex(y) * this.size + this.wrapIndex(x)) * 3;
    return [this.rgb[index] ?? 0, this.rgb[index + 1] ?? 0, this.rgb[index + 2] ?? 0];
  }

  /**
   * A soft round dab of colour, centred at (x, y) in pixels: fully `alpha` in
   * the middle, fading to nothing at `radius`. `hardness` near 1 gives a crisp
   * edge, near 0 a very soft one.
   */
  dab(x: number, y: number, radius: number, colour: Rgb, alpha: number, hardness = 0.5): void {
    const reach = Math.ceil(radius + 1);
    const inner = radius * hardness;
    const { rgb, size } = this;
    for (let py = Math.floor(y - reach); py <= Math.ceil(y + reach); py++) {
      const row = this.wrapIndex(py) * size;
      for (let px = Math.floor(x - reach); px <= Math.ceil(x + reach); px++) {
        const distance = Math.hypot(px + 0.5 - x, py + 0.5 - y);
        if (distance >= radius) continue;
        const falloff =
          distance <= inner ? 1 : 1 - (distance - inner) / Math.max(1e-6, radius - inner);
        const a = alpha * falloff * falloff * (3 - 2 * falloff);
        const index = (row + this.wrapIndex(px)) * 3;
        rgb[index] = (rgb[index] ?? 0) + (colour[0] - (rgb[index] ?? 0)) * a;
        rgb[index + 1] = (rgb[index + 1] ?? 0) + (colour[1] - (rgb[index + 1] ?? 0)) * a;
        rgb[index + 2] = (rgb[index + 2] ?? 0) + (colour[2] - (rgb[index + 2] ?? 0)) * a;
      }
    }
  }

  /**
   * A brush stroke along a gentle curve from `from` to `to`, bending through
   * `bend` on the way, tapering from `startWidth` to `endWidth` - a grass
   * blade, a line of wood grain, a streak of bark.
   */
  stroke(
    from: readonly [number, number],
    bend: readonly [number, number],
    to: readonly [number, number],
    startWidth: number,
    endWidth: number,
    colour: Rgb,
    alpha: number,
    hardness = 0.6,
  ): void {
    const length =
      Math.hypot(bend[0] - from[0], bend[1] - from[1]) +
      Math.hypot(to[0] - bend[0], to[1] - bend[1]);
    const steps = Math.max(
      2,
      Math.ceil(length / Math.max(0.5, Math.min(startWidth, endWidth) * 0.5)),
    );
    // Many overlapping dabs would build up far past `alpha`; each gives only
    // a share, so the stroke as a whole comes out about as strong as asked.
    const perDab = 1 - Math.pow(1 - alpha, 1 / Math.max(1, Math.min(steps, 4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      const x = a * from[0] + b * bend[0] + c * to[0];
      const y = a * from[1] + b * bend[1] + c * to[1];
      const width = startWidth + (endWidth - startWidth) * t;
      this.dab(x, y, Math.max(0.5, width / 2), colour, perDab, hardness);
    }
  }

  /** Darken or lighten everything by a factor that varies with where it is. */
  shade(factorAt: (u: number, v: number) => number): void {
    const { size, rgb } = this;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const factor = factorAt((x + 0.5) / size, (y + 0.5) / size);
        const index = (y * size + x) * 3;
        rgb[index] = (rgb[index] ?? 0) * factor;
        rgb[index + 1] = (rgb[index + 1] ?? 0) * factor;
        rgb[index + 2] = (rgb[index + 2] ?? 0) * factor;
      }
    }
  }

  /** Four bytes a pixel, red-green-blue-alpha, ready to hand to the renderer. */
  toBytes(): Uint8Array {
    const { size, rgb } = this;
    const bytes = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      bytes[i * 4] = toByte(rgb[i * 3] ?? 0);
      bytes[i * 4 + 1] = toByte(rgb[i * 3 + 1] ?? 0);
      bytes[i * 4 + 2] = toByte(rgb[i * 3 + 2] ?? 0);
      bytes[i * 4 + 3] = 255;
    }
    return bytes;
  }

  private wrapIndex(value: number): number {
    const wrapped = value % this.size;
    return wrapped < 0 ? wrapped + this.size : wrapped;
  }
}

function toByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

/** A colour from a 0xRRGGBB number, as 0-1 sRGB. */
export function hex(value: number): Rgb {
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

/** Part way from one colour to another. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A colour made lighter (above 1) or darker (below 1). */
export function scaleRgb(colour: Rgb, factor: number): Rgb {
  return [colour[0] * factor, colour[1] * factor, colour[2] * factor];
}
