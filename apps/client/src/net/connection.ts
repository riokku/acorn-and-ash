import { encodeFireRequest, type FireRequest } from '@acorn/shared';
import { encodeExpeditionRequest, type ExpeditionRequest, type SeasonId } from '@acorn/shared';
import { encodeDecorationRequest, type DecorationRequest } from '@acorn/shared';
import {
  encodeGardenRequest,
  type GardenRequest,
  CLOSE_CHARACTER_DELETED,
  RejectReason,
  CLOSE_PLAYING_ELSEWHERE,
  INPUT_SEND_INTERVAL_MS,
  MAX_INPUTS_PER_BUNDLE,
  decodeServerMessage,
  encodeBuild,
  encodeCraft,
  encodeDiscard,
  encodeGear,
  encodeLoot,
  encodeChestRequest,
  type ChestRequest,
  type LootRequest,
  encodeHello,
  encodeInputBundle,
  encodePing,
  encodeSetDoorLock,
  encodeDigTarget,
  encodePlaceSupport,
  encodeUseItem,
  type BuildRequest,
  type CharacterId,
  type DiscardRequest,
  type GearRequest,
  type ItemId,
  type PlayerInput,
  type ServerMessage,
  type SupportCell,
  type SkinToneId,
  type TintColorId,
} from '@acorn/shared';

/**
 * `elsewhere`: this player has since joined the same world from another tab
 * or window, which carries on with them (see decision 0057). This one waits
 * to be asked to play here again rather than reconnecting by itself.
 *
 * `deleted`: this player's character was deleted, from here or from another
 * tab (decision 0108). There is nobody left to reconnect as, so it stays shut.
 */
export type ConnectionState =
  'connecting' | 'connected' | 'offline' | 'rejected' | 'elsewhere' | 'deleted';

export interface ConnectionHandlers {
  onMessage(message: ServerMessage): void;
  onStateChange(state: ConnectionState, detail?: string): void;
}

export interface ConnectionOptions {
  /**
   * Run before every connection attempt, to make sure the browser has an
   * account for the world to recognise. If it fails the attempt is treated like
   * any other dropped connection: say so, wait, try again.
   */
  readonly signIn?: () => Promise<void>;
}

/** How long to wait before trying again after the connection drops. */
const RECONNECT_DELAY_MS = 2000;
const PING_INTERVAL_MS = 2000;
const WELCOME_TIMEOUT_MS = 30_000;
const SERVER_SILENCE_TIMEOUT_MS = 10_000;

/**
 * The link to the world server.
 *
 * Inputs are collected and posted in bundles rather than one message at a time,
 * because Cloudflare bills incoming WebSocket messages at 20:1.
 */
export class WorldConnection {
  private socket: WebSocket | null = null;
  private readonly url: string;
  private readonly handlers: ConnectionHandlers;
  private readonly options: ConnectionOptions;

