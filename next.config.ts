import type { NextConfig } from 'next';

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.NEXT_PUBLIC_BUILD_ID ||
  `b${Date.now()}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  serverExternalPackages: ['tesseract.js', 'unpdf'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
