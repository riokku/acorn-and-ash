import { useLayoutEffect, useRef } from 'react';

import painting from '../../../../assets/ui/entering-the-woods.webp?url';
import { PAINTING_HEIGHT, PAINTING_WIDTH } from './backdrop-world';
import { attachBackdrop, driftOffsetSeconds } from './shared-backdrop';

/**
 * The painted forest valley behind every screen before the game itself: the
 * front page, sign-in, the character screen and the loading screen (decision
 * 0103). Purely decoration, so it is hidden from screen readers; each screen
 * says everything it means in words of its own.
 *
 * The painting is alive (decision 0106): mist drifts through the valley, the
 * lake glints, smoke rises from the cabin's chimney and its windows glow, the
 * camera slowly drifts, and the colours follow the time of year in the game's
 * own calendar, with leaves, snow, petals or pollen in the air. All of it is
 * drawn by `shared-backdrop.ts`, which keeps it going as one screen replaces
 * the next.
 *
 * `still` holds the camera where it is while everything else keeps moving. The
 * loading screen uses it: drifting a full-window picture every frame is cheap
 * on a graphics card but, on a computer without one, it made the game behind it
 * take about three times as long to load.
 *
 * It is `fixed`, not `absolute`, so a screen that scrolls on a short window
 * never scrolls the painting away and shows bare colour underneath.
 */
export function PaintingBackdrop({ still = false }: { still?: boolean }): React.JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const graded = useRef<HTMLCanvasElement>(null);
  const effects = useRef<HTMLCanvasElement>(null);
  // Where the drift of the camera has got to, so a new screen carries on from it.
  const drift = useRef(driftOffsetSeconds());

  // Before the first paint, so a screen that follows another is never seen without its colours.
  useLayoutEffect(() => {
    if (
      stage.current === null ||
      image.current === null ||
      graded.current === null ||
      effects.current === null
    ) {
      return;
    }
    return attachBackdrop({
      stage: stage.current,
      image: image.current,
      graded: graded.current,
      effects: effects.current,
    });
  }, []);

  return (
    <div className="painting-backdrop" aria-hidden="true">
      <div
        className={still ? 'painting-stage is-still' : 'painting-stage'}
        ref={stage}
        style={{ animationDelay: `-${drift.current.toFixed(2)}s` }}
      >
        <img className="painting-image" ref={image} src={painting} alt="" />
        <canvas
          className="painting-graded"
          ref={graded}
          width={PAINTING_WIDTH}
          height={PAINTING_HEIGHT}
        />
        <canvas
          className="painting-effects"
          ref={effects}
          width={PAINTING_WIDTH}
          height={PAINTING_HEIGHT}
        />
      </div>
      <div className="painting-shade" />
    </div>
  );
}
