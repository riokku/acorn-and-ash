/**
 * What the web Worker is given by Cloudflare.
 *
 * The bindings come from `worker-configuration.d.ts`, generated from
 * `wrangler.jsonc` by `pnpm types`. The session secret is the one thing that
 * isn't in the config: deployed environments have it set for them (see
 * `tools/prepare-accounts.mjs`), so it is typed here as possibly missing and
 * checked where it is used.
 */
export type WebEnv = Omit<Env, 'BETTER_AUTH_SECRET'> & {
  BETTER_AUTH_SECRET?: string;
};
