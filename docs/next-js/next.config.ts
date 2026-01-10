import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? (process.env.BASE_PATH || '') : '';

console.log("BASE_PATH", basePath)

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export' as const,
  basePath: basePath,
  trailingSlash: true,
  // assetPrefix: assetPrefix,
  images: {
    unoptimized: true,
  },
};

console.log('Current NODE_ENV:', process.env.NODE_ENV);

export default nextConfig;
