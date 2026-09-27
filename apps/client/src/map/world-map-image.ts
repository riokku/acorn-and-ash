/**
 * The painted world map as something a canvas can draw (see decision 0054).
 */

import { MAP_IMAGE_SIZE, mapWorldFromSeed, paintWorldMap } from './paint-map';

/**
 * Paint the map for this seed, in a worker where the browser has them, and
 * hand it back as a canvas ready to draw from. Falls back to painting right
 * here if a worker cannot be started, which costs a hitch but still works.
 */
export async function paintWorldMapImage(seed: number): Promise<HTMLCanvasElement> {
  const pixels = await paintInWorker(seed, MAP_IMAGE_SIZE).catch(() =>
    paintWorldMap(mapWorldFromSeed(seed), MAP_IMAGE_SIZE).toBytes(),
  );
  const canvas = document.createElement('canvas');
  canvas.width = MAP_IMAGE_SIZE;
  canvas.height = MAP_IMAGE_SIZE;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('No 2D canvas to hold the map');
  const image = context.createImageData(MAP_IMAGE_SIZE, MAP_IMAGE_SIZE);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  return canvas;
}

function paintInWorker(seed: number, size: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./map-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ pixels: Uint8Array }>) => {
      worker.terminate();
      resolve(event.data.pixels);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ seed, size });
  });
}
