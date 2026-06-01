import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native modules out of the server bundle (loaded at runtime instead).
  serverExternalPackages: ["better-sqlite3", "sqlite-vec"],
};

export default nextConfig;
