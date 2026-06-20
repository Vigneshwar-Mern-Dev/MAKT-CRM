import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/apply/:token",
        destination: "/f/:token",
      },
      {
        source: "/atm-franchise/:token",
        destination: "/f/:token",
      },
    ];
  },
};

export default nextConfig;
