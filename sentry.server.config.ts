import { init } from "@sentry/nextjs";
import { getSentryOptions } from "./src/lib/sentry-options";

init(getSentryOptions(process.env.SENTRY_DSN));
