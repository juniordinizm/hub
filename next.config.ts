import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { resolveR2ClientEndpoint } from "./src/features/storage/r2-endpoint";
import { getAllowedDevOrigins } from "./src/lib/allowed-dev-origins";
import { buildContentSecurityPolicy } from "./src/lib/content-security-policy";

const allowedDevOrigins = getAllowedDevOrigins(process.env);
const publicMediaOrigin = process.env.R2_PUBLIC_BASE_URL
  ? new URL(process.env.R2_PUBLIC_BASE_URL)
  : null;
const deploymentId = process.env.DEPLOYMENT_VERSION?.trim();
const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === "production";
const e2eObjectStorageOrigin = process.env.R2_ENDPOINT
  ? new URL(
      resolveR2ClientEndpoint({
        accountId: process.env.R2_ACCOUNT_ID ?? "e2e",
        e2eTestMode: process.env.E2E_TEST_MODE === "true",
        endpointOverride: process.env.R2_ENDPOINT,
      }).endpoint
    ).origin
  : null;
const contentSecurityPolicy = buildContentSecurityPolicy({
  additionalConnectOrigins: e2eObjectStorageOrigin
    ? [e2eObjectStorageOrigin]
    : [],
  isProduction,
});
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

const nextConfig: NextConfig = {
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  ...(deploymentId ? { deploymentId } : {}),
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
  headers: async () => [
    {
      headers: securityHeaders,
      source: "/(.*)",
    },
  ],
  ...(isVercel ? {} : { output: "standalone" }),
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
