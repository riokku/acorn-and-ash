declare module 'cloudflare:test' {
  // The bindings the tests get are the ones in wrangler.jsonc.
  interface ProvidedEnv extends Env {}
}
