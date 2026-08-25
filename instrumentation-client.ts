import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { resolveSentryRelease } from "./src/lib/sentry-deployment";
import { getSentryOptions } from "./src/lib/sentry-options";

init(
  getSentryOptions(
    process.env.NEXT_PUBLIC_SENTRY_DSN,
    process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV,
    resolveSentryRelease({
      NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    })
  )
);

export const onRouterTransitionStart = captureRouterTransitionStart;
