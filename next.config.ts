import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the Turbopack root to this directory so builds are independent of
    // whatever lockfiles or package.json files exist in parent folders.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
