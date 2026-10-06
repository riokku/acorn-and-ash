/**
 * The countdown shown over the game while somebody is signing out (decision
 * 0104), and for a few seconds after one is cancelled, to say why.
 *
 * It sits above everything else, including the "Click to play" curtain, and
 * stops its clicks reaching the curtain so pressing Cancel never also resumes
 * play.
 */
export function SignOutBanner({
  secondsLeft,
  notice,
  onCancel,
}: {
  secondsLeft: number | null;
  notice: string | null;
  onCancel?: () => void;
}): React.JSX.Element | null {
  if (secondsLeft !== null) {
    return (
      <div className="signout-banner" data-testid="signout-banner" role="status">
        <p>
          {secondsLeft > 0 ? `Signing out in ${secondsLeft}…` : 'Signing out…'}
          <span className="signout-hint"> Move or press Cancel to stay.</span>
        </p>
        {secondsLeft > 0 ? (
          <button
            type="button"
            className="signout-cancel"
            onClick={(event) => {
              event.stopPropagation();
              onCancel?.();
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
    );
  }
  if (notice !== null) {
    return (
      <div className="signout-banner signout-banner-notice" role="status">
        <p>{notice}</p>
      </div>
    );
  }
  return null;
}
