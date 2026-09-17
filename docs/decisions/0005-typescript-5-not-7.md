# 0005. Pin TypeScript 5.9 for now

**Status:** accepted · **Date:** 2026-09-17

## Context

TypeScript 7, the native compiler, is the current release and is considerably
faster. CLAUDE.md asks for TypeScript in strict mode everywhere but does not name
a version.

## Decision

Pin `typescript` to 5.9.3 across the workspace.

`typescript-eslint` 8.70 declares `typescript >=4.8.4 <6.1.0` as a peer
dependency, so installing TypeScript 7 alongside it means either a broken lint
setup or dropping type-aware linting.

## Consequences

- Typechecking is slower than it needs to be. On a repository this size that is
  a second or two.
- Revisit as soon as `typescript-eslint` supports TypeScript 7. Nothing in the
  codebase depends on 5.9 specifically, so the change should be a version bump
  and a lockfile update.
