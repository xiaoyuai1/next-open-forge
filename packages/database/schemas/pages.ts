import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pages = sqliteTable("page", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
});
