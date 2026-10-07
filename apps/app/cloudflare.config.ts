import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersResponseStoreServiceBindingConfig } from "@vinext/cloudflare/cache/config";

const responseStore = await createWorkersResponseStoreServiceBindingConfig({
  worker: {
    name: "forge-response-store",
    compatibilityDate: "2026-10-06",
    compatibilityFlags: ["nodejs_compat"],
  },
  bucket: "forge-response-store-cache-bodies",
});

export const responseStoreServiceBinding = responseStore.serviceBindingWorker;

export default defineConfig({
  accountId: "0ce2869905292483d658d486a6e31a3c",
  worker: defineWorker({
    ...responseStore.applicationWorker,
    name: "forge",
    domains: ["forge.3webweb.com"],
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-06",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ...responseStore.applicationWorker.env,
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      DB: bindings.d1({ name: "forge-db" }),
      BETTER_AUTH_SECRET: bindings.secret(),
      NEXT_PUBLIC_APP_URL: bindings.text("https://forge.3webweb.com"),
      NEXT_PUBLIC_WEB_URL: bindings.text("https://forge.3webweb.com"),
    },
  }),
});
