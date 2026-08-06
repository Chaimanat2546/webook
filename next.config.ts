import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; connect-src 'self' https://*.supabase.co; frame-src 'self' blob:; worker-src 'self' blob:",
        },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    }];
  },
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
