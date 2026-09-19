import { useSyncExternalStore } from 'react';

import type { HudStore, HudState } from './store';

interface HudProps {
  readonly store: HudStore;
  readonly onPlay: () => void;
}

export function Hud({ store, onPlay }: HudProps): React.JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return (
    <>
      <div className="hud-panel">
        <p className="hud-title">Acorn &amp; Ash</p>
        <Row label="Server" value={<Connection state={state} />} />
        <Row label="Players" value={state.playersOnline} />
        <Row label="Ping" value={`${state.pingMs} ms`} />
        <Row label="Tick" value={state.serverTick} />
        <Row label="Renderer" value={renderer(state)} />
        <Row label="FPS" value={state.fps} />
        <Row
          label="Position"
          value={`${state.position.x.toFixed(1)}, ${state.position.z.toFixed(1)}`}
        />
        <Row label="Correction" value={`${state.correctionCm.toFixed(0)} cm`} />
      </div>

      {state.ready && !state.pointerLocked ? (
        <div className="hud-curtain" onClick={onPlay} role="presentation">
          <h1>Acorn &amp; Ash</h1>
          <p>Click to play</p>
          <p>WASD to walk · Shift to sprint · Space to jump · mouse to look · Esc to let go</p>
        </div>
      ) : null}

      {state.ready && state.pointerLocked ? (
        <p className="hud-hint">
          WASD to walk · Shift to sprint · Space to jump · mouse to look · Esc to let go
        </p>
      ) : null}

      {!state.ready ? (
        <div className="hud-curtain">
          <h1>Acorn &amp; Ash</h1>
          <p>{loadingMessage(state)}</p>
        </div>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="hud-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Connection({ state }: { state: HudState }): React.JSX.Element {
  const labels: Record<HudState['connection'], [string, string]> = {
    connecting: ['Connecting', 'hud-status-warn'],
    connected: ['Connected', 'hud-status-good'],
    offline: ['Offline', 'hud-status-bad'],
    rejected: ['World full', 'hud-status-bad'],
  };
  const entry = labels[state.connection];
  return <span className={entry[1]}>{entry[0]}</span>;
}

function renderer(state: HudState): string {
  if (state.backend === 'unknown') return 'starting…';
  return state.forcedFallback ? `${state.backend} (forced)` : state.backend;
}

function loadingMessage(state: HudState): string {
  if (state.connection === 'offline') return 'Cannot reach the world server. Retrying…';
  if (state.connection === 'rejected') return 'This world is full. Try again in a moment.';
  return 'Waking the forest…';
}
