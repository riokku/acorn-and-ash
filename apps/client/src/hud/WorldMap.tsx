import { useEffect, useRef, useState } from 'react';

import { exploredFraction } from '@acorn/shared';

import { type FogCache, drawBigMap, fitCanvas } from '../map/draw-map';
import { clampView, zoomAbout, type MapView } from '../map/map-math';
import type { MapFeed } from '../map/map-feed';
import { MAP_HALF_EXTENT } from '../map/paint-map';

/** How far in, relative to the whole world just fitting, the map opens. */
const OPENING_ZOOM = 2.2;
/** How far in it can go, relative to the whole world just fitting. */
const MOST_ZOOM = 6;

/**
 * The big map (see decision 0054): a field-journal page with the whole world
 * on it, north up, filling in as you explore. Drag to move about, the wheel
 * or the buttons to zoom, M or Escape to put it away.
 */
export function WorldMap({
  feed,
  fog,
  onClose,
}: {
  readonly feed: MapFeed;
  readonly fog: FogCache;
  readonly onClose: () => void;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [explored, setExplored] = useState(() => exploredFraction(feed.explored));

  /** How many pixels a metre takes with the whole world just fitting the page. */
  const fitScale = (): number => {
    const holder = holderRef.current;
    const side = holder === null ? 600 : Math.min(holder.clientWidth, holder.clientHeight);
    return side / (MAP_HALF_EXTENT * 2);
  };
  const limits = (): {
    minPixelsPerMetre: number;
    maxPixelsPerMetre: number;
    halfExtent: number;
  } => ({
    minPixelsPerMetre: fitScale(),
    maxPixelsPerMetre: fitScale() * MOST_ZOOM,
    halfExtent: MAP_HALF_EXTENT,
  });
  const centreOnYou = (): void => {
    viewRef.current = clampView(
      {
        centreX: feed.player.x,
        centreZ: feed.player.z,
        pixelsPerMetre: fitScale() * OPENING_ZOOM,
      },
      MAP_HALF_EXTENT,
    );
  };

  useEffect(() => {
    let frame = 0;
    let lastVersion = -1;
    const draw = (): void => {
      frame = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const holder = holderRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !holder || !context) return;
      if (viewRef.current === null) centreOnYou();
      const view = viewRef.current;
      if (view === null) return;
      const width = holder.clientWidth;
      const height = holder.clientHeight;
      const dpr = fitCanvas(canvas, width, height);
      drawBigMap(context, feed, fog.canvasFor(feed), view, width, height, dpr, {
        home: 'Home',
        stash: 'Your stash',
      });
      if (feed.exploredVersion !== lastVersion) {
        lastVersion = feed.exploredVersion;
        setExplored(exploredFraction(feed.explored));
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // Only the feed and fog cache it draws from: the view lives in a ref,
    // changed by dragging and zooming without redrawing React at all.
  }, [feed, fog]);

  const zoomAt = (factor: number, px: number, py: number): void => {
    const holder = holderRef.current;
    const view = viewRef.current;
    if (holder === null || view === null) return;
    viewRef.current = zoomAbout(
      view,
      factor,
      px,
      py,
      holder.clientWidth,
      holder.clientHeight,
      limits(),
    );
  };
  const zoomMiddle = (factor: number): void => {
    const holder = holderRef.current;
    if (holder === null) return;
    zoomAt(factor, holder.clientWidth / 2, holder.clientHeight / 2);
  };

  return (
    <div className="world-map-backdrop" role="dialog" aria-label="Map" data-testid="world-map">
      <div className="world-map-page">
        <header className="world-map-header">
          <h2>Map of the woods</h2>
          <p>{Math.round(explored * 100)}% explored</p>
          <button
            type="button"
            className="world-map-close"
            onClick={onClose}
            aria-label="Close the map"
          >
            ×
          </button>
        </header>
        <div
          ref={holderRef}
          className="world-map-canvas-holder"
          onPointerDown={(event) => {
            dragRef.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            const view = viewRef.current;
            if (drag === null || view === null) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            dragRef.current = { x: event.clientX, y: event.clientY };
            viewRef.current = clampView(
              {
                ...view,
                centreX: view.centreX - dx / view.pixelsPerMetre,
                centreZ: view.centreZ - dy / view.pixelsPerMetre,
              },
              MAP_HALF_EXTENT,
            );
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onWheel={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            zoomAt(
              event.deltaY < 0 ? 1.25 : 0.8,
              event.clientX - bounds.left,
              event.clientY - bounds.top,
            );
          }}
        >
          <canvas ref={canvasRef} className="world-map-canvas" />
          <div className="world-map-frame" />
        </div>
        <footer className="world-map-footer">
          <ul className="world-map-legend">
            <li>
              <span className="legend-you" /> You
            </li>
            <li>
              <span className="legend-home" /> Home
            </li>
            <li>
              <span className="legend-stash">✕</span> Your stash
            </li>
            <li>
              <span className="legend-player" /> Other players
            </li>
            <li>
              <span className="legend-unexplored" /> Not explored yet
            </li>
          </ul>
          <div className="world-map-tools">
            <button type="button" onClick={() => zoomMiddle(1.25)} aria-label="Zoom in">
              +
            </button>
            <button type="button" onClick={() => zoomMiddle(0.8)} aria-label="Zoom out">
              −
            </button>
            <button type="button" onClick={centreOnYou}>
              Centre on me
            </button>
          </div>
          <p className="world-map-hint">Drag to look around · M or Esc to close</p>
        </footer>
      </div>
    </div>
  );
}
