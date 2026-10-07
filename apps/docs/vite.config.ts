import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import { fumadocsMdx } from "fumadocs-mdx/vite";

export default defineConfig({
  plugins: [
    fumadocsMdx(),
    vinext({
      cache: { data: kvDataAdapter() },
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
