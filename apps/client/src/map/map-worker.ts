/**
 * Paints the world map off the main thread (see decision 0054), so the half
 * second or so it takes never costs the game a frame. Handed the world's
 * seed, it builds the same world the game does and sends back the painted
 * page as raw pixels.
 */

import { mapWorldFromSeed, paintWorldMap } from './paint-map';

interface PaintRequest {
  readonly seed: number;
  readonly size: number;
}

// The worker's own global scope. The client is typed against the page's DOM,
// not a worker's, so this spells out the two things a worker needs from it
// rather than pulling in a second, clashing set of global types.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PaintRequest>) => void) | null;
  postMessage(message: { readonly pixels: Uint8Array }, transfer: Transferable[]): void;
};

scope.onmessage = (event) => {
  const { seed, size } = event.data;
  const pixels = paintWorldMap(mapWorldFromSeed(seed), size).toBytes();
  scope.postMessage({ pixels }, [pixels.buffer]);
};
