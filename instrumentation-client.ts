import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { getSentryOptions } from "./src/lib/sentry-options";

init(
  getSentryOptions(
    process.env.NEXT_PUBLIC_SENTRY_DSN,
    process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV
  )
);

export const onRouterTransitionStart = captureRouterTransitionStart;
