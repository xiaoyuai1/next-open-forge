import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_APP_URL: z.url(),
      NEXT_PUBLIC_PROJECT_PRODUCTION_URL: z.url().optional(),
      NEXT_PUBLIC_WEB_URL: z.url(),
    },
    runtimeEnv: {
      ANALYZE: process.env.ANALYZE,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_PROJECT_PRODUCTION_URL: process.env.PROJECT_PRODUCTION_URL,
      NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    },
    server: {
      ANALYZE: z.string().optional(),
      NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
    },
  });
