import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { withVerifiedSslMode } from "@/db/connection-url";
import {
  type DatabasePoolPurpose,
  getDatabasePoolOptions,
} from "@/db/pool-policy";
import { getServerEnv } from "@/lib/env";
import {
  accounts,
  appSettings,
  auditLogs,
  certificates,
  courseCompletions,
  coursePublications,
  courses,
  enrollmentEvents,
  enrollmentExpirationAdjustments,
  enrollmentGrants,
  enrollments,
  faqItems,
  learningAnalyticsDailyMetrics,
  learningAnalyticsEvents,
  learningAnalyticsPreferences,
  lessonComments,
  lessonProgress,
  lessons,
  lessonWatchProgress,
  modules,
  orders,
  outboxMessages,
  paymentReviews,
  profiles,
  publicCertificateRateLimits,
  refundRequests,
  sessions,
  users,
  verifications,
  webhookEvents,
} from "./schema";

const schema = {
  accounts,
  appSettings,
  auditLogs,
  certificates,
  courseCompletions,
  coursePublications,
  courses,
  enrollmentEvents,
  enrollmentExpirationAdjustments,
  enrollmentGrants,
  enrollments,
  faqItems,
  lessonComments,
  learningAnalyticsPreferences,
  learningAnalyticsEvents,
  learningAnalyticsDailyMetrics,
  lessonProgress,
  lessons,
  lessonWatchProgress,
  modules,
  outboxMessages,
  orders,
  paymentReviews,
  publicCertificateRateLimits,
  profiles,
  refundRequests,
  sessions,
  users,
  verifications,
  webhookEvents,
};

let pool: Pool | null = null;
let readinessPool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

const createPool = (purpose: DatabasePoolPurpose): Pool => {
  const { DATABASE_URL } = getServerEnv();

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return new Pool({
    connectionString: withVerifiedSslMode(DATABASE_URL),
    ...getDatabasePoolOptions(purpose),
  });
};

export const getPool = (): Pool => {
  if (!pool) {
    pool = createPool("application");
  }

  return pool;
};

export const getReadinessPool = (): Pool => {
  if (!readinessPool) {
    readinessPool = createPool("readiness");
  }

  return readinessPool;
};

export const getDb = () => {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }

  return db;
};
