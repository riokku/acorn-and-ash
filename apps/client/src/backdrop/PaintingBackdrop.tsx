import painting from '../../../../assets/ui/entering-the-woods.webp?url';

/**
 * The painted forest valley behind every screen before the game itself: the
 * front page, sign-in, the character screen and the loading screen (decision
 * 0103). Purely decoration, so it is hidden from screen readers; each screen
 * says everything it means in words of its own.
 *
 * It is `fixed`, not `absolute`, so a screen that scrolls on a short window
 * never scrolls the painting away and shows bare colour underneath.
 */
export function PaintingBackdrop(): React.JSX.Element {
  return (
    <div className="painting-backdrop" aria-hidden="true">
      <img className="painting-image" src={painting} alt="" />
      <div className="painting-shade" />
    </div>
  );
}
