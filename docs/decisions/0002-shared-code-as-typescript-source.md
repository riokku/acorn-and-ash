# 0002. `packages/shared` is consumed as TypeScript source

**Status:** accepted · **Date:** 2026-09-17

## Context

The client and the server have to run exactly the same movement and collision
code, or the player will be corrected by the server constantly. That means
`packages/shared` is imported by a Vite build, by a Workers build and by tests.

The usual approach is to compile the package to `dist/` first. That adds a build
step before every typecheck, every test run and every dev server start, and it
makes stack traces point at generated files.

## Decision

`packages/shared` publishes its `src/*.ts` files directly through its `exports`
field. There is no build step.

Vite, Wrangler (esbuild) and Vitest all compile TypeScript from a workspace
dependency without complaint, and the package is private and never published to
a registry.

## Consequences

- `pnpm dev` works from a clean checkout with no build ordering to remember.
- Type errors in shared code show up in whichever app imports it, which is the
  behaviour we want.
- If `packages/shared` ever needs to be published, it will need a real build.
  It is internal, so that day is unlikely to come.
