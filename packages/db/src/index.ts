import { env } from '@yapper/env/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

// Module-scope singleton: the server is a long-lived container process, not
// a per-request serverless function, so the connection is opened once and
// reused rather than re-established on every createDb() call.
const sql = postgres(env.DATABASE_URL || '');

export function createDb() {
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
// The `tx` param type inside `db.transaction(async (tx) => { ... })` — used
// by helpers that build query statements for either a plain db or a
// transaction, e.g. `buildPostInsertStatements`.
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
