import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Handle Monaco Editor in Next.js
    config.module.rules.push({
      test: /\.woff2?$/,
      type: "asset/resource",
    });

    return config;
  },
};

export default nextConfig;
