import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  redirects: async () => [
    {
      destination: "/docs",
      permanent: true,
      source: "/",
    },
  ],
};

export default withMDX(config);
