/**
 * Drawing the minimap and the big map onto their canvases (see decision
 * 0054): the painted world, the parchment over what is still unexplored,
 * and small inked symbols for you, your home, your stash, other players and
 * what you have built.
 */

import { FOG_RESOLUTION, fogCover } from './fog';
import { arrowTurn, bigMapPoint, clampToRim, minimapOffset, type MapView } from './map-math';
import type { MapBuild, MapFeed } from './map-feed';
import { MAP_HALF_EXTENT, PARCHMENT } from './paint-map';

const INK = '#5b4631';
const CREAM = '#f7efdc';
const PAGE = `#${PARCHMENT.toString(16).padStart(6, '0')}`;
const YOU = '#c0492f';
const HOME_ROOF = '#a4553a';
const STASH = '#a33a28';
/** Skeleton raiders: a dark red, and a hot one while swinging (see decision 0063). */
const RAIDER = '#7e1d14';
const RAIDER_ATTACKING = '#ff3b2f';
const LABEL_FONT = 'italic 600 13px Fraunces, Georgia, serif';

/**
 * The parchment over unexplored ground, worked out again only when the
 * explored map has actually grown - both maps share it.
 */
export class FogCache {
  private canvas: HTMLCanvasElement | null = null;
  private version = -1;

  canvasFor(feed: MapFeed): HTMLCanvasElement {
    if (this.canvas !== null && this.version === feed.exploredVersion) return this.canvas;
    const canvas = this.canvas ?? document.createElement('canvas');
    canvas.width = FOG_RESOLUTION;
    canvas.height = FOG_RESOLUTION;
    const context = canvas.getContext('2d');
    if (context !== null) {
      const cover = fogCover(feed.explored, FOG_RESOLUTION);
      const pixels = context.createImageData(FOG_RESOLUTION, FOG_RESOLUTION);
      const r = (PARCHMENT >> 16) & 0xff;
      const g = (PARCHMENT >> 8) & 0xff;
      const b = PARCHMENT & 0xff;
      for (let i = 0; i < cover.length; i++) {
        pixels.data[i * 4] = r;
        pixels.data[i * 4 + 1] = g;
        pixels.data[i * 4 + 2] = b;
        pixels.data[i * 4 + 3] = cover[i] ?? 255;
      }
      context.putImageData(pixels, 0, 0);
    }
    this.canvas = canvas;
    this.version = feed.exploredVersion;
    return canvas;
  }
}

/** Size a canvas's backing store to its CSS size on this screen, only when that has changed. */
export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const wantWidth = Math.round(width * dpr);
  const wantHeight = Math.round(height * dpr);
  if (canvas.width !== wantWidth) canvas.width = wantWidth;
  if (canvas.height !== wantHeight) canvas.height = wantHeight;
  return dpr;
}

/** Room left round the minimap's edge for its inked rim. */
const MINIMAP_RIM = 7;

/** Draw the round minimap: the world turned so the camera's heading is up, with you in the middle. */
export function drawMinimap(
  context: CanvasRenderingContext2D,
  feed: MapFeed,
  fog: HTMLCanvasElement,
  size: number,
  dpr: number,
  pixelsPerMetre: number,
): void {
  const centre = size / 2;
  const radius = centre - MINIMAP_RIM;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, size, size);

  context.save();
  context.beginPath();
  context.arc(centre, centre, radius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = PAGE;
  context.fillRect(0, 0, size, size);

  if (feed.image !== null) {
    context.save();
    context.translate(centre, centre);
    context.rotate(feed.cameraYaw);
    context.scale(pixelsPerMetre, pixelsPerMetre);
    context.translate(-feed.player.x, -feed.player.z);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const extent = MAP_HALF_EXTENT * 2;
    context.drawImage(feed.image, -MAP_HALF_EXTENT, -MAP_HALF_EXTENT, extent, extent);
    context.drawImage(fog, -MAP_HALF_EXTENT, -MAP_HALF_EXTENT, extent, extent);
    context.restore();
  }
  if (feed.isNight) {
    context.fillStyle = 'rgba(28, 36, 72, 0.14)';
    context.fillRect(0, 0, size, size);
  }

  const place = (x: number, z: number): { x: number; y: number } => {
    const offset = minimapOffset(x - feed.player.x, z - feed.player.z, feed.cameraYaw);
    return { x: offset.x * pixelsPerMetre, y: offset.y * pixelsPerMetre };
  };

  for (const build of feed.builds) {
    const at = place(build.x, build.z);
    if (Math.hypot(at.x, at.y) > radius) continue;
    drawBuild(context, centre + at.x, centre + at.y, build, pixelsPerMetre, feed.cameraYaw);
  }
  for (const other of feed.others) {
    const at = place(other.x, other.z);
    if (Math.hypot(at.x, at.y) > radius - 3) continue;
    drawPlayerDot(context, centre + at.x, centre + at.y, other.color);
  }
  for (const raider of feed.raiders) {
    const at = place(raider.x, raider.z);
    if (Math.hypot(at.x, at.y) > radius - 3) continue;
    drawRaider(context, centre + at.x, centre + at.y, raider.attacking, 1);
  }
  // Home and stash stay on the rim once they are too far to show, pointing
  // the way back.
  for (const stash of feed.stashes) {
    const at = clampToRim(place(stash.x, stash.z), radius - 8);
    drawStash(context, centre + at.x, centre + at.y, at.onRim ? 0.75 : 1);
  }
  for (const discovery of feed.discoveries) {
    const at = place(discovery.x, discovery.z);
    if (Math.hypot(at.x, at.y) <= radius - 7) drawDiscovery(context, centre + at.x, centre + at.y);
  }
  if (feed.home !== null) {
    const at = clampToRim(place(feed.home.x, feed.home.z), radius - 9);
    drawHome(context, centre + at.x, centre + at.y, at.onRim ? 0.8 : 1);
  }
  drawYou(context, centre, centre, arrowTurn(feed.player.facingYaw, feed.cameraYaw), 1);
  context.restore();

  drawRim(context, centre, radius, feed.cameraYaw);
}

