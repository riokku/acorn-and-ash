/**
 * Where things go on the two maps (see decision 0054), as plain numbers so
 * the arithmetic can be tested without a canvas.
 *
 * The minimap turns with the camera: whatever is ahead of the view is at the
 * top, the same way the stash compass already points (see `compassTo`). The
 * big map never turns: -Z, the way yaw 0 faces, is always up, and that is
 * what the minimap's little "N" points to.
 */

/** A spot on screen, in pixels from wherever the map's own middle is. */
export interface ScreenOffset {
  readonly x: number;
  readonly y: number;
}

/**
 * Where a world offset from the player lands on the minimap, per metre:
 * turned so that `cameraYaw` points straight up. The same turn a canvas
 * makes with `rotate(cameraYaw)`, so drawing the painted map that way and
 * placing markers with this always agree.
 */
export function minimapOffset(dx: number, dz: number, cameraYaw: number): ScreenOffset {
  const cos = Math.cos(cameraYaw);
  const sin = Math.sin(cameraYaw);
  return { x: dx * cos - dz * sin, y: dx * sin + dz * cos };
}

/**
 * How far to turn an arrow that points straight up at 0, clockwise, for
 * something facing `facingYaw` on a map whose top is `mapUpYaw`. The
 * minimap's top is the camera's heading; the big map's is 0.
 */
export function arrowTurn(facingYaw: number, mapUpYaw: number): number {
  return mapUpYaw - facingYaw;
}

/**
 * An offset pulled in to sit on a circle of `radius` if it lies beyond it:
 * how the minimap keeps your home and your stash on its rim, pointing the
 * way to go, once they are too far away to show.
 */
export function clampToRim(
  offset: ScreenOffset,
  radius: number,
): ScreenOffset & { readonly onRim: boolean } {
  const distance = Math.hypot(offset.x, offset.y);
  if (distance <= radius) return { ...offset, onRim: false };
  const scale = radius / distance;
  return { x: offset.x * scale, y: offset.y * scale, onRim: true };
}

/** The big map's view: which world spot is in its middle, and how many pixels a metre takes. */
export interface MapView {
  readonly centreX: number;
  readonly centreZ: number;
  readonly pixelsPerMetre: number;
}

/** Where a world spot lands on the big map, in pixels from its top left corner. */
export function bigMapPoint(
  x: number,
  z: number,
  view: MapView,
  width: number,
  height: number,
): ScreenOffset {
  return {
    x: width / 2 + (x - view.centreX) * view.pixelsPerMetre,
    y: height / 2 + (z - view.centreZ) * view.pixelsPerMetre,
  };
}

/** The world spot under a pixel of the big map - the other way round from `bigMapPoint`. */
export function bigMapWorldAt(
  px: number,
  py: number,
  view: MapView,
  width: number,
  height: number,
): { readonly x: number; readonly z: number } {
  return {
    x: view.centreX + (px - width / 2) / view.pixelsPerMetre,
    z: view.centreZ + (py - height / 2) / view.pixelsPerMetre,
  };
}

/**
 * Zoom the big map by `factor` while keeping whatever is under the cursor
 * right where it is - the way zooming any map feels right - then keep the
 * view on the world, and the zoom between `minPixelsPerMetre` and
 * `maxPixelsPerMetre`.
 */
export function zoomAbout(
  view: MapView,
  factor: number,
  px: number,
  py: number,
  width: number,
  height: number,
  limits: {
    readonly minPixelsPerMetre: number;
    readonly maxPixelsPerMetre: number;
    readonly halfExtent: number;
  },
): MapView {
  const pixelsPerMetre = Math.min(
    limits.maxPixelsPerMetre,
    Math.max(limits.minPixelsPerMetre, view.pixelsPerMetre * factor),
  );
  const under = bigMapWorldAt(px, py, view, width, height);
  const centreX = under.x - (px - width / 2) / pixelsPerMetre;
  const centreZ = under.z - (py - height / 2) / pixelsPerMetre;
  return clampView({ centreX, centreZ, pixelsPerMetre }, limits.halfExtent);
}

/** Keep the middle of the view on the map, so it can never be dragged off into nothing. */
export function clampView(view: MapView, halfExtent: number): MapView {
  const clamp = (value: number): number => Math.min(halfExtent, Math.max(-halfExtent, value));
  return { ...view, centreX: clamp(view.centreX), centreZ: clamp(view.centreZ) };
}
