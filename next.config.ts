import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack(config) {
    const baseUiArrowMiddlewarePath = path.resolve(process.cwd(), "lib/base-ui-arrow-middleware.ts");

    config.resolve.alias = {
      ...config.resolve.alias,
      "../floating-ui-react/middleware/arrow": baseUiArrowMiddlewarePath,
      "../floating-ui-react/middleware/arrow.mjs": baseUiArrowMiddlewarePath,
    };

    return config;
  },
};

export default nextConfig;
