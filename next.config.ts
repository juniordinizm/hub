import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import {
  resolveR2BucketOrigin,
  resolveR2ClientEndpoint,
} from "./src/features/storage/r2-endpoint";
import { getAllowedDevOrigins } from "./src/lib/allowed-dev-origins";
import { buildContentSecurityPolicy } from "./src/lib/content-security-policy";
import { resolveSentryBuildConfiguration } from "./src/lib/sentry-deployment";
import { getStagingPresentation } from "./src/lib/staging-presentation";

const allowedDevOrigins = getAllowedDevOrigins(process.env);
const stagingPresentation = getStagingPresentation(process.env);
const publicMediaOrigin = process.env.R2_PUBLIC_BASE_URL
  ? new URL(process.env.R2_PUBLIC_BASE_URL)
  : null;
const deploymentId = process.env.DEPLOYMENT_VERSION?.trim();
const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === "production";
const isE2eTest = process.env.E2E_TEST_MODE === "true";
const sentryAuthToken = isE2eTest ? "" : process.env.SENTRY_AUTH_TOKEN;
const sentryBuildConfiguration = resolveSentryBuildConfiguration({
  ...process.env,
  SENTRY_AUTH_TOKEN: isProduction && !isE2eTest ? sentryAuthToken : undefined,
});
const e2eObjectStorageOrigin = process.env.R2_ENDPOINT
  ? new URL(
      resolveR2ClientEndpoint({
        accountId: process.env.R2_ACCOUNT_ID ?? "e2e",
        e2eTestMode: process.env.E2E_TEST_MODE === "true",
        endpointOverride: process.env.R2_ENDPOINT,
      }).endpoint
    ).origin
  : null;
const r2BucketOrigin = resolveR2BucketOrigin({
  accountId: process.env.R2_ACCOUNT_ID,
  bucketName: process.env.R2_BUCKET_NAME,
});
const contentSecurityPolicy = buildContentSecurityPolicy({
  additionalConnectOrigins: [
    ...(r2BucketOrigin ? [r2BucketOrigin] : []),
    ...(e2eObjectStorageOrigin ? [e2eObjectStorageOrigin] : []),
  ],
  isProduction,
});
const publicCertificatePdfContentSecurityPolicy = contentSecurityPolicy.replace(
  "frame-ancestors 'none'",
  "frame-ancestors 'self'"
);
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
  ...stagingPresentation.headers,
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
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/sharp/**/*",
      "node_modules/@img/sharp-*/**/*",
      "public/fonts/certificates/**/*",
    ],
  },
  headers: async () => [
    {
      headers: securityHeaders,
      source: "/(.*)",
    },
    {
      headers: [
        {
          key: "Content-Security-Policy",
          value: publicCertificatePdfContentSecurityPolicy,
        },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
      source: "/certificados/:code/pdf",
    },
  ],
  ...(isVercel ? {} : { output: "standalone" }),
  ...(sentryBuildConfiguration.release
    ? {
        env: {
          NEXT_PUBLIC_SENTRY_RELEASE: sentryBuildConfiguration.release,
        },
      }
    : {}),
  reactCompiler: true,
  serverExternalPackages: ["pdfkit"],
};

export default withSentryConfig(nextConfig, {
  ...(sentryBuildConfiguration.org
    ? { org: sentryBuildConfiguration.org }
    : {}),
  ...(sentryBuildConfiguration.project
    ? { project: sentryBuildConfiguration.project }
    : {}),
  ...(sentryAuthToken === undefined ? {} : { authToken: sentryAuthToken }),
  ...(sentryBuildConfiguration.release
    ? { release: { name: sentryBuildConfiguration.release } }
    : {}),
  silent: !process.env.CI,
  useRunAfterProductionCompileHook: true,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
    disable: !sentryBuildConfiguration.uploadSourceMaps,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
