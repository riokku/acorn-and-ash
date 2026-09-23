/**
 * Point a crowd of bots at a running world.
 *
 * Each bot behaves like a browser: it connects, walks in a circle, and posts one
 * input per simulation tick bundled at 15 messages a second. It reports what
 * came back so we can see whether the world kept up.
 *
 * Run it with:
 *   pnpm loadtest                                  (50 bots at localhost:8787)
 *   pnpm loadtest -- --bots 20 --seconds 60
 *   pnpm loadtest -- --url wss://acorn-ash-web-staging.workers.dev
 */

import { parseArgs } from 'node:util';

import {
  INPUT_SEND_INTERVAL_MS,
  MAX_PLAYERS_PER_WORLD,
  SnapshotFlag,
  TICK_MILLISECONDS,
  createInput,
  decodeServerMessage,
  encodeInputBundle,
  type PlayerInput,
} from '@acorn/shared';

const { values } = parseArgs({
  // pnpm passes a bare `--` through to the script; drop it so the flags parse.
  args: process.argv.slice(2).filter((argument) => argument !== '--'),
  allowPositionals: false,
  options: {
    url: { type: 'string', default: 'ws://127.0.0.1:8787' },
    world: { type: 'string', default: 'home-clearing' },
    bots: { type: 'string', default: String(MAX_PLAYERS_PER_WORLD) },
    seconds: { type: 'string', default: '30' },
  },
});

const BOT_COUNT = Number(values.bots);
const DURATION_SECONDS = Number(values.seconds);

interface BotStats {
  connected: boolean;
  snapshots: number;
  bytesReceived: number;
  inputsSent: number;
  playersSeen: number;
  /** Time from connecting to the first snapshot. */
  firstSnapshotMs: number;
  errors: string[];
}

/** One bot, walking in a slow circle so the collision code has work to do. */
function startBot(index: number, stats: BotStats): { stop: () => void } {
  const base = new URL(values.url);
  base.protocol =
    base.protocol === 'https:' ? 'wss:' : base.protocol === 'http:' ? 'ws:' : base.protocol;
  base.pathname = `/api/worlds/${values.world}/ws`;
  base.searchParams.set('player', `loadbot${String(index).padStart(6, '0')}`);

  const socket = new WebSocket(base.toString());
  socket.binaryType = 'arraybuffer';

  const connectedAt = performance.now();
  let sequence = 0;
  let pending: PlayerInput[] = [];
  let tickTimer: ReturnType<typeof setInterval> | undefined;
  let sendTimer: ReturnType<typeof setInterval> | undefined;

  socket.addEventListener('open', () => {
    stats.connected = true;

    // One input per simulation tick, exactly like the browser does.
    tickTimer = setInterval(() => {
      const angle = index * 0.3 + sequence * 0.02;
      pending.push(createInput(++sequence, Math.sin(angle), Math.cos(angle), angle));
    }, TICK_MILLISECONDS);

    // Bundled and posted less often, because incoming messages are billed 20:1.
    sendTimer = setInterval(() => {
      if (pending.length === 0 || socket.readyState !== WebSocket.OPEN) return;
      socket.send(encodeInputBundle(pending));
      stats.inputsSent += pending.length;
      pending = [];
    }, INPUT_SEND_INTERVAL_MS);
  });

  socket.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as ArrayBuffer;
    stats.bytesReceived += data.byteLength;
    const message = decodeServerMessage(data);
    if (message?.type !== 'snapshot') return;
    if (stats.snapshots === 0) stats.firstSnapshotMs = performance.now() - connectedAt;
    stats.snapshots += 1;
    // The wildlife rides along in the same snapshot as everybody else, so this
    // has to be told apart from a player to mean what it says.
    const players = message.entities.filter(
      (entity) => (entity.flags & SnapshotFlag.Animal) === 0,
    ).length;
    stats.playersSeen = Math.max(stats.playersSeen, players);
  });

  socket.addEventListener('error', () => stats.errors.push('socket error'));
  socket.addEventListener('close', (event: Event) => {
    // Node's global WebSocket delivers a CloseEvent here, but @types/node does
    // not declare that name, so read the two fields we need off the event.
    const closed = event as Event & { code?: number; reason?: string };
    if (closed.code !== 1000 && closed.code !== 1005) {
      stats.errors.push(`closed with ${closed.code ?? '?'} ${closed.reason ?? ''}`.trim());
    }
  });

  return {
    stop: () => {
      if (tickTimer !== undefined) clearInterval(tickTimer);
      if (sendTimer !== undefined) clearInterval(sendTimer);
      if (socket.readyState === WebSocket.OPEN) socket.close(1000, 'load test over');
    },
  };
}

async function main(): Promise<void> {
  console.log(`Acorn & Ash — load test`);
  console.log(`${BOT_COUNT} bots against ${values.url} for ${DURATION_SECONDS}s\n`);

  const everyone: BotStats[] = [];
  const running: Array<{ stop: () => void }> = [];

  for (let i = 0; i < BOT_COUNT; i++) {
    const stats: BotStats = {
      connected: false,
      snapshots: 0,
      bytesReceived: 0,
      inputsSent: 0,
      playersSeen: 0,
      firstSnapshotMs: 0,
      errors: [],
    };
    everyone.push(stats);
    running.push(startBot(i, stats));
    // Arrive gradually, the way people actually do.
    await sleep(40);
  }

  await sleep(DURATION_SECONDS * 1000);
  for (const bot of running) bot.stop();
  await sleep(500);

  report(everyone);
}

function report(everyone: readonly BotStats[]): void {
  const connected = everyone.filter((bot) => bot.connected).length;
  const snapshots = sum(everyone.map((bot) => bot.snapshots));
  const bytes = sum(everyone.map((bot) => bot.bytesReceived));
  const inputs = sum(everyone.map((bot) => bot.inputsSent));
  const busiest = Math.max(...everyone.map((bot) => bot.playersSeen), 0);
  const firstSnapshots = everyone
    .filter((bot) => bot.snapshots > 0)
    .map((bot) => bot.firstSnapshotMs);
  const errors = everyone.flatMap((bot) => bot.errors);

  console.log(`Connected          ${connected} of ${everyone.length}`);
  console.log(
    `Snapshots          ${snapshots} (${(snapshots / connected / DURATION_SECONDS).toFixed(1)} per bot per second)`,
  );
  console.log(
    `Received           ${(bytes / 1024 / 1024).toFixed(2)} MB (${(bytes / connected / DURATION_SECONDS / 1024).toFixed(1)} KB/s per bot)`,
  );
  console.log(`Inputs sent        ${inputs}`);
  console.log(`Most players seen  ${busiest}`);
  if (firstSnapshots.length > 0) {
    console.log(
      `First snapshot     ${Math.round(Math.min(...firstSnapshots))}–${Math.round(Math.max(...firstSnapshots))} ms after connecting`,
    );
  }
  console.log(`Errors             ${errors.length === 0 ? 'none' : errors.slice(0, 5).join(', ')}`);

  if (connected < everyone.length || errors.length > 0) process.exitCode = 1;
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

void main();
