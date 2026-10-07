import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "0ce2869905292483d658d486a6e31a3c",
  worker: defineWorker({
    name: "forge-docs",
    domains: ["forge-docs.3webweb.com"],
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-07",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      VINEXT_KV_CACHE: bindings.kv(),
      IMAGES: bindings.images(),
    },
  }),
});
