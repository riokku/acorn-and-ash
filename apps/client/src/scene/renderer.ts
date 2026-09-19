import { WebGPURenderer } from 'three/webgpu';

/** Which drawing backend the browser actually gave us. */
export type RenderBackend = 'WebGPU' | 'WebGL 2' | 'unknown';

export interface RendererSetup {
  readonly renderer: WebGPURenderer;
  readonly backend: RenderBackend;
  /** True when the browser could have used WebGPU but we asked it not to. */
  readonly forcedFallback: boolean;
}

/**
 * Start the renderer.
 *
 * `WebGPURenderer` uses WebGPU where the browser has it and quietly falls back to
 * WebGL 2 everywhere else, which is why the same build works in Chrome, Firefox
 * and Safari. Adding `?renderer=webgl2` to the URL forces the fallback, so the
 * two paths can be compared side by side without changing browsers.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  forceWebGL = false,
): Promise<RendererSetup> {
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  await renderer.init();

  return { renderer, backend: detectBackend(renderer), forcedFallback: forceWebGL };
}

/**
 * Ask the renderer which backend it settled on.
 *
 * The flags exist at runtime but are not on the shared `Backend` type, so this is
 * the one place that looks at them.
 */
export function detectBackend(renderer: WebGPURenderer): RenderBackend {
  const backend = renderer.backend as unknown as {
    isWebGPUBackend?: boolean;
    isWebGLBackend?: boolean;
  };
  if (backend.isWebGPUBackend === true) return 'WebGPU';
  if (backend.isWebGLBackend === true) return 'WebGL 2';
  return 'unknown';
}

/** Whether this browser claims to support WebGPU at all. */
export function browserAdvertisesWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}
