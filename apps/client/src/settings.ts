/** The world to join when nothing says otherwise. */
export const DEFAULT_WORLD_ID_FALLBACK = 'home-clearing';

export interface Settings {
  readonly worldId: string | undefined;
  readonly serverUrl: string | undefined;
  /**
   * Force the WebGL 2 fallback even where WebGPU is available, so the two can be
   * compared without changing browsers. Set with `?renderer=webgl2`.
   */
  readonly forceWebGL: boolean;
}

/** Read settings from the build's environment, overridden by the query string. */
export function readSettings(search: string): Settings {
  const params = new URLSearchParams(search);
  return {
    worldId: params.get('world') ?? import.meta.env.VITE_WORLD_ID ?? undefined,
    serverUrl: import.meta.env.VITE_GAME_SERVER_URL ?? undefined,
    forceWebGL: params.get('renderer') === 'webgl2',
  };
}
