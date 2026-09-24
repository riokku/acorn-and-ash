/**
 * How long does a server tick take, and how much memory does a world use?
 *
 * A Durable Object gives us 128 MB and we want a tick under 10 ms, so this walks
 * a crowd of simulated players around the clearing and measures both.
 *
 * It runs under Node rather than inside a Durable Object on purpose: Workers
 * freeze the clock between I/O operations, so a Worker cannot time its own
 * tick. The simulation is the same code either way.
 *
 * Run it with: pnpm bench:tick
 */

import {
  DEFAULT_WORLD_SEED,
  MAX_BUILT_PROPS,
  MAX_BURIED_CACHES,
  MAX_PLAYERS_PER_WORLD,
  SLOW_TICK_BUDGET_MS,
  SNAPSHOT_EVERY_N_TICKS,
  TICK_HZ,
  WorldSimulation,
  createInput,
  encodeSnapshot,
  type SnapshotEntity,
} from '@acorn/shared';

/** Player counts to measure. */
const PLAYER_COUNTS = [1, 10, 25, MAX_PLAYERS_PER_WORLD];
/**
 * Built-prop / buried-cache counts to measure, at a fixed MAX_PLAYERS_PER_WORLD.
 * Campfires have no per-player cap and a cache never expires, so a long-lived
 * world's counts are not bounded by player count the way everything else is -
 * these go well past MAX_BUILT_PROPS/MAX_BURIED_CACHES (255) on purpose, to
 * see how a genuinely old, popular world holds up rather than just a fresh one.
 */
const WORLD_AGE_COUNTS = [0, MAX_BUILT_PROPS, 2000];
/** Thirty seconds of simulation at 20 Hz. */
const MEASURED_TICKS = TICK_HZ * 30;
const WARMUP_TICKS = TICK_HZ * 3;

interface Result {
  readonly players: number;
  readonly builtProps: number;
  readonly meanMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly snapshotBytesPerSecond: number;
  readonly heapMb: number;
}

/** Scatters synthetic entries across the wilderness so distance checks have real work to do. */
function scatteredPosition(index: number): { x: number; z: number } {
  const spacing = 3;
  const perRow = 200;
  return { x: ((index % perRow) - perRow / 2) * spacing, z: Math.floor(index / perRow) * spacing };
}

function measure(playerCount: number, worldAgeCount = 0): Result {
  const simulation = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  for (let i = 1; i <= playerCount; i++) simulation.addPlayer(i);

  if (worldAgeCount > 0) {
    simulation.restoreBuiltProps(
      Array.from({ length: worldAgeCount }, (_, i) => ({
        id: i + 1,
        kind: 'campfire' as const,
        ownerKey: null,
        ...scatteredPosition(i),
      })),
    );
    simulation.restoreBuriedCaches(
      Array.from({ length: worldAgeCount }, (_, i) => ({
        id: i + 1,
        ownerPlayerKey: null,
        items: [],
        ...scatteredPosition(i),
      })),
    );
  }

  const scratch: SnapshotEntity[] = [];
  let sequence = 0;
  let snapshotBytes = 0;

  /**
   * Give everybody a fresh input, each wandering on their own heading so the
   * collision code has real work to do.
   */
  const feedInputs = (): void => {
    sequence += 1;
    for (let i = 1; i <= playerCount; i++) {
      const phase = i * 0.7 + sequence * 0.01;
      simulation.queueInput(
        i,
        createInput(sequence, Math.sin(phase), Math.cos(phase * 0.6), phase),
      );
    }
  };

  /** One tick exactly as the Durable Object runs it, snapshots included. */
  const runTick = (): void => {
    feedInputs();
    simulation.step(Date.now());
    if (simulation.tick % SNAPSHOT_EVERY_N_TICKS === 0) {
      for (let i = 1; i <= playerCount; i++) {
        const entities = simulation.snapshotFor(i, scratch);
        snapshotBytes += encodeSnapshot(
          simulation.tick,
          simulation.tick * 50,
          simulation.lastProcessedSeq(i),
          entities,
        ).byteLength;
      }
    }
  };

  for (let i = 0; i < WARMUP_TICKS; i++) runTick();

  global.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  snapshotBytes = 0;

  const samples = new Float64Array(MEASURED_TICKS);
  for (let i = 0; i < MEASURED_TICKS; i++) {
    const startedAt = process.hrtime.bigint();
    runTick();
    samples[i] = Number(process.hrtime.bigint() - startedAt) / 1e6;
  }

  const heapAfter = process.memoryUsage().heapUsed;
  const sorted = Float64Array.from(samples).sort();
  const seconds = MEASURED_TICKS / TICK_HZ;

  return {
    players: playerCount,
    builtProps: worldAgeCount,
    meanMs: samples.reduce((total, value) => total + value, 0) / samples.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted[sorted.length - 1] ?? 0,
    snapshotBytesPerSecond: snapshotBytes / seconds,
    heapMb: Math.max(heapAfter, heapBefore) / (1024 * 1024),
  };
}

