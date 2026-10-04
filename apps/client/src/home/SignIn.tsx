import { loginPath, providerName, type SessionStatus } from '../net/account';
import { ForestBackdrop } from './Home';

interface SignInProps {
  readonly status: SessionStatus;
  /** Why the last attempt did not work, if it did not. */
  readonly notice: string | null;
  readonly onTestSignIn: () => void;
}

/**
 * The first screen for anybody who is not signed in: choose Google or Discord.
 *
 * The buttons are plain links to the site, which sends the browser off to the
 * login service and back, so there is nothing here to go wrong in a script.
 */
export function SignIn({ status, notice, onTestSignIn }: SignInProps): React.JSX.Element {
  const nothingToOffer = status.providers.length === 0 && status.testSignIn !== 'button';

  return (
    <div className="home-screen">
      <ForestBackdrop />
      <div className="home-card">
        <p className="home-kicker">Cozy wilderness survival</p>
        <h1 className="home-title">Acorn &amp; Ash</h1>
        <p className="home-subtitle">
          Sign in to enter the clearing. Your character is saved to your account, so you can pick up
          where you left off on any computer.
        </p>

        {notice !== null ? (
          <p className="home-notice" role="alert">
            {notice}
          </p>
        ) : null}

        <div className="home-signins">
          {status.providers.map((provider) => (
            <a
              key={provider}
              className={`home-signin home-signin-${provider}`}
              href={loginPath(provider)}
            >
              Continue with {providerName(provider)}
            </a>
          ))}
          {status.testSignIn === 'button' ? (
            <button type="button" className="home-signin home-signin-test" onClick={onTestSignIn}>
              Test sign-in
            </button>
          ) : null}
        </div>

        {status.testSignIn === 'button' ? (
          <p className="home-footnote">
            This is a preview build, where Google and Discord can&rsquo;t sign you in. Test sign-in
            makes a throwaway player for this browser.
          </p>
        ) : null}
        {nothingToOffer ? (
          <p className="home-notice" role="status">
            Signing in isn&rsquo;t switched on here yet. Please check back soon.
          </p>
        ) : (
          <p className="home-footnote">
            We keep your name and email from Google or Discord to recognise you. Nothing is ever
            posted for you.
          </p>
        )}
      </div>
    </div>
  );
}

interface TroubleProps {
  readonly message: string;
  readonly onRetry: () => void;
}

/** Shown when the site can't be reached at all, so the player is not left on a blank page. */
export function Trouble({ message, onRetry }: TroubleProps): React.JSX.Element {
  return (
    <div className="home-screen">
      <ForestBackdrop />
      <div className="home-card">
        <h1 className="home-title">Acorn &amp; Ash</h1>
        <p className="home-notice" role="alert">
          {message}
        </p>
        <button type="button" className="home-play" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}
