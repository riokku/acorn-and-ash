declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

declare namespace Cloudflare {
  interface Env {
    /** The accounts migrations, read in `vitest.config.ts`. */
    TEST_MIGRATIONS: D1Migration[];
  }
}
