#!/usr/bin/env node
// Downloads the free Polyfork models listed in tools/polyfork-models.json into
// apps/client/public/polyfork/<name>.glb, Meshopt-compressed by import-model.mjs.
// (A free Polyfork model is only a few hundred kilobytes, so that is plenty.)
// Runs before every client build and dev server. Polyfork's licence lets the
// game ship these models but not redistribute the files, and this repo is
// public, so the files are never committed (see decision 0272).
//
// A model already downloaded is kept; pass --refresh to fetch them all again.
// A failed download only warns: the game draws that model's placeholder shape
// until the next build fetches it.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(repoRoot, 'tools/polyfork-models.json'), 'utf8'));
const outDir = join(repoRoot, 'apps/client/public/polyfork');
const importModel = join(repoRoot, 'tools/import-model.mjs');
const refresh = process.argv.includes('--refresh');

/** Polyfork asks callers to name themselves. */
const USER_AGENT = 'acorn-and-ash-build (https://github.com/riokku/acorn-and-ash)';

mkdirSync(outDir, { recursive: true });

const failed = [];
for (const model of manifest.models) {
  const target = join(outDir, `${model.name}.glb`);
  if (existsSync(target) && !refresh) continue;

  const download = join(tmpdir(), `polyfork-${model.id}.glb`);
  try {
    const response = await fetch(`https://polyfork.dev/cdn/${model.id}.glb`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    writeFileSync(download, Buffer.from(await response.arrayBuffer()));
    // Not --quantize: the game re-scales these, and quantized positions can't hold
    // anything outside -1..1 once scaled into plain geometry.
    execFileSync(process.execPath, [importModel, download, target], {
      stdio: 'inherit',
    });
  } catch (error) {
    failed.push(model.name);
    console.warn(`Could not fetch the Polyfork model "${model.name}": ${error.message}`);
  } finally {
    rmSync(download, { force: true });
  }
}

if (failed.length > 0) {
  console.warn(
    `\n${failed.length} Polyfork model(s) missing (${failed.join(', ')}). ` +
      'The game will draw their placeholder shapes.\n',
  );
}
