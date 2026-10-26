import {
  WORLD_RESET_CONFIRMATION_MS,
  type AdminWorldStatus,
  type WorldResetChallenge,
  type WorldResetResult,
} from '@acorn/shared';
interface ResetProof {
  token: string;
  actor: string;
  origin: string;
  worldId: string;
  expiresAt: number;
}
interface WorldSummary {
  players: number;
  savedCharacters: number;
  builtStructures: number;
  seed: number;
}
/** Only exposed through World RPC to the authenticated web Worker, never through fetch/WebSockets. */
export class WorldAdministration {
  epoch = 0;
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly namespace: Pick<DurableObjectNamespace, 'idFromName'>,
    private readonly summary: () => WorldSummary,
    private readonly clearMemory: () => void,
  ) {
    ctx.storage.sql
      .exec(`CREATE TABLE IF NOT EXISTS world_admin_control (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS world_admin_resets (id INTEGER PRIMARY KEY AUTOINCREMENT, reset_at TEXT NOT NULL, actor TEXT NOT NULL, characters INTEGER NOT NULL, structures INTEGER NOT NULL);`);
    const row = ctx.storage.sql
      .exec<{ value: string }>("SELECT value FROM world_admin_control WHERE key='epoch'")
      .toArray()[0];
    this.epoch = Number(row?.value ?? 0);
  }
  private checkWorld(worldId: string): void {
    if (
      !/^[a-z0-9][a-z0-9-]{2,40}$/.test(worldId) ||
      this.namespace.idFromName(worldId).toString() !== this.ctx.id.toString()
    )
      throw new Error('World identity mismatch');
  }
  inspect(worldId: string): AdminWorldStatus {
    this.checkWorld(worldId);
    const state = this.summary();
    return {
      worldId,
      ...state,
      canReset: state.players === 0 && this.ctx.getWebSockets().length === 0,
      history: this.ctx.storage.sql
        .exec<{ id: number; resetAt: string; characters: number; structures: number }>(
          'SELECT id, reset_at AS resetAt, characters, structures FROM world_admin_resets ORDER BY id DESC LIMIT 10',
        )
        .toArray(),
    };
  }
  invalidate(): void {
    this.ctx.storage.sql.exec("DELETE FROM world_admin_control WHERE key='pending-reset'");
  }
  prepare(worldId: string, actor: string, origin: string): WorldResetResult<WorldResetChallenge> {
    if (!actor || !origin) return { ok: false, error: 'Missing administrator identity' };
    const world = this.inspect(worldId);
    if (!world.canReset)
      return {
        ok: false,
        error:
          'Everyone must leave this world before it can be reset. Close all game tabs, then refresh.',
      };
    const proof: ResetProof = {
      token: crypto.randomUUID(),
      actor,
      origin,
      worldId,
      expiresAt: Date.now() + WORLD_RESET_CONFIRMATION_MS,
    };
    this.ctx.storage.sql.exec(
      "INSERT INTO world_admin_control VALUES ('pending-reset', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      JSON.stringify(proof),
    );
    return {
      ok: true,
      value: {
        token: proof.token,
        expiresAt: proof.expiresAt,
        confirmation: `RESET ${worldId}`,
        world,
      },
    };
  }
  reset(
    worldId: string,
    actor: string,
    origin: string,
    token: string,
    confirmation: string,
  ): WorldResetResult<AdminWorldStatus> {
    const world = this.inspect(worldId);
    if (!world.canReset)
      return {
        ok: false,
        error: 'Someone joined the world. Everyone must leave; refresh and review a new reset.',
      };
    const row = this.ctx.storage.sql
      .exec<{ value: string }>("SELECT value FROM world_admin_control WHERE key='pending-reset'")
      .toArray()[0];
    const proof: ResetProof | null = row ? JSON.parse(row.value) : null;
    if (
      !proof ||
      proof.token !== token ||
      proof.actor !== actor ||
      proof.origin !== origin ||
      proof.worldId !== worldId ||
      proof.expiresAt <= Date.now()
    )
      return {
        ok: false,
        error: 'This confirmation expired or the world was opened again. Review a new reset.',
      };
    if (confirmation !== `RESET ${worldId}`)
      return { ok: false, error: 'The typed world confirmation does not match.' };
    // Synchronous transaction: a connection cannot enter between the check and the wipe.
    const nextEpoch = this.epoch + 1;
    this.ctx.storage.transactionSync(() => {
      const sql = this.ctx.storage.sql;
      const keep = sql
        .exec<{ key: string; value: string }>(
          "SELECT key,value FROM world_meta WHERE key IN ('seed','staging-build-reset','item-catalog')",
        )
        .toArray();
      const tables = sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
        .toArray();
      for (const { name } of tables) {
        if (
          name.startsWith('sqlite_') ||
          name.startsWith('_cf_') ||
          name === 'world_admin_control' ||
          name === 'world_admin_resets'
        )
          continue;
        sql.exec(`DELETE FROM "${name.replaceAll('"', '""')}"`);
      }
      for (const { key, value } of keep)
        sql.exec('INSERT INTO world_meta (key,value) VALUES (?,?)', key, value);
      sql.exec("DELETE FROM world_admin_control WHERE key='pending-reset'");
      sql.exec(
        "INSERT INTO world_admin_control VALUES ('epoch', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        String(nextEpoch),
      );
      sql.exec(
        'INSERT INTO world_admin_resets (reset_at,actor,characters,structures) VALUES (?,?,?,?)',
        new Date().toISOString(),
        actor,
        world.savedCharacters,
        world.builtStructures,
      );
    });
    this.epoch = nextEpoch;
    this.clearMemory();
    return { ok: true, value: this.inspect(worldId) };
  }
}
