# 0007. One build, WebGPU where it exists and WebGL 2 everywhere else

**Status:** accepted · **Date:** 2026-09-17

## Context

The game has to run in Chrome, Firefox and Safari without asking anyone to
install anything. WebGPU is faster and is where Three.js is heading, but support
still varies by browser and by machine.

## Decision

Use `WebGPURenderer` from `three/webgpu` for everything, and let it choose.

It uses WebGPU when the browser has it and falls back to WebGL 2 by itself when
it does not, from the same build and the same scene code. The HUD shows which
backend was picked, so a playtester can tell at a glance.

`?renderer=webgl2` on the URL forces the fallback, which makes the two paths
comparable in one browser instead of needing three.

## Consequences

- One build to ship and one set of scene code to maintain.
- The client bundle is about 1.1 MB (325 KB gzipped), most of it the combined
  WebGPU and WebGL renderer. Worth watching, and worth revisiting before launch.
- Anything written against WebGPU-only features would break the fallback
  silently, so effects have to be checked on both paths. The HUD readout and the
  `?renderer=webgl2` switch exist to make that easy.
