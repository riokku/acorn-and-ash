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

import { DeleteCharacterDialog } from './DeleteCharacterPanel';
import type { PlayerIdentity } from './identity';
import { PaintingBackdrop } from '../backdrop/PaintingBackdrop';
import { SettingsMenu, type SettingsAccount } from '../preferences/SettingsMenu';
import type { Preferences } from '../preferences/preferences';
import { StageView, useWideScreen } from './StageView';
import type { Placement } from './showcase';

interface HomeProps {
  readonly initial: PlayerIdentity;
  /** The character already made in this world, if there is one (decision 0087). */
  readonly saved: PlayerIdentity | null;
  /** Who is signed in, shown back to them so they know it is the right account. */
  readonly accountName: string;
  readonly onSignOut: () => void;
  /**
   * Delete the saved character (decision 0108). Rejects when it could not be done.
   * Left out, there is no way to delete from here.
   */
  readonly onDeleteCharacter?: () => Promise<void>;
  /** Said once above the card, for example after a character has just been deleted. */
  readonly notice?: string | null;
  readonly onPlay: (identity: PlayerIdentity) => void;
  readonly initialPreferences: Preferences;
  readonly onSettingsChange: (preferences: Preferences) => void;
}

/** Where the character stands on the screen, with the card beside them or below (decision 0107). */
const MAKING: Record<'wide' | 'narrow', Placement> = {
  wide: { across: 0.3, feet: 0.15, share: 0.64 },
  narrow: { across: 0.5, feet: 0.66, share: 0.28 },
};
const WELCOMING: Record<'wide' | 'narrow', Placement> = {
  wide: { across: 0.5, feet: 0.3, share: 0.5 },
  narrow: { across: 0.5, feet: 0.36, share: 0.4 },
};

const STAGE_HINT = 'Drag to turn \u00b7 Click for a flourish';

/**
 * Shown before the game connects. The player's character stands in front of the
 * painted valley, in the game's own idle stance: drag to turn them, click for
 * a flourish. A player with no character in this world picks a name, a
 * character and a tint, once, and sees them change as they choose; a player who
 * has one is welcomed back to it and presses Enter World.
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
  onDeleteCharacter,
  notice = null,
  onPlay,
  initialPreferences,
  onSettingsChange,
}: HomeProps): React.JSX.Element {
  const [name, setName] = useState(initial.name);
  const [character, setCharacter] = useState<CharacterId>(initial.character);
  const [color, setColor] = useState<TintColorId>(initial.color);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Settings has Sign out here too, so it is in the same place everywhere. No waiting: nobody is in the world yet.
  const account: SettingsAccount = {
    waitSeconds: 0,
    secondsLeft: null,
    onSignOut,
    onCancelSignOut: () => undefined,
    deleteCharacter:
      saved !== null && onDeleteCharacter !== undefined
        ? { characterName: saved.name, onDelete: onDeleteCharacter }
        : undefined,
  };

  const wide = useWideScreen();
  const trimmed = sanitizePlayerName(name);
  const canPlay = isValidPlayerName(trimmed);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!canPlay) return;
    onPlay({ name: trimmed, character, color });
  };

  if (saved !== null) {
    const kind = CHARACTER_KINDS[saved.character].displayName;
    return (
      <>
        <form
          className="home-screen has-stage is-welcome"
          onSubmit={(event) => {
            event.preventDefault();
            onPlay(saved);
          }}
        >
          <PaintingBackdrop />
          <StageView
            look={{ character: saved.character, tint: TINT_COLORS[saved.color].hex }}
            placement={WELCOMING[wide ? 'wide' : 'narrow']}
            label={`${saved.name}, your ${kind}. Drag or use the arrow keys to turn them, click or press Space for a flourish.`}
          />
          <SettingsMenu
            initial={initialPreferences}
            onChange={onSettingsChange}
            account={account}
          />
          <header className="stage-header">
            <p className="home-kicker">Welcome back</p>
            <h1 className="home-title">Acorn &amp; Ash</h1>
          </header>
          <div className="home-card home-card-plate">
            <div className="home-saved" data-testid="saved-character">
              <span className="home-saved-name">{saved.name}</span>
              <span className="home-saved-kind">{kind}</span>
            </div>
            <button type="submit" className="home-play" autoFocus>
              Enter World
            </button>
            <p className="home-footnote stage-hint">{STAGE_HINT}</p>
            <AccountLine accountName={accountName} onSignOut={onSignOut} />
            {onDeleteCharacter !== undefined ? (
              <p className="home-footnote home-account">
                <button
                  type="button"
                  className="home-link"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete this character
                </button>
              </p>
            ) : null}
          </div>
        </form>
        {/* Outside the form, so nothing typed in it can ever count as pressing Enter World. */}
        {confirmingDelete && onDeleteCharacter !== undefined ? (
          <DeleteCharacterDialog
            characterName={saved.name}
            onDelete={onDeleteCharacter}
            onCancel={() => setConfirmingDelete(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <form className="home-screen has-stage" onSubmit={handleSubmit}>
      <PaintingBackdrop />
      <StageView
        look={{ character, tint: TINT_COLORS[color].hex }}
        placement={MAKING[wide ? 'wide' : 'narrow']}
        label={`${CHARACTER_KINDS[character].displayName}, the character you are choosing. Drag or use the arrow keys to turn them, click or press Space for a flourish.`}
      />
      <div
        className="stage-caption"
        style={{ left: `${MAKING[wide ? 'wide' : 'narrow'].across * 100}%` }}
        aria-hidden="true"
      >
        <span className="stage-caption-name">{trimmed === '' ? 'Your name' : trimmed}</span>
        <span className="stage-caption-kind">{CHARACTER_KINDS[character].displayName}</span>
        <span className="stage-hint">{STAGE_HINT}</span>
      </div>
      <SettingsMenu initial={initialPreferences} onChange={onSettingsChange} account={account} />
      <div className="home-card">
        {notice !== null ? (
          <p className="home-notice" role="status" data-testid="character-deleted-notice">
            {notice}
          </p>
        ) : null}
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
          Enter World
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
