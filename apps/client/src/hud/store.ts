import type { ItemId } from '@acorn/shared';

import type { RenderBackend } from '../scene/renderer';
import type { ConnectionState } from '../net/connection';

/** Everything the HUD shows. */
export interface HudState {
  readonly connection: ConnectionState;
  readonly connectionDetail: string;
  readonly backend: RenderBackend;
  readonly forcedFallback: boolean;
  readonly fps: number;
  readonly pingMs: number;
  readonly playersOnline: number;
  readonly serverTick: number;
  readonly position: { x: number; y: number; z: number };
  readonly correctionCm: number;
  readonly pointerLocked: boolean;
  readonly ready: boolean;
  /** What the server says this player is carrying. */
  readonly carrying: readonly { readonly item: ItemId; readonly count: number }[];
  /** What is within reach right now, if anything. */
  readonly nearbyItem: ItemId | null;
}

const INITIAL: HudState = {
  connection: 'connecting',
  connectionDetail: '',
  backend: 'unknown',
  forcedFallback: false,
  fps: 0,
  pingMs: 0,
  playersOnline: 0,
  serverTick: 0,
  position: { x: 0, y: 0, z: 0 },
  correctionCm: 0,
  pointerLocked: false,
  ready: false,
  carrying: [],
  nearbyItem: null,
};

/**
 * A tiny store the game writes to and React reads from.
 *
 * The game loop runs every frame; React only needs to hear about it a few times
 * a second, so `publish` is called on a timer rather than per frame.
 */
export class HudStore {
  private state: HudState = INITIAL;
  private readonly listeners = new Set<() => void>();

  getSnapshot = (): HudState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  publish(changes: Partial<HudState>): void {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener();
  }
}
