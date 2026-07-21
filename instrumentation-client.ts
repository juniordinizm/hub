import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { getSentryOptions } from "./src/lib/sentry-options";

init(getSentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));

export const onRouterTransitionStart = captureRouterTransitionStart;
