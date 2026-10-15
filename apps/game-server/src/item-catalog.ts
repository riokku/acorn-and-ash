import { DurableObject } from 'cloudflare:workers';
import { parseItemOverrides, type CatalogState, type PublishedCatalog } from '@acorn/shared';

/** One catalogue per site/environment. Only authenticated web-worker RPC can mutate it. */
export class ItemCatalog extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql
      .exec(`CREATE TABLE IF NOT EXISTS catalogue (kind TEXT PRIMARY KEY, revision INTEGER NOT NULL, overrides TEXT NOT NULL);
      INSERT OR IGNORE INTO catalogue VALUES ('draft', 0, '{}');
      INSERT OR IGNORE INTO catalogue VALUES ('published', 0, '{}');
      CREATE TABLE IF NOT EXISTS catalogue_history (revision INTEGER PRIMARY KEY, published_at TEXT NOT NULL, actor TEXT NOT NULL, changed_items INTEGER NOT NULL, overrides TEXT NOT NULL);`);
  }
  private read(kind: string): PublishedCatalog {
    const row = this.ctx.storage.sql
      .exec<{ revision: number; overrides: string }>(
        'SELECT revision, overrides FROM catalogue WHERE kind = ?',
        kind,
      )
      .one();
    return { revision: row.revision, overrides: parseItemOverrides(JSON.parse(row.overrides)) };
  }
  published(): PublishedCatalog {
    return this.read('published');
  }
  adminState(): CatalogState {
    return {
      draft: this.read('draft'),
      published: this.published(),
      history: [
        ...this.ctx.storage.sql.exec<{
          revision: number;
          publishedAt: string;
          changedItems: number;
        }>(
          'SELECT revision, published_at AS publishedAt, changed_items AS changedItems FROM catalogue_history ORDER BY revision DESC LIMIT 20',
        ),
      ],
    };
  }
  saveDraft(revision: number, overrides: unknown, actor: string): CatalogState | null {
    const validated = parseItemOverrides(overrides);
    if (!actor) throw new Error('Missing actor');
    return this.ctx.storage.transactionSync(() => {
      if (this.read('draft').revision !== revision) return null;
      this.ctx.storage.sql.exec(
        "UPDATE catalogue SET revision = revision + 1, overrides = ? WHERE kind = 'draft'",
        JSON.stringify(validated),
      );
      return this.adminState();
    });
  }
  publish(draftRevision: number, publishedRevision: number, actor: string): CatalogState | null {
    if (!actor) throw new Error('Missing actor');
    return this.ctx.storage.transactionSync(() => {
      const draft = this.read('draft');
      const published = this.published();
      if (draft.revision !== draftRevision || published.revision !== publishedRevision) return null;
      const next = published.revision + 1;
      const overrides = JSON.stringify(draft.overrides);
      const ids = new Set([...Object.keys(draft.overrides), ...Object.keys(published.overrides)]);
      const changed = [...ids].filter(
        (id) =>
          JSON.stringify(draft.overrides[id as keyof typeof draft.overrides]) !==
          JSON.stringify(published.overrides[id as keyof typeof published.overrides]),
      ).length;
      this.ctx.storage.sql.exec(
        "UPDATE catalogue SET revision = ?, overrides = ? WHERE kind = 'published'",
        next,
        overrides,
      );
      this.ctx.storage.sql.exec(
        'INSERT INTO catalogue_history VALUES (?, ?, ?, ?, ?)',
        next,
        new Date().toISOString(),
        actor,
        changed,
        overrides,
      );
      return this.adminState();
    });
  }
}
