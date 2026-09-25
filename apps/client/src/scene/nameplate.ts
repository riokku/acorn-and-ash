import * as THREE from 'three/webgpu';

/**
 * A small floating name label above a character's head.
 *
 * Drawn once to a 2D canvas and kept as a sprite's texture rather than built
 * from real geometry - the cheapest way to get crisp, always-camera-facing
 * text, and the same trick the rest of the client already leans on for
 * anything that is easier to draw than to model (see the HUD itself, which
 * is plain HTML over the canvas rather than a 3D overlay).
 */
export interface Nameplate {
  readonly sprite: THREE.Sprite;
  setText(text: string): void;
  dispose(): void;
}

const FONT =
  "600 40px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const PADDING_X = 20;
const CANVAS_HEIGHT = 64;
/** World-space height of the plate, tuned by eye against a standing character. */
const WORLD_HEIGHT = 0.34;

export function createNameplate(text: string): Nameplate {
  const canvas = document.createElement('canvas');
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('2D canvas context unavailable');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  // Drawn after the world, so a nameplate never gets lost inside foliage.
  sprite.renderOrder = 10;

  let lastText: string | null = null;

  const draw = (label: string): void => {
    if (label === lastText) return;
    lastText = label;

    // Measuring needs a font set first; the canvas resize below then clears
    // the context back to its defaults, so it is set again afterwards too.
    context.font = FONT;
    const width = Math.ceil(context.measureText(label).width) + PADDING_X * 2;
    canvas.width = width;

    context.font = FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.fillStyle = 'rgba(20, 24, 20, 0.55)';
    context.roundRect(0, 0, width, CANVAS_HEIGHT, CANVAS_HEIGHT / 2);
    context.fill();

    context.fillStyle = '#f3efe4';
    context.fillText(label, width / 2, CANVAS_HEIGHT / 2 + 2);

    texture.needsUpdate = true;
    sprite.scale.set((width / CANVAS_HEIGHT) * WORLD_HEIGHT, WORLD_HEIGHT, 1);
  };

  draw(text);

  return {
    sprite,
    setText: draw,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