function percentile(sorted: Float64Array, fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] ?? 0;
}

function main(): void {
  console.log(`Acorn & Ash — server tick benchmark`);
  console.log(`Node ${process.version} · ${TICK_HZ} Hz · ${MEASURED_TICKS} ticks per run\n`);

  const results = PLAYER_COUNTS.map((count) => measure(count));
  const ageResults = WORLD_AGE_COUNTS.map((count) => measure(MAX_PLAYERS_PER_WORLD, count));

  const header = [
    'players',
    'mean ms',
    'p50 ms',
    'p95 ms',
    'p99 ms',
    'max ms',
    'snapshot KB/s',
    'heap MB',
  ];
  const toRow = (result: Result): string[] => [
    String(result.players),
    result.meanMs.toFixed(3),
    result.p50Ms.toFixed(3),
    result.p95Ms.toFixed(3),
    result.p99Ms.toFixed(3),
    result.maxMs.toFixed(3),
    (result.snapshotBytesPerSecond / 1024).toFixed(1),
    result.heapMb.toFixed(1),
  ];
  printTable(header, results.map(toRow));

  console.log(
    `\n${MAX_PLAYERS_PER_WORLD} players, with a world's worth of campfires and buried caches built up over time ` +
      `(the wire cap is ${MAX_BUILT_PROPS} built props and ${MAX_BURIED_CACHES} buried caches; ` +
      `a long-lived world can well exceed both):\n`,
  );
  printTable(
    ['built props', 'mean ms', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms', 'snapshot KB/s', 'heap MB'],
    ageResults.map((result) => [String(result.builtProps), ...toRow(result).slice(1)]),
  );

  const worst = [...results, ...ageResults].reduce((a, b) => (b.p99Ms > a.p99Ms ? b : a));

  console.log(
    `\nBudget is ${SLOW_TICK_BUDGET_MS} ms per tick. ` +
      `The worst case (${worst.players} players, ${worst.builtProps} built props) took ${worst.maxMs.toFixed(2)} ms ` +
      `(${((worst.p99Ms / SLOW_TICK_BUDGET_MS) * 100).toFixed(1)}% of budget at the 99th percentile).`,
  );
  console.log(
    `A Durable Object has 128 MB. The worst case used about ${worst.heapMb.toFixed(0)} MB of heap.`,
  );

  if (worst.p99Ms > SLOW_TICK_BUDGET_MS) {
    console.error('\nOver budget.');
    process.exitCode = 1;
  }
}

function printTable(header: readonly string[], rows: readonly (readonly string[])[]): void {
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (cells: readonly string[]): string =>
    cells.map((cell, column) => cell.padStart(widths[column] ?? 0)).join('  ');

  console.log(line(header));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) console.log(line(row));
}

main();
