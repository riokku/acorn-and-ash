/**
 * The shape of the opening of a hole in the ground (decision 0114).
 *
 * A hole is dug in whole-metre squares, so its mouth starts out square. These
 * work on a grid of small samples laid over the ground (`size` by `size`, row
 * by row), turning that square mouth into a round one and working out how
 * close to the lip each sample is, for the heap of dirt that rings it.
 */

/** How far, in samples, the round mouth's curve reaches in from a square one's corner. */
export const MOUTH_RADIUS = 9;
/** Holes smaller than a round mouth could fit keep a small square one instead of vanishing. */
const SMALL_HOLE_SHRINK = 2;
const SMALL_HOLE_REACH = 6;
/** Two passes of this box blur make the soft edge the dirt heap is shaped by. */
export const EDGE_BLUR = 5;

/** Half the width of a disc of this radius, for each row from the top to the bottom of it. */
function discHalfWidths(radius: number): number[] {
  const widths: number[] = [];
  for (let dy = -radius; dy <= radius; dy++)
    widths.push(Math.floor(Math.sqrt(radius * radius + radius - dy * dy + 0.25)));
  return widths;
}

/** Running totals along each row, so any stretch of a row can be counted at once. */
function rowTotals(mask: Uint8Array, size: number): Int32Array {
  const totals = new Int32Array((size + 1) * size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++)
      totals[row * (size + 1) + column + 1] =
        totals[row * (size + 1) + column]! + (mask[row * size + column] === 0 ? 0 : 1);
  }
  return totals;
}

/**
 * Where a disc of this radius, centred on each sample, lies wholly inside the
 * mask (`wholly`), or touches it at all (otherwise).
 */
function fitDisc(mask: Uint8Array, size: number, radius: number, wholly: boolean): Uint8Array {
  const totals = rowTotals(mask, size);
  const widths = discHalfWidths(radius);
  const out = new Uint8Array(size * size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      let result = wholly;
      for (let dy = -radius; dy <= radius; dy++) {
        const y = row + dy;
        const half = widths[dy + radius]!;
        const from = column - half;
        const to = column + half;
        if (y < 0 || y >= size || from < 0 || to >= size) {
          // Off the edge of the grid counts as solid ground.
          if (wholly) {
            result = false;
            break;
          }
          continue;
        }
        const count = totals[y * (size + 1) + to + 1]! - totals[y * (size + 1) + from]!;
        if (wholly ? count !== to - from + 1 : count > 0) {
          result = !wholly;
          break;
        }
      }
      out[row * size + column] = result ? 1 : 0;
    }
  }
  return out;
}

/**
 * The mouth of a hole made round: every spot a disc as wide as the curve of a
 * corner could be pressed into without leaving the dug squares, then grown
 * back out to its full size. Straight edges and inward corners stay as they
 * were; outward corners are rounded off. A hole too small for that disc keeps a
 * small square mouth, so nothing dug is ever covered over.
 */
export function roundedMouth(dug: Uint8Array, size: number): Uint8Array {
  const rounded = fitDisc(fitDisc(dug, size, MOUTH_RADIUS, true), size, MOUTH_RADIUS, false);
  const small = fitDisc(dug, size, SMALL_HOLE_SHRINK, true);
  const nearRounded = fitDisc(rounded, size, SMALL_HOLE_REACH, false);
  for (let i = 0; i < rounded.length; i++)
    if (small[i] === 1 && nearRounded[i] === 0) rounded[i] = 1;
  return rounded;
}

function boxBlur(values: Float32Array, size: number, radius: number): Float32Array {
  const across = new Float32Array(size * size);
  const out = new Float32Array(size * size);
  const width = radius * 2 + 1;
  const totals = new Float32Array(size + 1);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++)
      totals[column + 1] = totals[column]! + values[row * size + column]!;
    for (let column = 0; column < size; column++) {
      const from = Math.max(0, column - radius);
      const to = Math.min(size - 1, column + radius);
      across[row * size + column] = (totals[to + 1]! - totals[from]!) / width;
    }
  }
  for (let column = 0; column < size; column++) {
    for (let row = 0; row < size; row++)
      totals[row + 1] = totals[row]! + across[row * size + column]!;
    for (let row = 0; row < size; row++) {
      const from = Math.max(0, row - radius);
      const to = Math.min(size - 1, row + radius);
      out[row * size + column] = (totals[to + 1]! - totals[from]!) / width;
    }
  }
  return out;
}

/**
 * How much of the mouth lies near each sample, from 0 well away from it to
 * 1 well inside it, and about a half right at its lip. Reaches about half a
 * metre out at a twentieth of a metre a sample, which is as far as a hole's
 * heap of dirt may spread.
 */
export function softEdge(mouth: Uint8Array, size: number): Float32Array {
  const values = Float32Array.from(mouth);
  return boxBlur(boxBlur(values, size, EDGE_BLUR), size, EDGE_BLUR);
}
