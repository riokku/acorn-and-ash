import { useEffect, useRef } from 'react';

import { HEALTH_LOW_THRESHOLD, HEALTH_MAX, wrapAngle } from '@acorn/shared';

import type { CombatFeed, ThreatMark } from './combat-feed';

/**
 * What a fight looks like on top of the world (see decision 0063), redrawn
 * every frame straight from the game's own `CombatFeed`:
 *
 * - an arrowhead round the player for every skeleton out of sight, turning
 *   red and pulsing while it draws back to swing, so a blow from behind
 *   can be seen coming and rolled away from;
 * - the edges of the screen flashing red when a blow lands on us, with a
 *   bright arc on the side it came from;
 * - a slow red heartbeat round the edges while badly hurt.
 */

/** How far out to either side of the player the arrowheads sit, as a share of the screen's shorter side. */
const RING_SHARE = 0.3;
/**
 * How tall the ring is for how wide: a ring on the ground round the
 * player, seen from the camera's height, which also keeps the arrows for
 * whatever is behind us clear of the hint and the hotbar below.
 */
const RING_SQUASH = 0.72;
/** Room kept free at the bottom of the screen for the hint and the hotbar, in pixels. */
const RING_BOTTOM_CLEARANCE = 165;
/** Where the middle of that ring is, as a share of the screen's height: about where the player stands. */
const RING_CENTRE_Y = 0.56;
/** How long the red flash of being hurt lasts, and the arc showing where from. */
const HURT_FLASH_MS = 650;
const HURT_ARC_MS = 1100;
/** How wide that arc is either side of the blow's direction, in radians. */
const HURT_ARC_HALF_ANGLE = 0.42;
/** At or below this share of health, the edges keep beating red. */
const LOW_HEALTH = HEALTH_LOW_THRESHOLD / HEALTH_MAX;
/** Sharp enough for soft shapes, without filling a 4K screen's worth of pixels every frame. */
const MAX_PIXEL_RATIO = 1.5;
/** Closer than this, an arrowhead is as big and bold as it gets; further than this, as faint. */
const NEAR_METRES = 6;
const FAR_METRES = 40;

const ARROW = '#f6ead2';
const ARROW_EDGE = 'rgba(30, 20, 12, 0.75)';
const DANGER = '#ff3b2f';
const DANGER_GLOW = 'rgba(255, 50, 30, 0.9)';

export function CombatOverlay({ feed }: { readonly feed: CombatFeed }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    // Only cleared once there is nothing left to show, not every frame.
    let drewLastFrame = true;
    const draw = (): void => {
      frame = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas === null || canvas === undefined || context === null || context === undefined) {
        return;
      }
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const wantWidth = Math.round(width * ratio);
      const wantHeight = Math.round(height * ratio);
      if (canvas.width !== wantWidth) canvas.width = wantWidth;
      if (canvas.height !== wantHeight) canvas.height = wantHeight;
      const now = performance.now();
      if (!worthDrawing(feed, now)) {
        if (drewLastFrame) context.clearRect(0, 0, canvas.width, canvas.height);
        drewLastFrame = false;
        return;
      }
      drewLastFrame = true;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      drawCombat(context, feed, width, height, now);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [feed]);

  return <canvas ref={canvasRef} className="combat-overlay" data-testid="combat-overlay" />;
}

function worthDrawing(feed: CombatFeed, now: number): boolean {
  if (!feed.showing) return false;
  return (
    feed.target !== null ||
    feed.threats.length > 0 ||
    now - feed.hurtAtMs < Math.max(HURT_FLASH_MS, HURT_ARC_MS) ||
    (feed.health > 0 && feed.health <= LOW_HEALTH)
  );
}

function drawCombat(
  context: CanvasRenderingContext2D,
  feed: CombatFeed,
  width: number,
  height: number,
  now: number,
): void {
  if (feed.health > 0 && feed.health <= LOW_HEALTH) {
    redEdges(context, width, height, 0.14 + 0.16 * heartbeat(now));
  }
  const sinceHurt = now - feed.hurtAtMs;
  if (sinceHurt < HURT_FLASH_MS) {
    const fade = 1 - sinceHurt / HURT_FLASH_MS;
    redEdges(context, width, height, (0.22 + 0.4 * feed.hurtAmount) * fade * fade);
  }

  const ring = ringFor(width, height);
  if (sinceHurt < HURT_ARC_MS && feed.hurtYaw !== null) {
    const bearing = wrapAngle(feed.cameraYaw - feed.hurtYaw);
    hurtArc(context, ring, bearing, 1 - sinceHurt / HURT_ARC_MS);
  }
  const target = feed.target;
  if (target !== null) {
    const x =
      target.screen === null
        ? ring.centreX + Math.sin(target.bearing) * ring.radiusX
        : target.screen.x * width;
    const y =
      target.screen === null
        ? ring.centreY - Math.cos(target.bearing) * ring.radiusY
        : target.screen.y * height;
    context.save();
    context.strokeStyle = '#ffd45c';
    context.lineWidth = 3;
    context.shadowColor = '#241608';
    context.shadowBlur = 5;
    // A gold diamond remains distinct from the ordinary threat arrowheads.
    context.beginPath();
    context.moveTo(x, y - 24);
    context.lineTo(x + 20, y);
    context.lineTo(x, y + 24);
    context.lineTo(x - 20, y);
    context.closePath();
    context.stroke();
    context.font = '600 16px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    const label = `Target: ${target.name} · ${Math.round(target.distance)} m`;
    const labelX = Math.max(150, Math.min(width - 150, x));
    const labelY = Math.max(42, y - 30);
    context.lineWidth = 4;
    context.strokeStyle = '#241608';
    context.strokeText(label, labelX, labelY);
    context.fillStyle = '#ffd45c';
    context.fillText(label, labelX, labelY);
    context.restore();
  }
  // The calm ones first, so one about to swing is always drawn on top.
  for (const threat of feed.threats) {
    if (!threat.attacking) arrowhead(context, ring, threat, now);
  }
  for (const threat of feed.threats) {
    if (threat.attacking) arrowhead(context, ring, threat, now);
  }
}

