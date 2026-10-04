import { encodeExpeditionRequest, type ExpeditionRequest } from '@acorn/shared';
import { encodeDecorationRequest, type DecorationRequest } from '@acorn/shared';
import {
  encodeGardenRequest,
  type GardenRequest,
  CLOSE_PLAYING_ELSEWHERE,
  INPUT_SEND_INTERVAL_MS,
  MAX_INPUTS_PER_BUNDLE,
  decodeServerMessage,
  encodeBuild,
  encodeCraft,
  encodeDiscard,
  encodeLoot,
  encodeChestRequest,
  type ChestRequest,
  type LootRequest,
  encodeHello,
  encodeInputBundle,
  encodePing,
  encodeSetDoorLock,
  encodeUseItem,
  type BuildRequest,
  type CharacterId,
  type DiscardRequest,
  type ItemId,
  type PlayerInput,
  type ServerMessage,
  type TintColorId,
} from '@acorn/shared';

/**
 * `elsewhere`: this player has since joined the same world from another tab
 * or window, which carries on with them (see decision 0057). This one waits
 * to be asked to play here again rather than reconnecting by itself.
 */
export type ConnectionState = 'connecting' | 'connected' | 'offline' | 'rejected' | 'elsewhere';

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
  /** Told the player is playing in another tab now: see `standDown`. */
  private standingDown = false;

  /** Round trip time, measured by the client alone. */
  pingMs = 0;
  private lastPingSentAt = 0;

  constructor(url: string, handlers: ConnectionHandlers, options: ConnectionOptions = {}) {
    this.url = url;
    this.handlers = handlers;
    this.options = options;
  }

  connect(): void {
    if (this.closed) return;
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

    // Every handler checks it is still listening to the current socket: a
    // socket that was already given up on must not stop the timers, or start
    // a second reconnect, for the one that replaced it.
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.handlers.onStateChange('connected');
      this.flushTimer = setInterval(() => this.flush(), INPUT_SEND_INTERVAL_MS);
      this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
      this.sendPing();
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket || typeof event.data === 'string') return;
      const message = decodeServerMessage(event.data as ArrayBuffer);
      if (message === null) return;
      if (message.type === 'pong') {
        this.pingMs = Math.max(0, Math.round(performance.now() - this.lastPingSentAt));
        return;
      }
      this.handlers.onMessage(message);
    });

    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return;
      if (event.code === CLOSE_PLAYING_ELSEWHERE) this.standDown();
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
  sendCraft(item: ItemId): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeCraft(item));
  }

  /**
   * Ask to build something exactly where the preview stands - sent the
   * moment the player clicks to place it. The server still checks the spot
   * is in reach and clear on the tick that follows.
   */
  sendDecoration(request: DecorationRequest): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(encodeDecorationRequest(request));
  }

  sendBuild(request: BuildRequest): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeBuild(request));
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
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeSetDoorLock(locked));
  }

  sendUseItem(item: ItemId): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeUseItem(item));
  }

  /**
   * Ask to drop or destroy some of one thing in the pack (see decision
   * 0061). Sent straight away, the same as using an item: rare and
   * deliberate, nothing the input bundle needs to batch up.
   */
  sendLoot(request: LootRequest): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    // Flush preceding movement so reach is judged after the walk that led here.
    this.flush();
    this.socket.send(encodeLoot(request));
  }

  sendChest(request: ChestRequest): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.flush();
    this.socket.send(encodeChestRequest(request));
  }
  sendExpedition(request: ExpeditionRequest): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encodeExpeditionRequest(request));
    return true;
  }
  sendGarden(request: GardenRequest): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.flush();
    this.socket.send(encodeGardenRequest(request));
  }

  sendDiscard(request: DiscardRequest): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeDiscard(request));
  }

  /**
   * Introduce yourself: the name, character and tint picked on the Home
   * screen. Sent once right after a `welcome`, and again on every
   * reconnect - each one is a fresh connection on the server, with nothing
   * remembered about this player until they say so again.
   */
  sendHello(name: string, character: CharacterId, color: TintColorId): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeHello(name, character, color));
  }

  close(): void {
    this.closed = true;
    this.stopTimers();
    this.socket?.close(1000, 'leaving');
    this.socket = null;
  }

  private flush(): void {
    if (this.outgoing.length === 0) return;
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeInputBundle(this.outgoing));
    this.outgoing = [];
  }

  private sendPing(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.lastPingSentAt = performance.now();
    this.socket.send(encodePing(Math.round(this.lastPingSentAt) >>> 0));
  }

  private handleDrop(detail: string): void {
    this.stopTimers();
    this.socket = null;
    this.outgoing = [];
    if (this.closed) return;

    this.handlers.onStateChange('offline', detail);
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  }

  /** Playing somewhere else now: stay quiet until asked to play here again. */
  private standDown(): void {
    this.standingDown = true;
    this.stopTimers();
    this.socket = null;
    this.outgoing = [];
    this.handlers.onStateChange('elsewhere');
  }

  private stopTimers(): void {
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
 */
export function worldSocketUrl(
  worldId: string,
  currentHref = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
): string {
  const base = new URL(currentHref);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `/api/worlds/${worldId}/ws`;
  base.search = '';
  base.hash = '';
  return base.toString();
}
