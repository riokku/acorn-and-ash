import { useId, useState } from 'react';

import { ABANDONED_BUILD_SECONDS } from '@acorn/shared';

import { matchesCharacterName } from './delete-character';

/** What the Delete character buttons need: whose character it is, and what deleting does. */
export interface DeleteCharacter {
  readonly characterName: string;
  /** Deletes the character. Rejects when it could not, so the panel can say so and stay open. */
  readonly onDelete: () => Promise<void>;
}

/**
 * The "are you sure" for deleting a character (decision 0108): what is lost,
 * what lingers and for how long, and a box where the player has to type the
 * character's name. Nothing happens until the name matches and the red button
 * is pressed.
 *
 * Every button here is `type="button"` and Enter is handled by hand, because
 * the character screen wraps all of this in a form whose own button is
 * "Enter World". Pressing Enter in this box must never walk the player into
 * the world instead.
 */
export function DeleteCharacterPanel({
  characterName,
  onDelete,
  onCancel,
}: DeleteCharacter & { readonly onCancel: () => void }): React.JSX.Element {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputId = useId();
  const matches = matchesCharacterName(typed, characterName);

  const confirm = (): void => {
    if (!matches || working) return;
    setWorking(true);
    setFailed(false);
    onDelete().catch(() => {
      // Nothing was deleted, so the player can simply try again.
      setWorking(false);
      setFailed(true);
    });
  };

  return (
    <div className="delete-character" role="group" aria-label="Delete character">
      <p className="delete-character-warning">
        <strong>This can&rsquo;t be undone.</strong> {characterName} is gone for good: the pack,
        hunger, map, fish collection and home are all lost, and your next character starts with
        nothing.
      </p>
      <p className="delete-character-note">
        The cabin, campfires, fences and decorations you built stay standing but locked, so nobody
        can use or break them, and then disappear together after{' '}
        {Math.round(ABANDONED_BUILD_SECONDS / 60)} minutes.
      </p>
      <label className="delete-character-field" htmlFor={inputId}>
        <span>
          Type <strong>{characterName}</strong> to confirm
        </span>
        <input
          id={inputId}
          type="text"
          value={typed}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          // Only ever shown because the player asked, so typing can start straight away.
          autoFocus
          disabled={working}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            confirm();
          }}
        />
      </label>
      {failed ? (
        <p className="delete-character-error" role="alert">
          That didn&rsquo;t go through, so nothing was deleted. Check your connection and try again.
        </p>
      ) : null}
      <div className="delete-character-actions">
        <button
          type="button"
          className="delete-character-confirm"
          disabled={!matches || working}
          onClick={confirm}
        >
          {working ? 'Deleting…' : 'Delete forever'}
        </button>
        <button
          type="button"
          className="delete-character-cancel"
          disabled={working}
          onClick={onCancel}
        >
          Keep my character
        </button>
      </div>
    </div>
  );
}

/**
 * The same panel on a card of its own, for the character screen, where there is
 * no Settings menu open to hold it. Escape or a click outside keeps the character.
 */
export function DeleteCharacterDialog({
  characterName,
  onDelete,
  onCancel,
}: DeleteCharacter & { readonly onCancel: () => void }): React.JSX.Element {
  return (
    <div className="settings-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="settings-card delete-character-card"
        role="dialog"
        aria-modal="true"
        aria-label="Delete character"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') onCancel();
        }}
      >
        <div className="settings-header">
          <h2>Delete {characterName}?</h2>
        </div>
        <DeleteCharacterPanel
          characterName={characterName}
          onDelete={onDelete}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
