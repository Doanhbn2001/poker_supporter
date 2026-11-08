import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Poker Now hand logs are posted as text to a server action (importHandLog); a long session runs a few MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Tournaments used to live under /sessions, then /cups; keep old links working.
  async redirects() {
    return [
      { source: "/sessions/:path*", destination: "/tournaments/:path*", permanent: true },
      { source: "/cups/:path*", destination: "/tournaments/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
