import { useState } from 'react';

import {
  CHARACTER_KINDS,
  CHARACTER_ORDER,
  MAX_PLAYER_NAME_LENGTH,
  TINT_COLORS,
  TINT_COLOR_ORDER,
  isValidPlayerName,
  sanitizePlayerName,
  type CharacterId,
  type TintColorId,
} from '@acorn/shared';

import type { PlayerIdentity } from './identity';
import { PaintingBackdrop } from '../backdrop/PaintingBackdrop';
import { SettingsMenu, type SettingsAccount } from '../preferences/SettingsMenu';
import type { Preferences } from '../preferences/preferences';

interface HomeProps {
  readonly initial: PlayerIdentity;
  /** The character already made in this world, if there is one (decision 0087). */
  readonly saved: PlayerIdentity | null;
  /** Who is signed in, shown back to them so they know it is the right account. */
  readonly accountName: string;
  readonly onSignOut: () => void;
  readonly onPlay: (identity: PlayerIdentity) => void;
  readonly initialPreferences: Preferences;
  readonly onSettingsChange: (preferences: Preferences) => void;
}

/**
 * Shown before the game connects. A player with no character in this world
 * picks a name, a character and a tint, once; a player who has one is welcomed
 * back to it and goes straight in.
 *
 * All six of the pack's characters have real art now (see decisions 0036
 * and 0044) - the lock/"Coming soon" styling below stays in place for
 * whenever a future character joins the roster the same way these five did.
 */
export function Home({
  initial,
  saved,
  accountName,
  onSignOut,
  onPlay,
  initialPreferences,
  onSettingsChange,
}: HomeProps): React.JSX.Element {
  const [name, setName] = useState(initial.name);
  const [character, setCharacter] = useState<CharacterId>(initial.character);
  const [color, setColor] = useState<TintColorId>(initial.color);

  // Settings has Sign out here too, so it is in the same place everywhere. No waiting: nobody is in the world yet.
  const account: SettingsAccount = {
    waitSeconds: 0,
    secondsLeft: null,
    onSignOut,
    onCancelSignOut: () => undefined,
  };

  const trimmed = sanitizePlayerName(name);
  const canPlay = isValidPlayerName(trimmed);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!canPlay) return;
    onPlay({ name: trimmed, character, color });
  };

  if (saved !== null) {
    return (
      <form
        className="home-screen"
        onSubmit={(event) => {
          event.preventDefault();
          onPlay(saved);
        }}
      >
        <PaintingBackdrop />
        <SettingsMenu initial={initialPreferences} onChange={onSettingsChange} account={account} />
        <div className="home-card">
          <p className="home-kicker">Welcome back</p>
          <h1 className="home-title">Acorn &amp; Ash</h1>
          <div className="home-saved" data-testid="saved-character">
            <PersonIcon color={hexString(TINT_COLORS[saved.color].hex)} />
            <span className="home-saved-name">{saved.name}</span>
            <span className="home-saved-kind">{CHARACTER_KINDS[saved.character].displayName}</span>
          </div>
          <button type="submit" className="home-play" autoFocus>
            Enter the clearing as {saved.name}
          </button>
          <AccountLine accountName={accountName} onSignOut={onSignOut} />
        </div>
      </form>
    );
  }

  return (
    <form className="home-screen" onSubmit={handleSubmit}>
      <PaintingBackdrop />
      <SettingsMenu initial={initialPreferences} onChange={onSettingsChange} account={account} />
      <div className="home-card">
        <p className="home-kicker">Cozy wilderness survival</p>
        <h1 className="home-title">Acorn &amp; Ash</h1>
        <p className="home-subtitle">Pick who you&rsquo;ll be in the clearing.</p>

        <label className="home-field" htmlFor="home-name">
          <span className="home-label">What should we call you?</span>
          <input
            id="home-name"
            type="text"
            value={name}
            maxLength={MAX_PLAYER_NAME_LENGTH}
            placeholder="e.g. Acorn"
            autoComplete="off"
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <span className="home-hint">2&ndash;{MAX_PLAYER_NAME_LENGTH} characters</span>
        </label>

        <div className="home-section">
          <span className="home-label">Your character</span>
          <div className="home-characters">
            {CHARACTER_ORDER.map((id) => {
              const kind = CHARACTER_KINDS[id];
              const selected = id === character;
              const highlighted = selected && kind.available;
              return (
                <button
                  key={id}
                  type="button"
                  className={'home-character' + (highlighted ? ' home-character-selected' : '')}
                  style={
                    highlighted ? { borderColor: hexString(TINT_COLORS[color].hex) } : undefined
                  }
                  disabled={!kind.available}
                  onClick={() => setCharacter(id)}
                  aria-label={
                    kind.available
                      ? `${kind.displayName} — select`
                      : `${kind.displayName} — coming soon`
                  }
                >
                  {!kind.available ? (
                    <span className="home-character-lock" aria-hidden="true">
                      <LockIcon />
                    </span>
                  ) : null}
                  {highlighted ? (
                    <span className="home-character-check" aria-hidden="true">
                      <CheckIcon />
                    </span>
                  ) : null}
                  <PersonIcon
                    color={kind.available ? hexString(TINT_COLORS[color].hex) : undefined}
                  />
                  <span className="home-character-name">{kind.displayName}</span>
                  {!kind.available ? (
                    <span className="home-character-soon">Coming soon</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="home-section">
          <span className="home-label">Your tint</span>
          <div className="home-colors">
            {TINT_COLOR_ORDER.map((id) => {
              const hex = hexString(TINT_COLORS[id].hex);
              const selected = id === color;
              return (
                <button
                  key={id}
                  type="button"
                  className={'home-color' + (selected ? ' home-color-selected' : '')}
                  style={{
                    background: hex,
                    boxShadow: selected ? `0 0 0 3px #f3e6c6, 0 0 0 5px ${hex}` : undefined,
                  }}
                  onClick={() => setColor(id)}
                  aria-label={`Tint: ${TINT_COLORS[id].displayName}`}
                />
              );
            })}
          </div>
        </div>

        <button type="submit" className="home-play" disabled={!canPlay}>
          {canPlay ? `Enter the clearing as ${trimmed}` : 'Enter the clearing'}
        </button>
        <p className="home-footnote">
          Others in the clearing will see this name. You get one character in this world, so choose
          with care: it can&rsquo;t be changed later.
        </p>
        <AccountLine accountName={accountName} onSignOut={onSignOut} />
      </div>
    </form>
  );
}

/** Which account is signed in, and the way out of it. */
function AccountLine({
  accountName,
  onSignOut,
}: {
  accountName: string;
  onSignOut: () => void;
}): React.JSX.Element {
  return (
    <p className="home-footnote home-account">
      Signed in as {accountName}.{' '}
      <button type="button" className="home-link" onClick={onSignOut}>
        Sign out
      </button>
    </p>
  );
}

function hexString(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function PersonIcon({ color }: { color?: string }): React.JSX.Element {
  return (
    <svg
      width="42"
      height="54"
      viewBox="0 0 56 72"
      className="home-character-icon"
      style={color !== undefined ? { color } : undefined}
      aria-hidden="true"
    >
      <circle cx="28" cy="18" r="14" fill="currentColor" />
      <path d="M10 72 C10 48 16 40 28 40 C40 40 46 48 46 72 Z" fill="currentColor" />
    </svg>
  );
}

function LockIcon(): React.JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fffaf0"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
