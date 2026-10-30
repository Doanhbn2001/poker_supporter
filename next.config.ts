import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tournaments used to live under /sessions, then /cups; keep old links working.
  async redirects() {
    return [
      { source: "/sessions/:path*", destination: "/tournaments/:path*", permanent: true },
      { source: "/cups/:path*", destination: "/tournaments/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
