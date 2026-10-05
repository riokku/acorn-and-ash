/**
 * What the game server Worker is given by Cloudflare.
 *
 * The bindings themselves come from `worker-configuration.d.ts`, which is
 * generated from `wrangler.jsonc` by `pnpm types`. This adds the optional
 * variables that are set in the dashboard rather than in the config file.
 */
export interface WorldEnv extends Env {
  /** Overrides the seed new worlds are built from. Handy for testing. */
  readonly WORLD_SEED?: string;
  /**
   * The shortest a felled tree takes to grow back, in seconds. Trees return
   * somewhere between this and twice it.
   *
   * Set low on previews and local runs so a tree growing back can be watched
   * rather than waited out. Unset everywhere real, where it is half an hour.
   */
  readonly WORLD_REGROW_SECONDS?: string;
  /**
   * The shortest a picked-clean stick or flower patch takes to grow back
   * somewhere new, in seconds. Patches return somewhere between this and
   * twice it.
   *
   * Set low on previews and local runs so a patch moving can be watched in
   * one sitting. Three minutes everywhere real.
   */
  readonly WORLD_PATCH_REGROW_SECONDS?: string;
  /**
   * The shortest a cut-clean bed of mature reeds, at the pond or the lake,
   * takes to come back somewhere else round the same shore, in seconds. Reeds return somewhere
   * between this and a bit over half as long again.
   *
   * Set low on previews and local runs so a bed moving can be watched in one
   * sitting. Fifteen minutes (so fifteen to twenty-five) everywhere real.
   */
  readonly WORLD_REED_REGROW_SECONDS?: string;
  /**
   * How long a full hunger meter takes to run out, in seconds, if nothing is
   * eaten.
   *
   * Set low on previews and local runs so it can be watched rather than
   * waited out. Unset everywhere real, where it is twenty minutes.
   */
  readonly WORLD_HUNGER_EMPTY_SECONDS?: string;
  /**
   * The shortest time a player spends outdoors between skeleton raids, in
   * seconds of daytime. Raids come somewhere between this and one and a half
   * times it, twice as often at night.
   *
   * Set low on previews and local runs so a raid can be waited for in one
   * sitting. Four minutes everywhere real.
   */
  readonly WORLD_RAID_SECONDS?: string;
  /**
   * Set to "1" to let a browser pick the season with `?season=` (decision
   * 0089), for looking at winter without waiting for it.
   *
   * Set on local runs, the browser tests and previews only. Left unset on
   * staging and production, where the seasons follow the world's own clock.
   */
  readonly WORLD_ALLOW_TEST_SEASON?: string;
}
