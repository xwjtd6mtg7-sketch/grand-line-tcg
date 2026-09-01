/**
 * Kysely dialect for Better Auth over the local embedded PGLite instance
 * (used only when `DATABASE_URL` is unset — local/dev). Lazy: resolves the
 * client on first connection so migrations can finish first.
 *
 * Ported from a TanStack Start prototype of this backend — kept dependency-free
 * of any framework, plain Kysely + PGLite.
 */
import {
  CompiledQuery,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";

/** Factory: `pgliteDialect(() => getPglite())`. */
export function pgliteDialect(getClient) {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new LazyPGliteDriver(getClient),
    createQueryCompiler: () => new PostgresQueryCompiler(),
    createIntrospector: (db) => new PostgresIntrospector(db),
  };
}

class LazyPGliteDriver {
  constructor(getClient) {
    this.getClient = getClient;
    this.client = undefined;
    this.connection = undefined;
    this.queue = [];
  }

  async init() {
    this.client = await this.getClient();
  }

  async acquireConnection() {
    if (this.client === undefined) this.client = await this.getClient();
    if (this.connection !== undefined) {
      return new Promise((resolve) => this.queue.push(resolve));
    }
    this.connection = new PGliteConnection(this.client);
    return this.connection;
  }

  async releaseConnection(connection) {
    if (connection !== this.connection) throw new Error("Invalid connection");
    const next = this.queue.shift();
    if (next === undefined) {
      this.connection = undefined;
      return;
    }
    next(this.connection);
  }

  async beginTransaction(conn, settings) {
    if (settings.isolationLevel) {
      await conn.executeQuery(CompiledQuery.raw(`start transaction isolation level ${settings.isolationLevel}`));
    } else {
      await conn.executeQuery(CompiledQuery.raw("begin"));
    }
  }

  async commitTransaction(conn) {
    await conn.executeQuery(CompiledQuery.raw("commit"));
  }

  async rollbackTransaction(conn) {
    await conn.executeQuery(CompiledQuery.raw("rollback"));
  }

  async destroy() {
    // Don't close the shared getPglite() singleton — just drop our handle.
    this.client = undefined;
    this.connection = undefined;
    this.queue = [];
  }
}

class PGliteConnection {
  constructor(client) {
    this.client = client;
  }

  async executeQuery(compiledQuery) {
    const result = await this.client.query(compiledQuery.sql, [...compiledQuery.parameters]);
    if (result.affectedRows) {
      return { numAffectedRows: BigInt(result.affectedRows), rows: result.rows };
    }
    return { rows: result.rows };
  }

  async *streamQuery(compiledQuery, chunkSize) {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("chunkSize must be a positive integer");
    }
    const result = await this.client.query(compiledQuery.sql, [...compiledQuery.parameters]);
    for (let i = 0; i < result.rows.length; i += chunkSize) {
      yield { rows: result.rows.slice(i, i + chunkSize) };
    }
  }
}
