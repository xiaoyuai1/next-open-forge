import { type Config, defineConfig } from "drizzle-kit";
import { keys } from "./keys";

export const drizzleConfig = {
  dbCredentials: {
    url: keys().DATABASE_URL,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./schemas",
} satisfies Config;

export default defineConfig(drizzleConfig);
