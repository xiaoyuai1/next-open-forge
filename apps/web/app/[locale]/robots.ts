import type { MetadataRoute } from "next";
import { env } from "@/env";

const protocol = env.NEXT_PUBLIC_PROJECT_PRODUCTION_URL?.startsWith("https")
  ? "https"
  : "http";
const url = new URL(`${protocol}://${env.NEXT_PUBLIC_PROJECT_PRODUCTION_URL}`);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      userAgent: "*",
    },
    sitemap: new URL("/sitemap.xml", url.href).href,
  };
}
