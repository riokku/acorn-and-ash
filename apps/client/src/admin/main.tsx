import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ITEM_ORDER,
  ITEM_RARITIES,
  BONUS_LIMITS,
  allowedBonuses,
  catalogItem,
  type CatalogState,
  type CatalogItem,
  type EquipmentBonus,
  type ItemId,
  type ItemOverrides,
} from '@acorn/shared';
import './style.css';
import { ItemModelPreview } from './ItemModelPreview';

const LABELS = {
  power: 'Attack power (%)',
  protection: 'Protection (%)',
  vitality: 'Extra maximum health',
  warmth: 'Warmth',
};
async function request(path: string, body?: unknown): Promise<CatalogState> {
  const response = await fetch(`/api/admin/items${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Could not reach the item catalogue');
  return value;
}
function changes(a: ItemOverrides, b: ItemOverrides): ItemId[] {
  return ITEM_ORDER.filter(
    (id) => JSON.stringify(catalogItem(id, a)) !== JSON.stringify(catalogItem(id, b)),
  );
}
const FIELD_LABELS: Record<keyof CatalogItem, string> = {
  displayName: 'Name',
  pluralName: 'Plural name',
  description: 'Description',
  rarity: 'Rarity',
  bonuses: 'Equipment bonuses',
};
function reviewValue(value: CatalogItem[keyof CatalogItem]): string {
  if (typeof value === 'string') return value;
  return (
    (Object.keys(LABELS) as (keyof EquipmentBonus)[])
      .filter((stat) => value[stat] !== undefined)
      .map((stat) => `${LABELS[stat]} +${value[stat]}`)
      .join(' · ') || 'No bonuses'
  );
}
function Editor(): React.JSX.Element {
  const [state, setState] = useState<CatalogState | null>(null);
  const [draft, setDraft] = useState<ItemOverrides>({});
  const [selected, setSelected] = useState<ItemId>('axe');
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty = state !== null && changes(draft, state.draft.overrides).length > 0;
  const pending = state ? changes(state.draft.overrides, state.published.overrides) : [];
  const item = catalogItem(selected, draft);
  const defaults = catalogItem(selected);
  function accept(next: CatalogState) {
    setState(next);
    setDraft(next.draft.overrides);
  }
  useEffect(() => {
    let active = true;
    request('')
      .then((next) => {
        if (active) accept(next);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  useEffect(() => {
    if (review) dialog.current?.showModal();
    else dialog.current?.close();
  }, [review]);
  function edit<K extends keyof CatalogItem>(key: K, value: CatalogItem[K]) {
    setDraft((previous) => {
      const next = { ...previous, [selected]: { ...previous[selected], [key]: value } };
      if (JSON.stringify(value) === JSON.stringify(defaults[key])) delete next[selected]![key];
      if (!Object.keys(next[selected]!).length) delete next[selected];
      return next;
    });
    setNotice('');
  }
  async function save() {
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      accept(await request('/draft', { draftRevision: state.draft.revision, overrides: draft }));
      setNotice('Draft saved. Live items have not changed.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!state || dirty) return;
    setBusy(true);
    setError('');
    try {
      const next = await request('/publish', {
        draftRevision: state.draft.revision,
        publishedRevision: state.published.revision,
      });
      accept(next);
      setReview(false);
      setNotice(
        `Version ${next.published.revision} published. Connected worlds update within 15 seconds.`,
      );
    } catch (e) {
      setError((e as Error).message);
      setReview(false);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    if (dirty && !window.confirm('Discard your unsaved edits and load the latest saved draft?'))
      return;
    setBusy(true);
    try {
      accept(await request(''));
      setError('');
      setNotice('Latest draft loaded.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = ITEM_ORDER.filter((id) => {
    const view = catalogItem(id, draft);
    return (
      (rarity === 'all' || view.rarity === rarity) &&
      `${id} ${view.displayName} ${view.description}`.toLowerCase().includes(query.toLowerCase())
    );
  });
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">
            Acorn &amp; Ash <span>Private editor</span>
          </p>
          <h1>Item catalogue</h1>
          <p>Shape the finds, tools and clothing in your world.</p>
        </div>
        <a className="back" href="/">
          ← Back to game
        </a>
      </header>
      <div className="toolbar">
        <div>
          <strong>{state ? `Live version ${state.published.revision}` : 'Connecting…'}</strong>
          <span className="save-state">
            {dirty
              ? 'Unsaved edits'
              : pending.length
                ? `${pending.length} saved draft change${pending.length === 1 ? '' : 's'}`
                : 'All changes published'}
          </span>
        </div>
        <div className="actions">
          <button onClick={reload} disabled={busy}>
            Reload draft
          </button>
          <button
            className="primary"
            onClick={() => setReview(true)}
            disabled={busy || dirty || !pending.length}
          >
            Review &amp; publish
          </button>
        </div>
      </div>
      {error && (
        <p className="message error" role="alert">
          {error} {state && 'Your unsaved edits are kept on this page.'}
        </p>
      )}
      {notice && (
        <p className="message success" role="status">
          {notice}
        </p>
      )}
      {state && (
        <div className="workspace">
          <aside>
            <label className="search">
              Find an item
              <input
                type="search"
                placeholder="Search names, IDs, descriptions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Rarity
              <select
                aria-label="Filter by rarity"
                value={rarity}
                onChange={(e) => setRarity(e.target.value)}
              >
                <option value="all">All rarities</option>
                {ITEM_RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="clear-filters"
              disabled={query === '' && rarity === 'all'}
              onClick={() => {
                setQuery('');
                setRarity('all');
              }}
            >
              Clear filters
            </button>
            <p className="list-count">
              {visible.length} of {ITEM_ORDER.length} items
            </p>
            <nav aria-label="Items">
              {visible.map((id) => {
                const view = catalogItem(id, draft);
                return (
                  <button
                    key={id}
                    aria-current={id === selected ? 'true' : undefined}
                    onClick={() => setSelected(id)}
                  >
                    <span>{view.displayName}</span>
                    <small>
                      {id}
                      {changes(draft, state.published.overrides).includes(id) ? ' · edited' : ''}
                    </small>
                  </button>
                );
              })}
              {!visible.length && <p>No matching items.</p>}
            </nav>
          </aside>
          <section className="edit-panel" aria-labelledby="item-heading">
            <div className="item-heading">
              <div>
                <p className="eyebrow">{selected}</p>
                <h2 id="item-heading">{item.displayName}</h2>
              </div>
              <span className={`rarity ${item.rarity}`}>{item.rarity}</span>
            </div>
            <ItemModelPreview item={selected} name={item.displayName} />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <fieldset disabled={busy}>
                <legend className="sr-only">Edit item</legend>
                <div className="field-grid">
                  <label>
                    Name
                    <input
                      maxLength={80}
                      required
                      value={item.displayName}
                      onChange={(e) => edit('displayName', e.target.value)}
                    />
                  </label>
                  <label>
                    Plural name
                    <input
                      maxLength={80}
                      required
                      value={item.pluralName}
                      onChange={(e) => edit('pluralName', e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    rows={4}
                    maxLength={1000}
                    required
                    value={item.description}
                    onChange={(e) => edit('description', e.target.value)}
                  />
                </label>
                <label>
                  Rarity
                  <select
                    aria-label="Item rarity"
                    value={item.rarity}
                    onChange={(e) => edit('rarity', e.target.value as CatalogItem['rarity'])}
                  >
                    {ITEM_RARITIES.map((r) => (
                      <option value={r} key={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="hint">
                  Rarity labels the item’s tier. It does not change drop chances.
                </p>
                {allowedBonuses(selected).length > 0 && (
                  <>
                    <h3>Equipment bonuses</h3>
                    <div className="field-grid">
                      {allowedBonuses(selected).map((stat) => (
                        <label key={stat}>
                          {LABELS[stat]}
                          <input
                            type="number"
                            min={0}
                            max={BONUS_LIMITS[stat]}
                            step={1}
                            required
                            value={item.bonuses[stat] ?? 0}
                            onChange={(e) =>
                              edit('bonuses', {
                                ...item.bonuses,
                                [stat]: e.target.value === '' ? NaN : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <p className="hint">
                      Attack power applies only in the active main hand. Other bonuses apply while
                      worn. Character totals cap at 40% protection, 150 health and 100 warmth.
                      Publishing never heals a player.
                    </p>
                  </>
                )}
                <div className="form-footer">
                  <button type="submit" className="primary" disabled={!dirty}>
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={!draft[selected]}
                    onClick={() => {
                      setDraft((previous) => {
                        const next = { ...previous };
                        delete next[selected];
                        return next;
                      });
                      setNotice('Defaults restored in this draft. Save, then publish to apply.');
                    }}
                  >
                    Restore item defaults
                  </button>
                </div>
              </fieldset>
            </form>
            <div className="item-preview">
              <p className="eyebrow">Player-facing preview</p>
              <h3>
                {item.displayName} <span className={`rarity ${item.rarity}`}>{item.rarity}</span>
              </h3>
              <p>{item.description}</p>
              <div className="bonus-preview">
                {allowedBonuses(selected)
                  .filter((stat) => (item.bonuses[stat] ?? 0) > 0)
                  .map((stat) => (
                    <span key={stat}>
                      {LABELS[stat]} +{item.bonuses[stat]}
                    </span>
                  ))}
              </div>
            </div>
          </section>
        </div>
      )}
      {state && (
        <footer>
          <h3>Publication history</h3>
          <p>
            Drafts are private. Published items apply to every world on this site. Item IDs, recipes
            and saved inventory stay intact.
          </p>
          {state.history.length ? (
            <ul>
              {state.history.map((h) => (
                <li key={h.revision}>
                  Version {h.revision} · {new Date(h.publishedAt).toLocaleString()} ·{' '}
                  {h.changedItems} item{h.changedItems === 1 ? '' : 's'} changed
                </li>
              ))}
            </ul>
          ) : (
            <p>No changes published yet.</p>
          )}
        </footer>
      )}
      <dialog
        ref={dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setReview(false);
        }}
      >
        <h2>
          Publish {pending.length} item change{pending.length === 1 ? '' : 's'}?
        </h2>
        <p>
          This updates all worlds on this site. Players already connected receive the new items
          within 15 seconds.
        </p>
        <div className="review-list">
          {pending.map((id) => {
            const before = catalogItem(id, state!.published.overrides);
            const after = catalogItem(id, state!.draft.overrides);
            return (
              <article key={id}>
                <h3>
                  {after.displayName} <small>{id}</small>
                </h3>
                {(Object.keys(after) as (keyof CatalogItem)[])
                  .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
                  .map((key) => (
                    <p key={key}>
                      <strong>{FIELD_LABELS[key]}</strong>
                      <del>{reviewValue(before[key])}</del>
                      <ins>{reviewValue(after[key])}</ins>
                    </p>
                  ))}
              </article>
            );
          })}
        </div>
        <div className="actions">
          <button disabled={busy} onClick={() => setReview(false)}>
            Keep draft
          </button>
          <button className="primary" disabled={busy} onClick={publish}>
            {busy ? 'Publishing…' : 'Publish site-wide'}
          </button>
        </div>
      </dialog>
    </main>
  );
}
createRoot(document.getElementById('admin')!).render(<Editor />);
