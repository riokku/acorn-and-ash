import {
  INPUT_SEND_INTERVAL_MS,
  MAX_INPUTS_PER_BUNDLE,
  decodeServerMessage,
  encodeCraft,
  encodeInputBundle,
  encodePing,
  type ItemId,
  type PlayerInput,
  type ServerMessage,
} from '@acorn/shared';

export type ConnectionState = 'connecting' | 'connected' | 'offline' | 'rejected';

export interface ConnectionHandlers {
  onMessage(message: ServerMessage): void;
  onStateChange(state: ConnectionState, detail?: string): void;
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

  private outgoing: PlayerInput[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  /** Round trip time, measured by the client alone. */
  pingMs = 0;
  private lastPingSentAt = 0;

  constructor(url: string, handlers: ConnectionHandlers) {
    this.url = url;
    this.handlers = handlers;
  }

  connect(): void {
    if (this.closed) return;
    this.handlers.onStateChange('connecting');

    const socket = new WebSocket(this.url);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.handlers.onStateChange('connected');
      this.flushTimer = setInterval(() => this.flush(), INPUT_SEND_INTERVAL_MS);
      this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
      this.sendPing();
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') return;
      const message = decodeServerMessage(event.data as ArrayBuffer);
      if (message === null) return;
      if (message.type === 'pong') {
        this.pingMs = Math.max(0, Math.round(performance.now() - this.lastPingSentAt));
        return;
      }
      this.handlers.onMessage(message);
    });

    socket.addEventListener('close', () => this.handleDrop('The connection closed'));
    socket.addEventListener('error', () => this.handleDrop('The connection failed'));
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
 * By default the client talks to the origin it was served from, so a preview
 * build automatically reaches the world its own environment is bound to.
 */
export function worldSocketUrl(
  worldId: string,
  playerKey: string,
  override?: string,
  currentHref = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
): string {
  const base = override && override.length > 0 ? new URL(override) : new URL(currentHref);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `/api/worlds/${worldId}/ws`;
  base.search = '';
  base.hash = '';
  // The world uses this to put a returning player back where they left off.
  base.searchParams.set('player', playerKey);
  return base.toString();
}

/** A key that identifies this browser to the world, so it remembers where you were. */
export function playerKey(storage: Storage): string {
  const existing = storage.getItem('acorn.playerKey');
  if (existing !== null && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;

  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  storage.setItem('acorn.playerKey', key);
  return key;
}