/** The flattened ring round the player that the arrowheads and the hurt arc sit on. */
interface Ring {
  readonly centreX: number;
  readonly centreY: number;
  readonly radiusX: number;
  readonly radiusY: number;
}

function ringFor(width: number, height: number): Ring {
  const centreY = height * RING_CENTRE_Y;
  const radiusX = Math.min(width, height) * RING_SHARE;
  const roomBelow = height - RING_BOTTOM_CLEARANCE - centreY;
  // Never flatter than half as tall, however short the window.
  const radiusY = Math.max(radiusX * RING_SQUASH * 0.5, Math.min(radiusX * RING_SQUASH, roomBelow));
  return { centreX: width / 2, centreY, radiusX, radiusY };
}

/** Red creeping in from the edges of the screen, `alpha` strong at the corners. */
function redEdges(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.32,
    width / 2,
    height / 2,
    Math.hypot(width, height) / 2,
  );
  gradient.addColorStop(0, 'rgba(160, 10, 4, 0)');
  gradient.addColorStop(1, `rgba(160, 10, 4, ${alpha.toFixed(3)})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

/** A bright arc on the ring, on the side a blow came from. */
function hurtArc(
  context: CanvasRenderingContext2D,
  ring: Ring,
  bearing: number,
  fade: number,
): void {
  // A bearing counts from straight up; a canvas angle from straight right.
  const angle = bearing - Math.PI / 2;
  context.save();
  context.lineCap = 'round';
  context.shadowColor = DANGER_GLOW;
  context.shadowBlur = 18;
  context.strokeStyle = `rgba(255, 64, 40, ${(0.9 * fade).toFixed(3)})`;
  context.lineWidth = 9;
  context.beginPath();
  context.ellipse(
    ring.centreX,
    ring.centreY,
    ring.radiusX + 16,
    ring.radiusY + 16,
    0,
    angle - HURT_ARC_HALF_ANGLE,
    angle + HURT_ARC_HALF_ANGLE,
  );
  context.stroke();
  context.restore();
}

/**
 * An arrowhead on the ring, pointing out towards a skeleton: bigger and
 * bolder the closer it is, and red and pulsing while it is about to swing.
 */
function arrowhead(
  context: CanvasRenderingContext2D,
  ring: Ring,
  threat: ThreatMark,
  now: number,
): void {
  const near = Math.min(
    1,
    Math.max(0, (FAR_METRES - threat.distance) / (FAR_METRES - NEAR_METRES)),
  );
  const pulse = threat.attacking ? 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2 * 3) : 0;
  const size = threat.attacking ? 15 : 11;
  const scale = (0.8 + 0.35 * near) * (1 + 0.18 * pulse);
  const alpha = threat.attacking ? 0.8 + 0.2 * pulse : 0.4 + 0.45 * near;

  context.save();
  const outX = Math.sin(threat.bearing) * ring.radiusX;
  const outY = -Math.cos(threat.bearing) * ring.radiusY;
  context.translate(ring.centreX + outX, ring.centreY + outY);
  // Pointing straight out from the player, across the flattened ring.
  context.rotate(Math.atan2(outX, -outY));
  context.scale(scale, scale);
  context.globalAlpha = alpha;
  context.beginPath();
  context.moveTo(0, -size);
  context.lineTo(size, size * 0.55);
  context.lineTo(0, size * 0.12);
  context.lineTo(-size, size * 0.55);
  context.closePath();
  context.lineJoin = 'round';
  if (threat.attacking) {
    context.shadowColor = DANGER_GLOW;
    context.shadowBlur = 14;
  }
  context.fillStyle = threat.attacking ? DANGER : ARROW;
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 1.6;
  context.strokeStyle = ARROW_EDGE;
  context.stroke();
  context.restore();
}

/** A heart's double beat, about once a second, from 0 to about 1. */
function heartbeat(now: number): number {
  const t = (now / 1000) % 1;
  return Math.exp(-(((t - 0.05) / 0.07) ** 2)) + 0.6 * Math.exp(-(((t - 0.27) / 0.07) ** 2));
}
