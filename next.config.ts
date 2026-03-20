import type { NextConfig } from "next";
import { version } from './package.json';

const nextConfig: NextConfig = {
  output: 'export',
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.postimg.cc',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
