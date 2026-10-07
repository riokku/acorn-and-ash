import { useState } from 'react';

import { PaintingBackdrop } from '../backdrop/PaintingBackdrop';
import { loginPath, providerName, type Provider, type SessionStatus } from '../net/account';
import { DiscordIcon, GoogleIcon } from './brand-icons';
import type { AccountTab } from './front-door';

export interface FrontDoorProps {
  /**
   * What the site offers for signing in, or null when somebody is already
   * signed in, in which case Play goes straight on to their character.
   */
  readonly status: SessionStatus | null;
  /** Why the last attempt did not work, if it did not. */
  readonly notice: string | null;
  /** Skip the Play button, for somebody who has already pressed it in this tab. */
  readonly startAtChoices: boolean;
  /** Which of "Create account" and "Log in" shows first. */
  readonly firstTab: AccountTab;
  /** Play was pressed. Where somebody is signed in, this is what moves on. */
  readonly onPlay: () => void;
  readonly onTestSignIn: () => void;
}

/**
 * The first thing anybody sees (decision 0103): the painted valley with a Play
 * button. Play leads to "Create account" and "Log in", which are two wordings
 * of the same Google and Discord buttons, since those services make the
 * account the first time and recognise it afterwards.
 *
 * The buttons are plain links to the site, which sends the browser off to the
 * login service and back, so there is nothing here to go wrong in a script.
 */
export function FrontDoor({
  status,
  notice,
  startAtChoices,
  firstTab,
  onPlay,
  onTestSignIn,
}: FrontDoorProps): React.JSX.Element {
  const [atChoices, setAtChoices] = useState(startAtChoices);
  const [tab, setTab] = useState<AccountTab>(firstTab);

  const play = (): void => {
    onPlay();
    if (status !== null) setAtChoices(true);
  };

  if (!atChoices || status === null) {
    return (
      <div className="front-door" data-testid="front-door">
        <PaintingBackdrop />
        <div className="front-copy">
          <p className="front-eyebrow">A little further from the everyday</p>
          <h1 className="front-title">Acorn &amp; Ash</h1>
          <p className="front-tagline">
            A cozy wilderness survival game. There&rsquo;s a place for you among the evergreens.
          </p>
          <button type="button" className="front-play" onClick={play} autoFocus>
            Play
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="front-door front-door-choices" data-testid="front-choices">
      <PaintingBackdrop />
      <div className="front-panel">
        <h1 className="front-title front-title-small">Acorn &amp; Ash</h1>
        <ChoiceTabs tab={tab} onChange={setTab} />
        <div role="tabpanel" id="front-choices" aria-labelledby={`front-tab-${tab}`}>
          <p className="front-lede">
            {tab === 'create'
              ? 'Make your account with Google or Discord. Your character is saved to it, so you can pick up where you left off on any computer.'
              : 'Welcome back. Use the same one you made your account with, and your character will be waiting.'}
          </p>
          <SignInChoices status={status} notice={notice} tab={tab} onTestSignIn={onTestSignIn} />
        </div>
        <button type="button" className="front-back" onClick={() => setAtChoices(false)}>
          Back
        </button>
      </div>
    </div>
  );
}

function ChoiceTabs({
  tab,
  onChange,
}: {
  tab: AccountTab;
  onChange: (tab: AccountTab) => void;
}): React.JSX.Element {
  const tabs: readonly { id: AccountTab; label: string }[] = [
    { id: 'create', label: 'Create account' },
    { id: 'login', label: 'Log in' },
  ];
  return (
    <div className="front-tabs" role="tablist" aria-label="Create an account or log in">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          id={`front-tab-${id}`}
          type="button"
          role="tab"
          aria-selected={tab === id}
          aria-controls="front-choices"
          className={'front-tab' + (tab === id ? ' front-tab-selected' : '')}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SignInChoices({
  status,
  notice,
  tab,
  onTestSignIn,
}: {
  status: SessionStatus;
  notice: string | null;
  tab: AccountTab;
  onTestSignIn: () => void;
}): React.JSX.Element {
  const nothingToOffer = status.providers.length === 0 && status.testSignIn !== 'button';
  const verb = tab === 'create' ? 'Sign up' : 'Log in';

  return (
    <>
      {notice !== null ? (
        <p className="front-notice" role="alert">
          {notice}
        </p>
      ) : null}

      <div className="front-signins">
        {status.providers.map((provider) => (
          <a
            key={provider}
            className={`front-signin front-signin-${provider}`}
            href={loginPath(provider)}
          >
            <ProviderIcon provider={provider} />
            <span>
              {verb} with {providerName(provider)}
            </span>
          </a>
        ))}
        {status.testSignIn === 'button' ? (
          <button type="button" className="front-signin front-signin-test" onClick={onTestSignIn}>
            Test sign-in
          </button>
        ) : null}
      </div>

      {status.testSignIn === 'button' ? (
        <p className="front-footnote">
          This is a preview build, where Google and Discord can&rsquo;t sign you in. Test sign-in
          makes a throwaway player for this browser.
        </p>
      ) : null}
      {nothingToOffer ? (
        <p className="front-notice" role="status">
          Signing in isn&rsquo;t switched on here yet. Please check back soon.
        </p>
      ) : (
        <p className="front-footnote">
          We keep your name and email from Google or Discord to recognise you. Nothing is ever
          posted for you.
        </p>
      )}
    </>
  );
}

function ProviderIcon({ provider }: { provider: Provider }): React.JSX.Element {
  return provider === 'google' ? <GoogleIcon /> : <DiscordIcon />;
}

interface TroubleProps {
  readonly message: string;
  readonly onRetry: () => void;
}

/** Shown when the site can't be reached at all, so the player is not left on a blank page. */
export function Trouble({ message, onRetry }: TroubleProps): React.JSX.Element {
  return (
    <div className="home-screen">
      <PaintingBackdrop />
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
