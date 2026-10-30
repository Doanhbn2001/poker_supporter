import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cups used to live under /sessions; keep old links working.
  async redirects() {
    return [{ source: "/sessions/:path*", destination: "/cups/:path*", permanent: true }];
  },
};

export default nextConfig;
