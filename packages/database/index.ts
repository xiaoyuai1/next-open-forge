import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { schemas } from "./schemas";

export type Database = DrizzleD1Database<typeof schemas>;

/**
 * Create a Drizzle client bound to the Worker's D1 binding (`env.DB`).
 *
 * A fresh client is created per call so the binding is always read from the
 * current request context — never captured at module scope.
 */
export function getDatabase(): Database {
  return drizzle(env.DB, { schema: schemas });
}
