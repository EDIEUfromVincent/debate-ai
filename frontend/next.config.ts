import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
