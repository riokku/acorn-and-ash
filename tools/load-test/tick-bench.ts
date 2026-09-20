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
/** Thirty seconds of simulation at 20 Hz. */
const MEASURED_TICKS = TICK_HZ * 30;
const WARMUP_TICKS = TICK_HZ * 3;

interface Result {
  readonly players: number;
  readonly meanMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly snapshotBytesPerSecond: number;
  readonly heapMb: number;
}

function measure(playerCount: number): Result {
  const simulation = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  for (let i = 1; i <= playerCount; i++) simulation.addPlayer(i);

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

  const results = PLAYER_COUNTS.map(measure);

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
  const rows = results.map((result) => [
    String(result.players),
    result.meanMs.toFixed(3),
    result.p50Ms.toFixed(3),
    result.p95Ms.toFixed(3),
    result.p99Ms.toFixed(3),
    result.maxMs.toFixed(3),
    (result.snapshotBytesPerSecond / 1024).toFixed(1),
    result.heapMb.toFixed(1),
  ]);
  printTable(header, rows);

  const busiest = results[results.length - 1];
  if (busiest === undefined) return;

  console.log(
    `\nBudget is ${SLOW_TICK_BUDGET_MS} ms per tick. ` +
      `With ${busiest.players} players the worst tick took ${busiest.maxMs.toFixed(2)} ms ` +
      `(${((busiest.p99Ms / SLOW_TICK_BUDGET_MS) * 100).toFixed(1)}% of budget at the 99th percentile).`,
  );
  console.log(
    `A Durable Object has 128 MB. This world used about ${busiest.heapMb.toFixed(0)} MB of heap.`,
  );

  if (busiest.p99Ms > SLOW_TICK_BUDGET_MS) {
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