/** A double inked ring, and a little N on it that swings round to wherever north is. */
function drawRim(
  context: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  cameraYaw: number,
): void {
  context.lineWidth = 3;
  context.strokeStyle = CREAM;
  context.beginPath();
  context.arc(centre, centre, radius + 1.5, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 1.4;
  context.strokeStyle = INK;
  context.beginPath();
  context.arc(centre, centre, radius + 0.5, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 0.8;
  context.beginPath();
  context.arc(centre, centre, radius + 4, 0, Math.PI * 2);
  context.stroke();

  const north = minimapOffset(0, -1, cameraYaw);
  const nx = centre + north.x * (radius + 1);
  const ny = centre + north.y * (radius + 1);
  context.fillStyle = CREAM;
  context.strokeStyle = INK;
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(nx, ny, 7, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = INK;
  context.font = '700 9px Fraunces, Georgia, serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('N', nx, ny + 0.5);
}

/** Draw the big map: the whole world, north up, panned and zoomed however the player left it. */
export function drawBigMap(
  context: CanvasRenderingContext2D,
  feed: MapFeed,
  fog: HTMLCanvasElement,
  view: MapView,
  width: number,
  height: number,
  dpr: number,
  names: { readonly home: string; readonly stash: string },
): void {
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = PAGE;
  context.fillRect(0, 0, width, height);

  if (feed.image !== null) {
    context.save();
    context.translate(width / 2, height / 2);
    context.scale(view.pixelsPerMetre, view.pixelsPerMetre);
    context.translate(-view.centreX, -view.centreZ);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const extent = MAP_HALF_EXTENT * 2;
    context.drawImage(feed.image, -MAP_HALF_EXTENT, -MAP_HALF_EXTENT, extent, extent);
    context.drawImage(fog, -MAP_HALF_EXTENT, -MAP_HALF_EXTENT, extent, extent);
    context.restore();
  }

  const place = (x: number, z: number): { x: number; y: number } =>
    bigMapPoint(x, z, view, width, height);

  for (const build of feed.builds) {
    const at = place(build.x, build.z);
    drawBuild(context, at.x, at.y, build, view.pixelsPerMetre, 0);
  }
  for (const other of feed.others) {
    const at = place(other.x, other.z);
    drawPlayerDot(context, at.x, at.y, other.color);
    drawLabel(context, other.name, at.x, at.y + 15);
  }
  for (const raider of feed.raiders) {
    const at = place(raider.x, raider.z);
    drawRaider(context, at.x, at.y, raider.attacking, 1.2);
  }
  for (const stash of feed.stashes) {
    const at = place(stash.x, stash.z);
    drawStash(context, at.x, at.y, 1.3);
    drawLabel(context, names.stash, at.x, at.y + 18);
  }
  if (feed.home !== null) {
    const at = place(feed.home.x, feed.home.z);
    drawHome(context, at.x, at.y, 1.3);
    drawLabel(context, names.home, at.x, at.y + 19);
  }
  for (const discovery of feed.discoveries) {
    const at = place(discovery.x, discovery.z);
    drawDiscovery(context, at.x, at.y);
    drawLabel(context, discovery.name, at.x, at.y + 17);
  }
  const you = place(feed.player.x, feed.player.z);
  drawYou(context, you.x, you.y, arrowTurn(feed.player.facingYaw, 0), 1.25);
}

function drawLabel(context: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  context.font = LABEL_FONT;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = 3.5;
  context.strokeStyle = 'rgba(247, 239, 220, 0.9)';
  context.strokeText(text, x, y);
  context.fillStyle = INK;
  context.fillText(text, x, y);
}

/** You: an arrowhead pointing the way you face. */
function drawYou(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  turn: number,
  scale: number,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(turn);
  context.scale(scale, scale);
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(6, 6);
  context.lineTo(0, 2.5);
  context.lineTo(-6, 6);
  context.closePath();
  context.lineJoin = 'round';
  context.lineWidth = 3.5;
  context.strokeStyle = CREAM;
  context.stroke();
  context.fillStyle = YOU;
  context.fill();
  context.lineWidth = 1.1;
  context.strokeStyle = INK;
  context.stroke();
  context.restore();
}

/** Your home: a little house, cream walls and a red roof. */
function drawHome(context: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.lineJoin = 'round';
  // A cream halo so it reads on any ground.
  context.beginPath();
  context.arc(0, 0, 9.5, 0, Math.PI * 2);
  context.fillStyle = 'rgba(247, 239, 220, 0.85)';
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = INK;
  context.stroke();
  // Walls.
  context.beginPath();
  context.rect(-4.5, -1, 9, 6);
  context.fillStyle = CREAM;
  context.fill();
  context.lineWidth = 1.2;
  context.stroke();
  // Roof.
  context.beginPath();
  context.moveTo(-6.5, -0.5);
  context.lineTo(0, -6.5);
  context.lineTo(6.5, -0.5);
  context.closePath();
  context.fillStyle = HOME_ROOF;
  context.fill();
  context.stroke();
  // Door.
  context.fillStyle = INK;
  context.fillRect(-1.1, 1.6, 2.2, 3.4);
  context.restore();
}

/** Your stash: X marks the spot. */
function drawStash(context: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.lineCap = 'round';
  for (const [width, colour] of [
    [5.5, CREAM],
    [2.6, STASH],
  ] as const) {
    context.lineWidth = width;
    context.strokeStyle = colour;
    context.beginPath();
    context.moveTo(-4.5, -4.5);
    context.lineTo(4.5, 4.5);
    context.moveTo(4.5, -4.5);
    context.lineTo(-4.5, 4.5);
    context.stroke();
  }
  context.restore();
}

/** Another player: a dot in their own colour. */
function drawPlayerDot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: number,
): void {
  context.beginPath();
  context.arc(x, y, 4.2, 0, Math.PI * 2);
  context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.fill();
  context.lineWidth = 2.4;
  context.strokeStyle = CREAM;
  context.stroke();
  context.lineWidth = 1;
  context.strokeStyle = INK;
  context.stroke();
}

/** A skeleton raider: a small red diamond, brighter while it is swinging. */
function drawRaider(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  attacking: boolean,
  scale: number,
): void {
  const size = 4.6 * scale;
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x + size, y);
  context.lineTo(x, y + size);
  context.lineTo(x - size, y);
  context.closePath();
  context.fillStyle = attacking ? RAIDER_ATTACKING : RAIDER;
  context.fill();
  context.lineWidth = 2.2;
  context.strokeStyle = CREAM;
  context.stroke();
  context.lineWidth = 1;
  context.strokeStyle = INK;
  context.stroke();
}

/** Something of yours: a small symbol for each kind. */
function drawBuild(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  build: MapBuild,
  pixelsPerMetre: number,
  mapTurn: number,
): void {
  context.lineWidth = 1;
  context.strokeStyle = INK;
  switch (build.kind) {
    case 'fence': {
      // A short inked line, as long as the piece really is, turned the way it stands.
      const half = Math.max(2.5, 0.7 * pixelsPerMetre);
      const along = minimapOffset(Math.cos(build.yaw), -Math.sin(build.yaw), mapTurn);
      context.lineCap = 'round';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x - along.x * half, y - along.y * half);
      context.lineTo(x + along.x * half, y + along.y * half);
      context.stroke();
      return;
    }
    case 'campfire': {
      context.beginPath();
      context.moveTo(x, y - 4.5);
      context.quadraticCurveTo(x + 4, y + 0.5, x, y + 3.5);
      context.quadraticCurveTo(x - 4, y + 0.5, x, y - 4.5);
      context.fillStyle = build.lit ? '#e2842f' : '#8f8170';
      context.fill();
      context.stroke();
      return;
    }
    case 'lantern': {
      context.beginPath();
      context.arc(x, y, 2.8, 0, Math.PI * 2);
      context.fillStyle = '#f1c34f';
      context.fill();
      context.stroke();
      return;
    }
    case 'flowerBed': {
      context.beginPath();
      context.arc(x, y, 3, 0, Math.PI * 2);
      context.fillStyle = '#d873a6';
      context.fill();
      context.stroke();
      return;
    }
    case 'gardenPath': {
      context.beginPath();
      context.arc(x, y, Math.max(1.6, 0.35 * pixelsPerMetre), 0, Math.PI * 2);
      context.fillStyle = '#b3aea2';
      context.fill();
      context.lineWidth = 0.8;
      context.stroke();
      return;
    }
    default:
      return;
  }
}

function drawDiscovery(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save();
  context.translate(x, y);
  context.fillStyle = '#758f7e';
  context.strokeStyle = '#354d43';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -7);
  context.lineTo(6, 0);
  context.lineTo(0, 7);
  context.lineTo(-6, 0);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#f4ecd8';
  context.beginPath();
  context.arc(0, 0, 1.7, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
