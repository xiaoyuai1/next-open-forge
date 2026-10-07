import { type Config, defineConfig } from "drizzle-kit";

export const drizzleConfig = {
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./schemas",
} satisfies Config;

export default defineConfig(drizzleConfig);
