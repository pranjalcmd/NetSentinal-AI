import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev proxy: the frontend calls same-origin /api/* and Next forwards to the
  // FastAPI backend, so no CORS setup is needed in development.
  async rewrites() {
    const target = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
