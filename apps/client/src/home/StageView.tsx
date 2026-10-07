import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { CharacterStage, type StageLook } from './character-stage';
import type { Placement } from './showcase';

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
