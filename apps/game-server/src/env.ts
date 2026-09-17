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
}
