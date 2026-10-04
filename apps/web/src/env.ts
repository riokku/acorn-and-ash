/**
 * What the web Worker is given by Cloudflare.
 *
 * The bindings come from `worker-configuration.d.ts`, generated from
 * `wrangler.jsonc` by `pnpm types`. Everything that is not in that config is
 * typed here as possibly missing and checked where it is used:
 *
 * - `BETTER_AUTH_SECRET` signs the session cookie. Deployed environments have
 *   it made for them (see `tools/prepare-accounts.mjs`).
 * - The Google and Discord pairs are what each login service gave us. They are
 *   set by hand as secrets on the Worker in the Cloudflare dashboard, and a
 *   service whose pair is missing simply isn't offered.
 * - `TEST_SIGN_IN` is only ever set for your own machine and for pull request
 *   previews (decision 0086).
 */
export type WebEnv = Omit<Env, 'BETTER_AUTH_SECRET' | 'TEST_SIGN_IN'> & {
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  TEST_SIGN_IN?: string;
};
