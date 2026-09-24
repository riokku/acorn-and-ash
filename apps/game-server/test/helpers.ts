import { SELF } from 'cloudflare:test';

import {
  decodeServerMessage,
  encodeBuild,
  encodeCraft,
  encodeInputBundle,
  encodePing,
  createInput,
  type AnimalCaught,
  type BuildableKindId,
  type BuiltPropsMessage,
  type BuriedCachesMessage,
  type CacheEvent,
  type CraftedEvent,
  type FishingEvent,
  type HealthEvent,
  type HungerEvent,
  type InventoryMessage,
  type ItemId,
  type PickupsTakenMessage,
  type ThreatHitMessage,
  type TreeHitMessage,
  type TreeStatesMessage,
  type ServerMessage,
  type SnapshotMessage,
  type WelcomeMessage,
} from '@acorn/shared';

/** A stand-in for one browser tab. */
export class TestClient {
  readonly received: ServerMessage[] = [];
  private readonly socket: WebSocket;
  private sequence = 0;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    // Binary frames arrive as Blobs unless we ask for buffers.
    socket.binaryType = 'arraybuffer';
    // Listen before accepting: the welcome is already waiting on the socket, and
    // accepting starts delivery.
    socket.addEventListener('message', (event: MessageEvent) => {
      if (typeof event.data === 'string') return;
      const decoded = decodeServerMessage(event.data as ArrayBuffer);
      if (decoded !== null) this.received.push(decoded);
    });
    socket.addEventListener('error', (event: Event) => {
      console.error('test client socket error', event);
    });
    socket.accept();
  }

  static async connect(worldId = 'test-world', playerKey?: string): Promise<TestClient> {
    const query = playerKey === undefined ? '' : `?player=${playerKey}`;
    const response = await SELF.fetch(`https://game.test/worlds/${worldId}/ws${query}`, {
      headers: { Upgrade: 'websocket' },
    });
    const socket = response.webSocket;
    if (socket === null) throw new Error(`No WebSocket in the response (${response.status})`);
    return new TestClient(socket);
  }

  /** Send a run of identical inputs, as a real client bundles them. */
  walk(moveX: number, moveZ: number, yaw: number, count: number, buttons = 0): void {
    const inputs = Array.from({ length: count }, () =>
      createInput(++this.sequence, moveX, moveZ, yaw, buttons),
    );
    this.socket.send(encodeInputBundle(inputs));
  }

  ping(clientTimeMs: number): void {
    this.socket.send(encodePing(clientTimeMs));
  }

  craft(item: ItemId): void {
    this.socket.send(encodeCraft(item));
  }

  build(kind: BuildableKindId): void {
    this.socket.send(encodeBuild(kind));
  }

  sendRaw(payload: ArrayBuffer | string): void {
    this.socket.send(payload);
  }

  close(): void {
    this.socket.close(1000, 'test over');
  }

  welcome(): WelcomeMessage {
    const message = this.received.find((entry) => entry.type === 'welcome');
    if (message === undefined) throw new Error('Never received a welcome');
    return message;
  }

  snapshots(): SnapshotMessage[] {
    return this.received.filter((entry) => entry.type === 'snapshot');
  }

  latestSnapshot(): SnapshotMessage {
    const snapshots = this.snapshots();
    const last = snapshots[snapshots.length - 1];
    if (last === undefined) throw new Error('Never received a snapshot');
    return last;
  }

  /** The newest pack the server has sent, or an empty one. */
  inventory(): InventoryMessage['items'] {
    const messages = this.received.filter((entry) => entry.type === 'inventory');
    return messages[messages.length - 1]?.items ?? [];
  }

  /** The newest list of pickups the server says are gone. */
  takenPickups(): PickupsTakenMessage['pickupIds'] {
    const messages = this.received.filter((entry) => entry.type === 'pickupsTaken');
    return messages[messages.length - 1]?.pickupIds ?? [];
  }

  /** The newest word on the trees that are not as the seed left them. */
  treeStates(): TreeStatesMessage['trees'] {
    const messages = this.received.filter((entry) => entry.type === 'treeStates');
    return messages[messages.length - 1]?.trees ?? [];
  }

  /** The first word on the trees, sent the moment you join. */
  openingTreeStates(): TreeStatesMessage['trees'] {
    const message = this.received.find((entry) => entry.type === 'treeStates');
    if (message === undefined) throw new Error('Never received the opening tree states');
    return message.trees;
  }

  /** The ids of the trees the server says are down right now. */
  felledTrees(): number[] {
    return this.treeStates()
      .filter((tree) => tree.felled)
      .map((tree) => tree.treeId);
  }

  /** Everything the server has said about lines in the water, oldest first. */
  fishing(): FishingEvent[] {
    return this.received.flatMap((entry) => (entry.type === 'fishing' ? [entry.event] : []));
  }

  /** Everything the server has said about this client's own hunger, oldest first. */
  hunger(): HungerEvent[] {
    return this.received.flatMap((entry) => (entry.type === 'hunger' ? [entry.event] : []));
  }

  /** The newest word on this client's hunger. */
  latestHunger(): HungerEvent | undefined {
    const events = this.hunger();
    return events[events.length - 1];
  }

  /** Everything the server has said about this client's own health, oldest first. */
  health(): HealthEvent[] {
    return this.received.flatMap((entry) => (entry.type === 'health' ? [entry.event] : []));
  }

  /** The newest word on this client's health. */
  latestHealth(): HealthEvent | undefined {
    const events = this.health();
    return events[events.length - 1];
  }

  /** The first word on this client's health, sent the moment you join. */
  openingHealth(): HealthEvent | undefined {
    return this.health()[0];
  }

  /** Every threat hit the server has told us about. */
  threatHits(): ThreatHitMessage[] {
    return this.received.filter((entry) => entry.type === 'threatHit');
  }

  /** Everything the server has said about what this client crafted, oldest first. */
  crafted(): CraftedEvent[] {
    return this.received.flatMap((entry) => (entry.type === 'crafted' ? [entry.event] : []));
  }

  /** Everything the server has said about what this client caught, oldest first. */
  caught(): AnimalCaught[] {
    return this.received.flatMap((entry) => (entry.type === 'caught' ? [entry.event] : []));
  }

  /** The newest word on everything anybody has built. */
  builtProps(): BuiltPropsMessage['props'] {
    const messages = this.received.filter((entry) => entry.type === 'builtProps');
    return messages[messages.length - 1]?.props ?? [];
  }

  /** The first word on what has been built, sent the moment you join. */
  openingBuiltProps(): BuiltPropsMessage['props'] {
    const message = this.received.find((entry) => entry.type === 'builtProps');
    if (message === undefined) throw new Error('Never received the opening built props');
    return message.props;
  }

  /** The newest word on everything currently buried anywhere in the world. */
  buriedCaches(): BuriedCachesMessage['caches'] {
    const messages = this.received.filter((entry) => entry.type === 'buriedCaches');
    return messages[messages.length - 1]?.caches ?? [];
  }

  /** The first word on what is buried, sent the moment you join. */
  openingBuriedCaches(): BuriedCachesMessage['caches'] {
    const message = this.received.find((entry) => entry.type === 'buriedCaches');
    if (message === undefined) throw new Error('Never received the opening buried caches');
    return message.caches;
  }

  /** Everything the server has said about this client's own buried cache, oldest first. */
  cacheNews(): CacheEvent[] {
    return this.received.flatMap((entry) => (entry.type === 'cache' ? [entry.event] : []));
  }

  /** Every swing the server has told us about. */
  treeHits(): TreeHitMessage[] {
    return this.received.filter((entry) => entry.type === 'treeHit');
  }

  countOfMessages(type: ServerMessage['type']): number {
    return this.received.filter((entry) => entry.type === type).length;
  }

  /** Where this client currently believes another player is. */
  positionOf(netId: number): { x: number; z: number } | undefined {
    const entity = this.latestSnapshot().entities.find((item) => item.netId === netId);
    return entity === undefined ? undefined : { x: entity.x, z: entity.z };
  }
}

/** Wait until a condition holds, or give up. */
export async function waitFor(
  description: string,
  condition: () => boolean,
  timeoutMs = 4000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // A condition that reads a message we have not received yet throws. That
    // just means "not yet", so keep waiting.
    try {
      if (condition()) return;
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for: ${description}`);
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
