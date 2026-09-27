import { useEffect, useRef, useState } from 'react';

import { type FogCache, drawMinimap, fitCanvas } from '../map/draw-map';
import type { MapFeed } from '../map/map-feed';

/** The minimap's width on screen, in CSS pixels. */
const MINIMAP_SIZE = 188;
/**
 * How many pixels a metre takes at each zoom, closest last. The middle one
 * shows about sixty metres out each way - a little past the edge of the
 * home clearing from its middle.
 */
const ZOOM_LEVELS = [1.05, 1.5, 2.3] as const;

/**
 * The round minimap in the top right corner (see decision 0054): whatever
 * is ahead of the camera at the top, you in the middle, redrawn every frame
 * straight from the game's own `MapFeed` rather than through the HUD store.
 */
export function Minimap({
  feed,
  fog,
  onOpenMap,
}: {
  readonly feed: MapFeed;
  readonly fog: FogCache;
  readonly onOpenMap: () => void;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    let frame = 0;
    const draw = (): void => {
      frame = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas === null || canvas === undefined || context === null || context === undefined) {
        return;
      }
      const dpr = fitCanvas(canvas, MINIMAP_SIZE, MINIMAP_SIZE);
      drawMinimap(
        context,
        feed,
        fog.canvasFor(feed),
        MINIMAP_SIZE,
        dpr,
        ZOOM_LEVELS[zoomRef.current] ?? ZOOM_LEVELS[1],
      );
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [feed, fog]);

  const zoomBy = (step: number): void =>
    setZoom((current) => Math.min(ZOOM_LEVELS.length - 1, Math.max(0, current + step)));

  return (
    <div
      className="minimap"
      onWheel={(event) => zoomBy(event.deltaY < 0 ? 1 : -1)}
      data-testid="minimap"
    >
      <canvas
        ref={canvasRef}
        className="minimap-canvas"
        style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
        onClick={onOpenMap}
        title="Open the map (M)"
      />
      <div className="minimap-buttons">
        <button type="button" aria-label="Zoom the minimap in" onClick={() => zoomBy(1)}>
          +
        </button>
        <button type="button" aria-label="Zoom the minimap out" onClick={() => zoomBy(-1)}>
          −
        </button>
        <button type="button" className="minimap-key" aria-label="Open the map" onClick={onOpenMap}>
          M
        </button>
      </div>
    </div>
  );
}
