import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the root to this project directory so Turbopack
    // doesn't get confused by the parent repo's package-lock.json
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
