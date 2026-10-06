import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { keys } from "./keys";
import { schemas } from "./schemas";

export const database: NodePgDatabase<typeof schemas> = drizzle(
  keys().DATABASE_URL,
  { schema: schemas }
);
