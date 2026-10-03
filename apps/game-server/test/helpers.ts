import { SELF } from 'cloudflare:test';

import {
  BUILDABLE_KINDS,
  decodeServerMessage,
  encodeBuild,
  encodeChestRequest,
  encodeGardenRequest,
  type GardenRequest,
  type ChestRequest,
  encodeCraft,
  encodeDiscard,
  encodeHello,
  encodeInputBundle,
  encodePing,
  encodeSetDoorLock,
  encodeUseItem,
  encodeLoot,
  type LootRequest,
  createInput,
  type AnimalCaught,
  type BuildableKindId,
  type BuildRequest,
  type BuiltPropsMessage,
  type BuriedCachesMessage,
  type CacheEvent,
  type CharacterId,
  type CraftedEvent,
  type DiscardedEvent,
  type DroppedPilesMessage,
  type GatherPatchesMessage,
  type EquippedMessage,
  type ExploredMessage,
  type SpaceMessage,
  type FishingEvent,
  type GestureEvent,
  type HealthEvent,
  type HungerEvent,
  type InventoryMessage,
  type ItemId,
  type PickupsTakenMessage,
  type RosterMessage,
  type ThreatHitMessage,
  type TintColorId,
  type TreeHitMessage,
  type TreeStatesMessage,
  type ServerMessage,
  type SnapshotMessage,
  type WelcomeMessage,
} from '@acorn/shared';

/** A stand-in for one browser tab. */
/** How far ahead of the player `buildInFront` puts a piece's edge: within reach, past pickup reach. */
const BUILD_IN_FRONT = 2;

export class TestClient {
  readonly received: ServerMessage[] = [];
  /** How the server hung up on this client, once it has. */
  closedWith: number | null = null;
  private readonly socket: WebSocket;
  private sequence = 0;

  private constructor(
    socket: WebSocket,
    readonly worldId: string,
    readonly playerKey?: string,
  ) {
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
    socket.addEventListener('close', (event: CloseEvent) => {
      this.closedWith = event.code;
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
    return new TestClient(socket, worldId, playerKey);
  }

  loot(request: LootRequest): void {
    this.socket.send(encodeLoot(request));
  }

  garden(request: GardenRequest): void {
    this.socket.send(encodeGardenRequest(request));
  }

  chest(request: ChestRequest): void {
    this.socket.send(encodeChestRequest(request));
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

  /**
   * Ask to build a couple of steps ahead of wherever this player last showed
   * up in a snapshot, looking along `yaw` - where every build used to land
   * before pieces followed the mouse (see decision 0052).
   */
  buildInFront(kind: BuildableKindId, yaw: number): void {
    const here = this.positionOf(this.welcome().netId) ?? { x: 0, z: 0 };
    // The piece's own edge that far ahead, so even a cabin clears its builder.
    const ahead = BUILDABLE_KINDS[kind].footprintRadius + BUILD_IN_FRONT;
    this.socket.send(
      encodeBuild({
        kind,
        x: here.x - Math.sin(yaw) * ahead,
        z: here.z - Math.cos(yaw) * ahead,
        yaw: 0,
      }),
    );
  }

  build(request: BuildRequest): void {
    this.socket.send(encodeBuild(request));
  }

  useItem(item: ItemId): void {
    this.socket.send(encodeUseItem(item));
  }

  /**
   * Wait until the server has simulated every input sent so far - so a
   * button still held from a moment ago cannot act on whatever happens next.
   */
  async caughtUp(): Promise<void> {
    const sent = this.sequence;
    await waitFor('every input simulated', () => this.latestSnapshot().ackSeq >= sent);
  }

  /** Wait for queued walking and the player's braking to finish before comparing positions. */
  async stoppedMoving(): Promise<void> {
    await this.caughtUp();
    const netId = this.welcome().netId;
    await waitFor('the player to stop moving', () => {
      const entity = this.latestSnapshot().entities.find((item) => item.netId === netId);
      return entity !== undefined && entity.vx === 0 && entity.vz === 0;
    });
  }

  /** Drop some of something on the ground, or destroy it outright. */
  discard(item: ItemId, amount: number, destroy = false): void {
    this.socket.send(encodeDiscard({ item, amount, destroy }));
  }

  hello(name: string, character: CharacterId = 'knight', color: TintColorId = 'amber'): void {
    this.socket.send(encodeHello(name, character, color));
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

  /** The newest word on who is who. */
  roster(): RosterMessage['players'] {
    const messages = this.received.filter((entry) => entry.type === 'roster');
    return messages[messages.length - 1]?.players ?? [];
  }

  /** The first word on who is who, sent the moment you join. */
  openingRoster(): RosterMessage['players'] {
    const message = this.received.find((entry) => entry.type === 'roster');
    if (message === undefined) throw new Error('Never received the opening roster');
    return message.players;
  }

  /** The newest word on what everybody currently has equipped. */
  equipped(): EquippedMessage['players'] {
    const messages = this.received.filter((entry) => entry.type === 'equipped');
    return messages[messages.length - 1]?.players ?? [];
  }

  /** The first word on what everybody has equipped, sent the moment you join. */
  openingEquipped(): EquippedMessage['players'] {
    const message = this.received.find((entry) => entry.type === 'equipped');
    if (message === undefined) throw new Error('Never received the opening equipped list');
    return message.players;
  }

  /** Lock or unlock this player's own front door. */
  setDoorLock(locked: boolean): void {
    this.socket.send(encodeSetDoorLock(locked));
  }

  /** The newest word on which space this player is in: outdoors, or inside a home. */
  latestSpace(): SpaceMessage | undefined {
    const messages = this.received.filter((entry): entry is SpaceMessage => entry.type === 'space');
    return messages[messages.length - 1];
  }

  /** The newest word on which parts of the world this player has seen. */
  explored(): ExploredMessage['cells'] | undefined {
    const messages = this.received.filter((entry) => entry.type === 'explored');
    return messages[messages.length - 1]?.cells;
  }

  /** The map as it stood the moment this player joined. */
  openingExplored(): ExploredMessage['cells'] {
    const message = this.received.find((entry) => entry.type === 'explored');
    if (message === undefined) throw new Error('Never received the opening explored map');
    return message.cells;
  }

  /** The newest word on every stick and flower patch: where, and how many are left. */
  gatherPatches(): GatherPatchesMessage['patches'] {
    const messages = this.received.filter((entry) => entry.type === 'gatherPatches');
    return messages[messages.length - 1]?.patches ?? [];
  }

  /** The newest word on everything lying where somebody dropped it. */
  droppedPiles(): DroppedPilesMessage['piles'] {
    const messages = this.received.filter((entry) => entry.type === 'droppedPiles');
    return messages[messages.length - 1]?.piles ?? [];
  }

  /** Everything the server has said this client dropped or destroyed, oldest first. */
  discarded(): DiscardedEvent[] {
    return this.received.flatMap((entry) => (entry.type === 'discarded' ? [entry.event] : []));
  }

  /** Everything anybody was seen doing with their hands, oldest first (see decision 0056). */
  gestures(): GestureEvent[] {
    return this.received.flatMap((entry) => (entry.type === 'gestures' ? entry.gestures : []));
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
