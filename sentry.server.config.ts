import { init } from "@sentry/nextjs";
import { resolveSentryRelease } from "./src/lib/sentry-deployment";
import { getSentryOptions } from "./src/lib/sentry-options";

init(
  getSentryOptions(
    process.env.SENTRY_DSN,
    process.env.VERCEL_TARGET_ENV,
    resolveSentryRelease(process.env)
  )
);
