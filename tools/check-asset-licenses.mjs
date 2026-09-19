#!/usr/bin/env node
/**
 * Fail the build when an asset has no licence row.
 *
 * Every file under `assets/` (and anything we serve from R2) needs a row in
 * `assets/LICENSES.csv`. The in-game credits page is generated from that file,
 * so a missing row means we would be shipping something uncredited.
 */

import { readFileSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const assetsDir = join(repoRoot, 'assets');
const licensesPath = join(assetsDir, 'LICENSES.csv');

const EXPECTED_COLUMNS = [
  'file',
  'source_url',
  'author',
  'license',
  'date_added',
  'modifications',
  'ai_tool',
  'ai_plan',
];
const REQUIRED_VALUES = ['file', 'source_url', 'author', 'license', 'date_added'];

/** Notes and the licence file itself are not assets. */
const IGNORED_FILES = new Set(['LICENSES.csv', 'README.md', '.gitkeep']);

const ALLOWED_AI_TOOLS = new Set(['', 'Meshy', 'Tripo']);
const BANNED_AI_TOOLS = new Set(['Hunyuan3D', 'hunyuan3d', 'Hunyuan']);

const problems = [];

if (!existsSync(licensesPath)) {
  fail(`assets/LICENSES.csv is missing.`);
  report();
}

const rows = parseCsv(readFileSync(licensesPath, 'utf8'));
const header = rows.shift();

if (!header || header.join(',') !== EXPECTED_COLUMNS.join(',')) {
  fail(
    `assets/LICENSES.csv must start with the header:\n  ${EXPECTED_COLUMNS.join(',')}\n` +
      `but it starts with:\n  ${header ? header.join(',') : '(nothing)'}`,
  );
}

const licensed = new Map();
rows.forEach((row, index) => {
  const lineNumber = index + 2;
  if (row.length !== EXPECTED_COLUMNS.length) {
    fail(`Line ${lineNumber} has ${row.length} columns, expected ${EXPECTED_COLUMNS.length}.`);
    return;
  }
  const record = Object.fromEntries(EXPECTED_COLUMNS.map((name, i) => [name, row[i].trim()]));

  for (const name of REQUIRED_VALUES) {
    if (record[name] === '') fail(`Line ${lineNumber}: "${name}" cannot be empty.`);
  }

  if (BANNED_AI_TOOLS.has(record.ai_tool)) {
    fail(`Line ${lineNumber}: ${record.ai_tool} is not an allowed source.`);
  } else if (!ALLOWED_AI_TOOLS.has(record.ai_tool)) {
    fail(
      `Line ${lineNumber}: unknown ai_tool "${record.ai_tool}". ` +
        `Use one of: ${[...ALLOWED_AI_TOOLS].filter(Boolean).join(', ')}, or leave it empty.`,
    );
  }

  if (record.ai_tool === 'Tripo' && record.ai_plan !== 'paid') {
    fail(`Line ${lineNumber}: Tripo may only be used on a paid plan.`);
  }
  if (record.ai_tool === 'Meshy' && record.ai_plan === 'free' && record.license !== 'CC BY 4.0') {
    fail(`Line ${lineNumber}: Meshy on the free plan must be credited as CC BY 4.0.`);
  }

  const normalised = record.file.split('/').join(sep);
  if (!existsSync(join(repoRoot, normalised))) {
    fail(`Line ${lineNumber}: "${record.file}" is listed but does not exist.`);
  }
  if (licensed.has(record.file)) {
    fail(`Line ${lineNumber}: "${record.file}" is listed twice.`);
  }
  licensed.set(record.file, record);
});

for (const file of await listFiles(assetsDir)) {
  const relativePath = relative(repoRoot, file).split(sep).join('/');
  const name = relativePath.slice(relativePath.lastIndexOf('/') + 1);
  if (IGNORED_FILES.has(name)) continue;
  if (!licensed.has(relativePath)) {
    fail(`"${relativePath}" has no row in assets/LICENSES.csv.`);
  }
}

report();

function fail(message) {
  problems.push(message);
}

function report() {
  if (problems.length > 0) {
    console.error('Asset licence check failed:\n');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`\n${problems.length} problem(s). See assets/README.md.`);
    process.exit(1);
  }
  console.log(`Asset licence check passed: ${licensed.size} asset(s) accounted for.`);
}

async function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(full)));
    else files.push(full);
  }
  return files;
}

/** A small CSV reader that understands quoted fields containing commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}
