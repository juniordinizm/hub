import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { resolveRuntimeEnvironment } from "./src/lib/runtime-environment";
import { resolveSentryRelease } from "./src/lib/sentry-deployment";
import { getSentryOptions } from "./src/lib/sentry-options";

const runtimeEnvironment = resolveRuntimeEnvironment({
  CI: process.env.CI,
  E2E_TEST_MODE: process.env.E2E_TEST_MODE,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_TARGET_ENV: process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV,
});

if (runtimeEnvironment === "production") {
  init(
    getSentryOptions(
      process.env.NEXT_PUBLIC_SENTRY_DSN,
      runtimeEnvironment,
      resolveSentryRelease({
        NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      })
    )
  );
}

export const onRouterTransitionStart = captureRouterTransitionStart;
