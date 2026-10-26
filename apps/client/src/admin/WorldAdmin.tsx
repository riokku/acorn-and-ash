import { useRef, useState, useEffect } from 'react';
import type { AdminWorldStatus, WorldResetChallenge } from '@acorn/shared';
async function request<T>(world: string, action?: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/admin/worlds/${encodeURIComponent(world)}${action ? `/${action}` : ''}`,
    {
      credentials: 'same-origin',
      cache: 'no-store',
      ...(action
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
          }
        : {}),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Could not reach this world');
  return result;
}
export function WorldAdmin() {
  const [id, setId] = useState('home-clearing');
  const [world, setWorld] = useState<AdminWorldStatus | null>(null);
  const [proof, setProof] = useState<WorldResetChallenge | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (proof) dialog.current?.showModal();
    else dialog.current?.close();
  }, [proof]);
  const cancel = () => {
    if (!busy) {
      setProof(null);
      setConfirmation('');
      setUnderstood(false);
    }
  };
  async function inspect() {
    setBusy(true);
    setError('');
    setNotice('');
    setWorld(null);
    try {
      setWorld(await request<AdminWorldStatus>(id));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not inspect world');
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    if (!world) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await request<WorldResetChallenge>(world.worldId, 'prepare-reset');
      setWorld(next.world);
      setConfirmation('');
      setUnderstood(false);
      setProof(next);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not prepare reset');
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!proof || confirmation !== proof.confirmation || !understood || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await request<AdminWorldStatus>(proof.world.worldId, 'reset', {
        token: proof.token,
        confirmation,
      });
      setWorld(next);
      setNotice(`${next.worldId} was reset. Its next visit starts fresh.`);
    } catch (error) {
      setError(
        `${error instanceof Error ? error.message : 'The reset result could not be confirmed.'} Refresh world status and check reset history before trying again.`,
      );
    } finally {
      setProof(null);
      setConfirmation('');
      setUnderstood(false);
      setBusy(false);
    }
  }
  return (
    <main className="world-administration">
      <header>
        <div>
          <p className="eyebrow">
            Acorn &amp; Ash <span>Private administration</span>
          </p>
          <h1>World management</h1>
          <p>Inspect one world, then review a full fresh start.</p>
        </div>
        <a className="back" href="/">
          ← Back to game
        </a>
      </header>
      <p className="admin-site">
        Site: <strong>{window.location.host}</strong>
      </p>
      <form
        className="world-lookup"
        onSubmit={(event) => {
          event.preventDefault();
          void inspect();
        }}
      >
        <label>
          World ID
          <input
            value={id}
            onChange={(event) => {
              setId(event.target.value);
              setWorld(null);
              setNotice('');
            }}
            disabled={busy}
            pattern="[a-z0-9][a-z0-9-]{2,40}"
            required
            autoComplete="off"
          />
        </label>
        <button disabled={busy}>{busy ? 'Working…' : 'Inspect world'}</button>
      </form>
      <p className="hint">
        The main world is home-clearing. Resetting affects this site and selected world only.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {world && (
        <>
          <section className="world-summary" aria-label="World status">
            <h2>{world.worldId}</h2>
            <dl>
              <div>
                <dt>Connected players</dt>
                <dd>{world.players}</dd>
              </div>
              <div>
                <dt>Saved characters</dt>
                <dd>{world.savedCharacters}</dd>
              </div>
              <div>
                <dt>Placed structures</dt>
                <dd>{world.builtStructures}</dd>
              </div>
              <div>
                <dt>Map seed</dt>
                <dd>{world.seed}</dd>
              </div>
            </dl>
          </section>
          <section className="world-danger" aria-label="Reset world">
            <h2>Full world reset</h2>
            <p>
              Erases this world’s characters, inventories, equipment, buildings, storage, terrain
              edits, loot and creature progress. Accounts and the site-wide item catalogue stay
              intact. The same map seed rebuilds the original landscape.
            </p>
            <p>
              Everyone must leave first. Close all game tabs for this world, including your own,
              then inspect it again.
            </p>
            <button
              className="danger"
              disabled={busy || !world.canReset}
              onClick={() => void prepare()}
            >
              Review full reset
            </button>
            {!world.canReset && <p>Reset unavailable while game connections remain.</p>}
          </section>
          <section className="reset-history" aria-label="Reset history">
            <h2>Reset history</h2>
            {world.history.length === 0 ? (
              <p>No recorded resets.</p>
            ) : (
              <ul>
                {world.history.map((record) => (
                  <li key={record.id}>
                    <time dateTime={record.resetAt}>
                      {new Date(record.resetAt).toLocaleString()}
                    </time>{' '}
                    · {record.characters} characters · {record.structures} structures
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="world-reset-title"
        onCancel={(event) => {
          event.preventDefault();
          cancel();
        }}
      >
        {proof && (
          <>
            <h2 id="world-reset-title">Reset {proof.world.worldId}?</h2>
            <p>
              Site: <strong>{window.location.host}</strong>
            </p>
            <p>
              This permanently erases all game progress in <strong>{proof.world.worldId}</strong>,
              including {proof.world.savedCharacters} saved characters and{' '}
              {proof.world.builtStructures} structures. There is no undo.
            </p>
            <label className="reset-acknowledgement">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                disabled={busy}
              />
              I understand that all progress in this world will be erased.
            </label>
            <label>
              Type <strong>{proof.confirmation}</strong> to confirm
              <input
                aria-label="World reset confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
            </label>
            <p className="hint">
              Confirmation expires in two minutes. A new game connection cancels it.
            </p>
            <div className="actions">
              <button type="button" disabled={busy} onClick={cancel}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy || !understood || confirmation !== proof.confirmation}
                onClick={() => void reset()}
              >
                {busy ? 'Resetting…' : 'Permanently reset this world'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
