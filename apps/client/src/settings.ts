import { parseSeason, type SeasonId } from '@acorn/shared';

/** The world to join when nothing says otherwise. */
export const DEFAULT_WORLD_ID_FALLBACK = 'home-clearing';

export interface Settings {
  readonly worldId: string | undefined;
  /**
   * Force the WebGL 2 fallback even where WebGPU is available, so the two can be
   * compared without changing browsers. Set with `?renderer=webgl2`.
   */
  readonly forceWebGL: boolean;
  /**
   * Show the world in this season whatever the calendar says, so a season can
   * be looked at without waiting up to six hours for it. Set with
   * `?season=winter`. Only this browser's view changes (decision 0089).
   */
  readonly season: SeasonId | undefined;
  /**
   * Ask the world for one of every piece of gear to try on, until gear can be
   * found. Set with `?gear=all`; only previews and local runs honour it
   * (decision 0113).
   */
  readonly gear: boolean;
}

/** Read settings from the build's environment, overridden by the query string. */
export function readSettings(search: string): Settings {
  const params = new URLSearchParams(search);
  return {
    worldId: params.get('world') ?? import.meta.env.VITE_WORLD_ID ?? undefined,
    forceWebGL: params.get('renderer') === 'webgl2',
    season: parseSeason(params.get('season')),
    gear: params.has('gear'),
  };
}
