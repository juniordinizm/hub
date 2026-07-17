import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { withVerifiedSslMode } from "@/db/connection-url";
import { getServerEnv } from "@/lib/env";
import {
  accounts,
  appSettings,
  auditLogs,
  certificates,
  courses,
  enrollmentEvents,
  enrollmentExpirationAdjustments,
  enrollmentGrants,
  enrollments,
  faqItems,
  lessonComments,
  lessonProgress,
  lessons,
  lessonWatchProgress,
  modules,
  orders,
  paymentReviews,
  privacyRequests,
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
  courses,
  enrollmentEvents,
  enrollmentExpirationAdjustments,
  enrollmentGrants,
  enrollments,
  faqItems,
  lessonComments,
  lessonProgress,
  lessons,
  lessonWatchProgress,
  modules,
  orders,
  paymentReviews,
  privacyRequests,
  publicCertificateRateLimits,
  profiles,
  refundRequests,
  sessions,
  users,
  verifications,
  webhookEvents,
};

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getPool = (): Pool => {
  if (pool) {
    return pool;
  }

  const { DATABASE_URL } = getServerEnv();

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  pool = new Pool({ connectionString: withVerifiedSslMode(DATABASE_URL) });
  return pool;
};

export const getDb = () => {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }

  return db;
};
