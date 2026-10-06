import "server-only";
import { PostHog } from "posthog-node";
import { keys } from "./keys";

export const product = new PostHog(keys().NEXT_PUBLIC_POSTHOG_KEY, {
  flushAt: 1,
  flushInterval: 0,
  host: keys().NEXT_PUBLIC_POSTHOG_HOST,
});
