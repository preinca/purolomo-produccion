import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.8.100", "*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.io"],
  serverExternalPackages: ["better-sqlite3", "xlsx"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