  private outgoing: PlayerInput[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private welcomed = false;
  private ready = false;
  private selfNetId: number | null = null;
  private welcomeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Told the player is playing in another tab now: see `standDown`. */
  private standingDown = false;

  /** Round trip time, measured by the client alone. */
  pingMs = 0;
  private lastPingSentAt = 0;
  private lastHeardAt = 0;

  constructor(url: string, handlers: ConnectionHandlers, options: ConnectionOptions = {}) {
    this.url = url;
    this.handlers = handlers;
    this.options = options;
  }

  connect(): void {
    if (this.closed) return;
    this.welcomed = false;
    this.ready = false;
    this.selfNetId = null;
    this.outgoing = [];
    this.handlers.onStateChange('connecting');

    const { signIn } = this.options;
    if (signIn === undefined) {
      this.open();
      return;
    }
    signIn().then(
      () => this.open(),
      (error: unknown) =>
        this.handleDrop(error instanceof Error ? error.message : 'Could not sign in'),
    );
  }

  private open(): void {
    // Closed while signing in: nobody is waiting for this connection any more.
    if (this.closed) return;

    const socket = new WebSocket(this.url);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    this.welcomeTimer = setTimeout(
      () => this.handleDrop('The world did not finish connecting'),
      WELCOME_TIMEOUT_MS,
    );

    // Every handler checks it is still listening to the current socket: a
    // socket that was already given up on must not stop the timers, or start
    // a second reconnect, for the one that replaced it.
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.lastHeardAt = performance.now();
      this.flushTimer = setInterval(() => this.flush(), INPUT_SEND_INTERVAL_MS);
      this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
      this.sendPing();
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket || typeof event.data === 'string') return;
      const message = decodeServerMessage(event.data as ArrayBuffer);
      if (message === null) return;
      this.lastHeardAt = performance.now();
      if (message.type === 'pong') {
        this.pingMs = Math.max(0, Math.round(performance.now() - this.lastPingSentAt));
        return;
      }
      if (message.type === 'rejected') {
        this.handlers.onMessage(message);
        this.standingDown = true;
        this.giveUp(
          'rejected',
          message.reason === RejectReason.WorldFull
            ? 'This world is full. Try again later.'
            : 'The server could not read the request. Reload to reconnect.',
        );
        return;
      }
      if (message.type === 'welcome') {
        this.welcomed = true;
        this.selfNetId = message.netId;
      }
      if (
        message.type === 'snapshot' &&
        this.welcomed &&
        !this.ready &&
        message.entities.some((entity) => entity.netId === this.selfNetId)
      ) {
        this.ready = true;
        if (this.welcomeTimer !== null) clearTimeout(this.welcomeTimer);
        this.welcomeTimer = null;
        // Align the avatar to authoritative state before enabling fresh input.
        this.handlers.onMessage(message);
        this.handlers.onStateChange('connected');
        return;
      }
      this.handlers.onMessage(message);
    });

    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return;
      if (event.code === CLOSE_PLAYING_ELSEWHERE) this.standDown();
      else if (event.code === CLOSE_CHARACTER_DELETED) this.giveUp('deleted');
      else this.handleDrop('The connection closed');
    });
    socket.addEventListener('error', () => {
      if (this.socket !== socket) return;
      this.handleDrop('The connection failed');
    });
  }

  /**
   * Come back to this tab after playing in another one: connecting again
   * takes the player back over from it, the same way it took them from here.
   */
  playHere(): void {
    if (!this.standingDown) return;
    this.standingDown = false;
    this.connect();
  }

  /** Queue one tick of input. It goes out with the next bundle. */
  send(input: PlayerInput): void {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.outgoing.push(input);
    // If the socket stalls, keep the newest inputs rather than the oldest.
    if (this.outgoing.length > MAX_INPUTS_PER_BUNDLE) {
      this.outgoing = this.outgoing.slice(-MAX_INPUTS_PER_BUNDLE);
    }
  }

  /**
   * Ask to make something out of the pack.
   *
   * Sent the moment it is pressed, rather than queued with the next input
   * bundle: crafting is a rare, deliberate action, not part of the steady
   * stream of movement the bundle exists to batch up.
   */
  sendCraft(item: ItemId): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encodeCraft(item));
    return true;
  }

  /**
   * Ask to build something exactly where the preview stands - sent the
   * moment the player clicks to place it. The server still checks the spot
   * is in reach and clear on the tick that follows.
   */
  sendDecoration(request: DecorationRequest): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encodeDecorationRequest(request));
    return true;
  }

  sendBuild(request: BuildRequest): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encodeBuild(request));
    return true;
  }

  /**
   * Ask to use one item from the hotbar right now.
   *
   * Sent the moment its key is pressed, the same as crafting - not bundled
   * with movement, since it is a rare, deliberate action rather than part of
   * the steady stream the input bundle exists to batch up.
   */
  /** Lock or unlock our own front door (see decision 0055). */
  sendSetDoorLock(locked: boolean): void {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeSetDoorLock(locked));
  }

  /** Stand a mine support in this cell of tunnel (decision 0119). */
  sendPlaceSupport(cell: SupportCell): void {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodePlaceSupport(cell));
  }

  /** Which cube of ground the mouse is on while the shovel is out, or none (decision 0114). */
  sendDigTarget(target: { ix: number; iy: number; iz: number } | null): void {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeDigTarget(target));
  }

  sendUseItem(item: ItemId): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encodeUseItem(item));
    return true;
  }

  /**
   * Ask to drop or destroy some of one thing in the pack (see decision
   * 0061). Sent straight away, the same as using an item: rare and
   * deliberate, nothing the input bundle needs to batch up.
   */
  sendLoot(request: LootRequest): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    // Flush preceding movement so reach is judged after the walk that led here.
    this.flush();
    this.socket.send(encodeLoot(request));
    return true;
  }

  sendChest(request: ChestRequest): void {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.flush();
    this.socket.send(encodeChestRequest(request));
  }
  sendExpedition(request: ExpeditionRequest): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encodeExpeditionRequest(request));
    return true;
  }
  sendFire(request: FireRequest): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.flush();
    this.socket.send(encodeFireRequest(request));
    return true;
  }
  sendGarden(request: GardenRequest): void {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.flush();
    this.socket.send(encodeGardenRequest(request));
  }

  sendGear(request: GearRequest): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encodeGear(request));
    return true;
  }

  sendDiscard(request: DiscardRequest): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encodeDiscard(request));
    return true;
  }

  /**
   * Introduce yourself: the name, character and tint picked on the Home
   * screen. Sent once right after a `welcome`, and again on every
   * reconnect - each one is a fresh connection on the server, with nothing
   * remembered about this player until they say so again.
   */
  sendHello(name: string, character: CharacterId, color: TintColorId, skin: SkinToneId): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeHello(name, character, color, skin));
  }

  close(): void {
    this.closed = true;
    this.welcomed = false;
    this.ready = false;
    this.selfNetId = null;
    this.outgoing = [];
    this.stopTimers();
    this.socket?.close(1000, 'leaving');
    this.socket = null;
  }

  private flush(): void {
    if (!this.ready || this.outgoing.length === 0) return;
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeInputBundle(this.outgoing));
    this.outgoing = [];
  }

  private sendPing(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    // Shader compilation or a suspended tab can delay the whole event loop,
    // including incoming messages. Give it time to receive them on resuming.
    if (now - this.lastPingSentAt >= SERVER_SILENCE_TIMEOUT_MS) this.lastHeardAt = now;
    if (this.ready && now - this.lastHeardAt >= SERVER_SILENCE_TIMEOUT_MS) {
      this.handleDrop('The world stopped responding');
      return;
    }
    this.lastPingSentAt = now;
    this.socket.send(encodePing(Math.round(this.lastPingSentAt) >>> 0));
  }

  private handleDrop(detail: string): void {
    this.stopTimers();
    this.welcomed = false;
    this.ready = false;
    this.selfNetId = null;
    const previous = this.socket;
    this.socket = null;
    previous?.close(1000, 'reconnecting');
    this.outgoing = [];
    if (this.closed) return;

    this.handlers.onStateChange('offline', detail);
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  }

  /** Playing somewhere else now: stay quiet until asked to play here again. */
  private standDown(): void {
    this.standingDown = true;
    this.giveUp('elsewhere');
  }

  /** Stop for good, without trying again: the server has said there is nothing to come back to. */
  private giveUp(state: 'elsewhere' | 'deleted' | 'rejected', detail?: string): void {
    this.stopTimers();
    this.welcomed = false;
    this.ready = false;
    this.selfNetId = null;
    const previous = this.socket;
    this.socket = null;
    previous?.close(1000, 'not playing');
    this.outgoing = [];
    if (state === 'deleted') this.closed = true;
    this.handlers.onStateChange(state, detail);
  }

  private stopTimers(): void {
    if (this.welcomeTimer !== null) clearTimeout(this.welcomeTimer);
    this.welcomeTimer = null;
    if (this.flushTimer !== null) clearInterval(this.flushTimer);
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.flushTimer = null;
    this.pingTimer = null;
    this.reconnectTimer = null;
  }
}

/**
 * Work out where the world server is.
 *
 * The client talks to the origin it was served from, so a preview build
 * automatically reaches the world its own environment is bound to. Who is
 * connecting is not in the address: the session cookie says, and the web Worker
 * tells the world (see decision 0086).
 *
 * A season asked for with `?season=` goes along, for looking at winter while
 * testing. Only the first browser into an empty world sets it, and only on
 * your own machine and pull request previews; everywhere else it is left out
 * on the way (decision 0095). `?gear=` goes along the same way, asking for
 * one of every piece of gear to try on (decision 0113).
 */
export function worldSocketUrl(
  worldId: string,
  currentHref = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
  season?: SeasonId,
  gear = false,
): string {
  const base = new URL(currentHref);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `/api/worlds/${worldId}/ws`;
  const asked = new URLSearchParams();
  if (season !== undefined) asked.set('season', season);
  if (gear) asked.set('gear', 'all');
  base.search = asked.toString();
  const weather = new URL(currentHref).searchParams.get('weather');
  if (weather === 'storm' || weather === 'blizzard') base.searchParams.set('weather', weather);
  base.hash = '';
  return base.toString();
}
