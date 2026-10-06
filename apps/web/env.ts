import { keys as core } from "@repo/next-config/keys";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  client: {},
  extends: [core()],
  runtimeEnv: {},
  server: {},
});
