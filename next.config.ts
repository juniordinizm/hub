import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { getAllowedDevOrigins } from "./src/lib/allowed-dev-origins";

const allowedDevOrigins = getAllowedDevOrigins(process.env);
const publicMediaOrigin = process.env.R2_PUBLIC_BASE_URL
  ? new URL(process.env.R2_PUBLIC_BASE_URL)
  : null;

const nextConfig: NextConfig = {
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        hostname: "cdn.vod.br1.jmvstream.com",
        pathname: "/vod/**",
        protocol: "https",
      },
      {
        hostname: "*.r2.cloudflarestorage.com",
        pathname: "/**",
        protocol: "https",
      },
      ...(publicMediaOrigin
        ? [
            {
              hostname: publicMediaOrigin.hostname,
              pathname: "/**",
              protocol: publicMediaOrigin.protocol.replace(":", "") as
                | "http"
                | "https",
            },
          ]
        : []),
    ],
  },
  reactCompiler: true,
};

export default withSentryConfig(nextConfig, {
  org: "summit-studio-ij",
  project: "protear",
  ...(process.env.SENTRY_AUTH_TOKEN
    ? { authToken: process.env.SENTRY_AUTH_TOKEN }
    : {}),
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
