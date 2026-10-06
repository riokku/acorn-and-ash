/**
 * Keeps the backdrop moving, once, however many screens come and go over it
 * (decision 0106).
 *
 * The front page, the sign-in choices, the character screen and the loading
 * screen each show the painting, and pressing a button swaps one for the next.
 * If each started its own picture the leaves and mist would jump back to the
 * start at every click. So the moving world and the recoloured painting live
 * here, one of each, and a screen only plugs its canvases in and out.
 */

import type { SeasonMix } from '@acorn/shared';

import { readSettings } from '../settings';
import { backdropSeasonMix, mixKey } from './backdrop-clock';
import { BackdropPainter } from './backdrop-paint';
import { BackdropWorld, PAINTING_HEIGHT, PAINTING_WIDTH } from './backdrop-world';
import { Pacer } from './pacing';
import { findWater, gradeFor, gradePixels, isAsPainted } from './season-grade';

export interface BackdropElements {
  /** The painting as it was made: what shows while the recoloured copy is made. */
  readonly image: HTMLImageElement;
  /** The box the painting and everything over it sit in, which is what drifts. */
  readonly stage: HTMLElement;
  /** Where the recoloured painting is drawn. */
  readonly graded: HTMLCanvasElement;
  /** Where the mist, water, smoke and falling things are drawn. */
  readonly effects: HTMLCanvasElement;
}

interface Prepared {
  /** The recoloured painting, or null when the season leaves it as it was made. */
  readonly graded: HTMLCanvasElement | null;
}

interface Session {
  readonly key: string;
  readonly mix: SeasonMix;
  readonly world: BackdropWorld;
  readonly pacer: Pacer;
  /** Started by the first screen to show the painting, which is what gives us an image to read. */
  loading: Promise<void> | null;
  prepared: Prepared | null;
}

interface Attachment {
  readonly elements: BackdropElements;
  readonly painter: BackdropPainter;
}

/** Most frames a second the moving parts are drawn at: smooth enough for mist and leaves, and kind to laptops. */
const FRAMES_PER_SECOND = 30;

/** Seconds the slow drift of the camera takes to go out and back, matching the stylesheet. */
export const DRIFT_SECONDS = 240;

const startedAt = performance.now();
const attachments = new Set<Attachment>();
let session: Session | null = null;
let running: number | null = null;
let lastFrame = 0;

const prefersLessMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * How far into its slow drift the camera is. A screen starts its drift this far
 * in, so swapping one screen for the next carries on instead of jumping back.
 */
export function driftOffsetSeconds(): number {
  return ((performance.now() - startedAt) / 1000) % DRIFT_SECONDS;
}

/** A moment when the page has nothing better to do, so reading the painting does not stall the first screen. */
function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 400 });
    } else {
      window.setTimeout(resolve, 60);
    }
  });
}

/** Read the painting, find the water, and recolour it for the season. */
async function prepare(image: HTMLImageElement, current: Session): Promise<void> {
  await image.decode();
  await whenIdle();
  const canvas = document.createElement('canvas');
  canvas.width = PAINTING_WIDTH;
  canvas.height = PAINTING_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return;
  context.drawImage(image, 0, 0, PAINTING_WIDTH, PAINTING_HEIGHT);
  const pixels = context.getImageData(0, 0, PAINTING_WIDTH, PAINTING_HEIGHT);

  // Glints and ripples are motion: someone who asked for less gets a still lake.
  if (!prefersLessMotion()) {
    current.world.setWater(findWater(pixels.data, PAINTING_WIDTH, PAINTING_HEIGHT));
  }

  const grade = gradeFor(current.mix);
  if (isAsPainted(grade)) {
    current.prepared = { graded: null };
  } else {
    gradePixels(pixels.data, pixels.data, PAINTING_WIDTH, PAINTING_HEIGHT, grade);
    context.putImageData(pixels, 0, 0);
    current.prepared = { graded: canvas };
  }
}

/** Put the recoloured painting on this screen's canvas. */
function showPainting(attachment: Attachment, prepared: Prepared, fade: boolean): void {
  const { graded } = attachment.elements;
  if (prepared.graded === null) return;
  const context = graded.getContext('2d');
  if (context === null) return;
  context.drawImage(prepared.graded, 0, 0);
  // A screen that comes after the first is given the finished painting at once,
  // so a click never flashes the plain one.
  if (!fade) graded.style.transition = 'none';
  graded.classList.add('is-ready');
}

function frame(now: number): void {
  running = requestAnimationFrame(frame);
  if (session === null) return;
  const gap = now - lastFrame;
  if (gap < 1000 / FRAMES_PER_SECOND - 2) return;
  lastFrame = now;

  const began = performance.now();
  session.world.step(gap / 1000);
  for (const attachment of attachments) attachment.painter.paint(session.world);
  session.pacer.record(performance.now() - began, gap);
  session.world.detail = session.pacer.detail;
  if (session.pacer.stopped) settle();
}

/** The computer cannot keep up: stop moving, and leave the picture as a still. */
function settle(): void {
  stop();
  for (const attachment of attachments) attachment.elements.stage.classList.add('is-still');
}

function start(): void {
  if (running !== null) return;
  lastFrame = performance.now();
  running = requestAnimationFrame(frame);
}

function stop(): void {
  if (running !== null) cancelAnimationFrame(running);
  running = null;
}

function sessionFor(mix: SeasonMix): Session {
  const key = mixKey(mix);
  if (session !== null && session.key === key) {
    session.world.setSeason(mix);
    return session;
  }
  session = {
    key,
    mix,
    world: new BackdropWorld({ mix, reducedMotion: prefersLessMotion() }),
    pacer: new Pacer(),
    loading: null,
    prepared: null,
  };
  return session;
}

/**
 * Show the moving backdrop on these elements until the returned function is
 * called. Safe to call again for the next screen before the last one has gone.
 */
export function attachBackdrop(elements: BackdropElements): () => void {
  const context = elements.effects.getContext('2d');
  if (context === null) return () => undefined;

  const current = sessionFor(
    backdropSeasonMix(Date.now(), readSettings(window.location.search).season),
  );
  const attachment: Attachment = { elements, painter: new BackdropPainter(context) };
  attachments.add(attachment);

  if (current.prepared !== null) {
    showPainting(attachment, current.prepared, false);
  } else {
    current.loading ??= prepare(elements.image, current);
    current.loading.then(
      () => {
        if (current.prepared !== null && attachments.has(attachment)) {
          showPainting(attachment, current.prepared, true);
        }
        // Reduced motion draws once, here, once the water and painting are known.
        if (prefersLessMotion()) attachment.painter.paint(current.world);
      },
      () => undefined,
    );
  }

  // A still picture for reduced motion, or for a computer that could not keep up.
  if (prefersLessMotion() || current.pacer.stopped) {
    if (current.pacer.stopped) elements.stage.classList.add('is-still');
    attachment.painter.paint(current.world);
  } else {
    start();
  }

  return () => {
    attachments.delete(attachment);
    if (attachments.size === 0) stop();
  };
}
