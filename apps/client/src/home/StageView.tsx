import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';

import { CharacterStage, type StageLook } from './character-stage';
import { placementOfBox, type Placement } from './showcase';

interface StageViewProps {
  readonly look: StageLook;
  readonly placement: Placement;
  /** What the character is, in words, for somebody who cannot see them. */
  readonly label: string;
}

/**
 * The character on the character screen: a canvas over the painting with the
 * real character standing on it (decision 0107). If the browser cannot draw it,
 * the canvas stays empty and the rest of the screen works just the same.
 *
 * Each time this mounts it makes its own canvas rather than reusing one from the
 * page, because a canvas that has been given to a renderer cannot be given to
 * another, and React may mount, unmount and mount again.
 */
export function StageView({ look, placement, label }: StageViewProps): React.JSX.Element {
  const holder = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<CharacterStage | null>(null);

  useEffect(() => {
    const parent = holder.current;
    if (parent === null) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = 'character-stage-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('data-testid', 'character-stage');
    canvas.dataset.state = 'loading';
    parent.append(canvas);

    let cancelled = false;
    let opened: CharacterStage | null = null;
    CharacterStage.open(canvas).then(
      (next) => {
        if (cancelled) {
          next.dispose();
          return;
        }
        opened = next;
        setStage(next);
      },
      (error: unknown) => {
        // No drawing here is a shame, not a reason to stop somebody entering.
        console.warn('The character could not be drawn on this screen.', error);
        canvas.dataset.state = 'unavailable';
      },
    );

    return () => {
      cancelled = true;
      opened?.dispose();
      canvas.remove();
      setStage(null);
    };
  }, []);

  useEffect(() => {
    stage?.show(look);
  }, [stage, look.character, look.tint]);

  useEffect(() => {
    stage?.place(placement);
  }, [stage, placement.across, placement.feet, placement.share]);

  useEffect(() => {
    holder.current?.querySelector('canvas')?.setAttribute('aria-label', label);
  }, [label, stage]);

  return <div ref={holder} className="character-stage" />;
}

const WIDE_SCREEN = '(min-width: 900px) and (min-height: 540px)';

function watchWideScreen(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_SCREEN);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether the window is big enough to hold the character beside the card, rather than above it. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(
    watchWideScreen,
    () => window.matchMedia(WIDE_SCREEN).matches,
    () => true,
  );
}

/** Placements closer than this, as a share of the window, are the same place. */
const SAME_PLACE = 0.0005;

function samePlace(a: Placement, b: Placement): boolean {
  return (
    Math.abs(a.across - b.across) < SAME_PLACE &&
    Math.abs(a.feet - b.feet) < SAME_PLACE &&
    Math.abs(a.share - b.share) < SAME_PLACE
  );
}

/**
 * Where the character should stand to fill an empty slot in the page's layout.
 *
 * The page lays out its title, the slot and the card in one column and centres
 * the whole column, so the character ends up in the middle of the window with
 * the text above and below them, whatever size the text turns out to be. This
 * measures the slot, and again whenever the window or anything beside it
 * changes size or the page scrolls, and says where they should stand. Until
 * the first measurement they stand where `fallback` says.
 */
export function useSlotPlacement(
  slot: RefObject<HTMLElement | null>,
  fallback: Placement,
): Placement {
  const [placement, setPlacement] = useState(fallback);

  useLayoutEffect(() => {
    const element = slot.current;
    if (element === null) return undefined;
    const measure = (): void => {
      const next = placementOfBox(
        element.getBoundingClientRect(),
        window.innerWidth,
        window.innerHeight,
      );
      if (next !== null) setPlacement((before) => (samePlace(before, next) ? before : next));
    };
    measure();

    // The title and card can change height once the page's fonts arrive.
    const watcher = new ResizeObserver(measure);
    const column = element.parentElement;
    if (column !== null) for (const child of Array.from(column.children)) watcher.observe(child);
    const scroller = element.closest('.home-screen');
    window.addEventListener('resize', measure);
    scroller?.addEventListener('scroll', measure);
    return () => {
      watcher.disconnect();
      window.removeEventListener('resize', measure);
      scroller?.removeEventListener('scroll', measure);
    };
  }, [slot]);

  return placement;
}
