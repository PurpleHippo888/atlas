import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow maplibre-gl to be bundled properly
  webpack(config) {
    return config;
  },
};

export default nextConfig;
