import type { NextConfig } from "next";
import { version } from './package.json';

const outputMode = process.env.NEXT_OUTPUT_MODE === "export" ? "export" : "standalone";

const nextConfig: NextConfig = {
  output: outputMode,
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
