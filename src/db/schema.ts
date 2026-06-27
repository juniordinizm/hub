import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tz = { withTimezone: true } as const;

export const timestamps = {
  createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", tz)
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
};

export const roleEnum = pgEnum("role", ["admin", "support", "student"]);
export const courseStatusEnum = pgEnum("course_status", [
  "draft",
  "active",
  "archived",
]);
export const videoProviderEnum = pgEnum("video_provider", [
  "panda",
  "jmvstream",
  "external",
]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "expired",
  "revoked",
]);
export const enrollmentGrantStatusEnum = pgEnum("enrollment_grant_status", [
  "active",
  "expired",
  "refunded",
  "disputed",
  "cancelled",
]);
export const enrollmentGrantSourceTypeEnum = pgEnum(
  "enrollment_grant_source_type",
  ["abacatepay_order"]
);
export const enrollmentAdjustmentTypeEnum = pgEnum(
  "enrollment_adjustment_type",
  ["extend_days", "extend_months", "set_exact_expiration", "reversal"]
);
export const enrollmentEventTypeEnum = pgEnum("enrollment_event_type", [
  "access_manual_block_removed",
  "access_manually_blocked",
  "payment_paid",
  "payment_refunded",
  "payment_disputed",
  "expiration_extended",
  "expiration_set",
  "expiration_adjustment_reversed",
  "projection_rebuilt",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "refunded",
  "disputed",
  "cancelled",
]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processed",
  "ignored",
  "failed",
]);
export const lessonCommentStatusEnum = pgEnum("lesson_comment_status", [
  "visible",
  "hidden",
]);
export const jmvstreamFolderTypeEnum = pgEnum("jmvstream_folder_type", [
  "course",
  "module",
]);
export const jmvstreamFolderStatusEnum = pgEnum("jmvstream_folder_status", [
  "active",
  "failed",
  "needs_review",
]);
export const jmvstreamUploadStatusEnum = pgEnum("jmvstream_upload_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
]);
export const jmvstreamDeleteStatusEnum = pgEnum("jmvstream_delete_status", [
  "none",
  "pending",
  "deleted",
  "failed",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", tz).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", tz),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", tz),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)]
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", tz).notNull(),
  ...timestamps,
});

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").default("student").notNull(),
    phone: text("phone"),
    invitedAt: timestamp("invited_at", tz),
    lastAccessAt: timestamp("last_access_at", tz),
    platformBlockedAt: timestamp("platform_blocked_at", tz),
    platformBlockedReason: text("platform_blocked_reason"),
    ...timestamps,
  },
  (table) => [index("profiles_role_idx").on(table.role)]
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    workloadHours: integer("workload_hours").default(0).notNull(),
    priceInCents: integer("price_in_cents").default(0).notNull(),
    thumbnailUrl: text("thumbnail_url"),
    coverImageJson: jsonb("cover_image_json"),
    paymentProviderProductId: text("payment_provider_product_id"),
    accessDurationMonths: integer("access_duration_months")
      .default(12)
      .notNull(),
    status: courseStatusEnum("status").default("draft").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "courses_access_duration_positive",
      sql`${table.accessDurationMonths} > 0`
    ),
    check(
      "courses_workload_hours_non_negative",
      sql`${table.workloadHours} >= 0`
    ),
    check(
      "courses_price_in_cents_non_negative",
      sql`${table.priceInCents} >= 0`
    ),
  ]
);

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
    status: courseStatusEnum("status").default("draft").notNull(),
    ...timestamps,
  },
  (table) => [
    index("modules_course_sort_idx").on(table.courseId, table.sortOrder),
    uniqueIndex("modules_course_sort_unique_idx").on(
      table.courseId,
      table.sortOrder
    ),
  ]
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    videoProvider: videoProviderEnum("video_provider"),
    videoExternalId: text("video_external_id"),
    videoEmbedUrl: text("video_embed_url"),
    thumbnailUrl: text("thumbnail_url"),
    contentJson: jsonb("content_json"),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    videoDurationSeconds: integer("video_duration_seconds")
      .default(0)
      .notNull(),
    textDurationSeconds: integer("text_duration_seconds").default(0).notNull(),
    textWordCount: integer("text_word_count").default(0).notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: courseStatusEnum("status").default("draft").notNull(),
    isPublished: boolean("is_published").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "lessons_duration_seconds_non_negative",
      sql`${table.durationSeconds} >= 0`
    ),
    check(
      "lessons_video_duration_seconds_non_negative",
      sql`${table.videoDurationSeconds} >= 0`
    ),
    check(
      "lessons_text_duration_seconds_non_negative",
      sql`${table.textDurationSeconds} >= 0`
    ),
    check(
      "lessons_text_word_count_non_negative",
      sql`${table.textWordCount} >= 0`
    ),
    index("lessons_module_sort_idx").on(table.moduleId, table.sortOrder),
    uniqueIndex("lessons_module_sort_unique_idx").on(
      table.moduleId,
      table.sortOrder
    ),
  ]
);

export const jmvstreamFolders = pgTable(
  "jmvstream_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => modules.id, {
      onDelete: "cascade",
    }),
    folderUuid: text("folder_uuid"),
    folderType: jmvstreamFolderTypeEnum("folder_type").notNull(),
    name: text("name").notNull(),
    parentFolderUuid: text("parent_folder_uuid"),
    status: jmvstreamFolderStatusEnum("status").default("active").notNull(),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("jmvstream_folders_folder_uuid_unique_idx").on(
      table.folderUuid
    ),
    uniqueIndex("jmvstream_folders_course_unique_idx")
      .on(table.courseId)
      .where(sql`${table.folderType} = 'course'`),
    uniqueIndex("jmvstream_folders_module_unique_idx")
      .on(table.moduleId)
      .where(sql`${table.moduleId} is not null`),
    index("jmvstream_folders_status_idx").on(table.status),
  ]
);

export const jmvstreamVideoAssets = pgTable(
  "jmvstream_video_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    moduleId: uuid("module_id").references(() => modules.id, {
      onDelete: "set null",
    }),
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    videoHash: text("video_hash").notNull(),
    galleryUuid: text("gallery_uuid"),
    filename: text("filename").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    objectName: text("object_name"),
    uploadId: text("upload_id"),
    jobId: text("job_id"),
    uploadStatus: jmvstreamUploadStatusEnum("upload_status")
      .default("processing")
      .notNull(),
    deleteStatus: jmvstreamDeleteStatusEnum("delete_status")
      .default("none")
      .notNull(),
    deleteAttempts: integer("delete_attempts").default(0).notNull(),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("jmvstream_video_assets_hash_unique_idx").on(table.videoHash),
    uniqueIndex("jmvstream_video_assets_active_lesson_unique_idx")
      .on(table.lessonId)
      .where(
        sql`${table.lessonId} is not null and ${table.deleteStatus} = 'none' and ${table.uploadStatus} in ('processing', 'ready')`
      ),
    index("jmvstream_video_assets_lesson_idx").on(table.lessonId),
    index("jmvstream_video_assets_delete_status_idx").on(table.deleteStatus),
  ]
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: enrollmentStatusEnum("status").default("active").notNull(),
    startsAt: timestamp("starts_at", tz).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", tz).notNull(),
    revokedAt: timestamp("revoked_at", tz),
    revokedReason: text("revoked_reason"),
    expiryWarning7dSentAt: timestamp("expiry_warning_7d_sent_at", tz),
    expiryWarning1dSentAt: timestamp("expiry_warning_1d_sent_at", tz),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("enrollments_user_course_unique_idx").on(
      table.userId,
      table.courseId
    ),
    index("enrollments_course_status_idx").on(table.courseId, table.status),
    index("enrollments_expires_at_idx").on(table.expiresAt),
  ]
);

export const enrollmentGrants = pgTable(
  "enrollment_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    sourceType: enrollmentGrantSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: enrollmentGrantStatusEnum("status").default("active").notNull(),
    startsAt: timestamp("starts_at", tz).notNull(),
    baseExpiresAt: timestamp("base_expires_at", tz).notNull(),
    effectiveExpiresAt: timestamp("effective_expires_at", tz).notNull(),
    revokedAt: timestamp("revoked_at", tz),
    revokedReason: text("revoked_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("enrollment_grants_source_unique_idx").on(
      table.sourceType,
      table.sourceId
    ),
    index("enrollment_grants_user_course_status_idx").on(
      table.userId,
      table.courseId,
      table.status
    ),
    index("enrollment_grants_effective_expires_at_idx").on(
      table.effectiveExpiresAt
    ),
    check(
      "enrollment_grants_effective_after_start",
      sql`${table.effectiveExpiresAt} > ${table.startsAt}`
    ),
  ]
);

export const enrollmentExpirationAdjustments = pgTable(
  "enrollment_expiration_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => enrollmentGrants.id, { onDelete: "cascade" }),
    adjustmentType: enrollmentAdjustmentTypeEnum("adjustment_type").notNull(),
    deltaDays: integer("delta_days"),
    deltaMonths: integer("delta_months"),
    previousExpiresAt: timestamp("previous_expires_at", tz).notNull(),
    newExpiresAt: timestamp("new_expires_at", tz).notNull(),
    reason: text("reason").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reversedAdjustmentId: uuid("reversed_adjustment_id").references(
      (): AnyPgColumn => enrollmentExpirationAdjustments.id,
      { onDelete: "set null" }
    ),
    ...timestamps,
  },
  (table) => [
    index("enrollment_adjustments_grant_created_idx").on(
      table.grantId,
      table.createdAt
    ),
    check(
      "enrollment_adjustments_reason_not_empty",
      sql`length(trim(${table.reason})) > 0`
    ),
  ]
);

export const enrollmentEvents = pgTable(
  "enrollment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: enrollmentEventTypeEnum("event_type").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "cascade",
    }),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
      onDelete: "set null",
    }),
    grantId: uuid("grant_id").references(() => enrollmentGrants.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (table) => [
    index("enrollment_events_user_course_created_idx").on(
      table.userId,
      table.courseId,
      table.createdAt
    ),
    index("enrollment_events_grant_idx").on(table.grantId),
  ]
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", tz).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lesson_progress_user_lesson_unique_idx").on(
      table.userId,
      table.lessonId
    ),
    index("lesson_progress_user_idx").on(table.userId),
  ]
);

export const lessonWatchProgress = pgTable(
  "lesson_watch_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    currentSeconds: integer("current_seconds").default(0).notNull(),
    maxPositionSeconds: integer("max_position_seconds").default(0).notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    watchedPercent: integer("watched_percent").default(0).notNull(),
    lastEventName: text("last_event_name"),
    lastEventAt: timestamp("last_event_at", tz).defaultNow().notNull(),
    completedByVideoAt: timestamp("completed_by_video_at", tz),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lesson_watch_progress_user_lesson_unique_idx").on(
      table.userId,
      table.lessonId
    ),
    index("lesson_watch_progress_user_idx").on(table.userId),
    index("lesson_watch_progress_lesson_idx").on(table.lessonId),
    check(
      "lesson_watch_progress_current_seconds_non_negative",
      sql`${table.currentSeconds} >= 0`
    ),
    check(
      "lesson_watch_progress_duration_seconds_non_negative",
      sql`${table.durationSeconds} >= 0`
    ),
    check(
      "lesson_watch_progress_max_position_seconds_non_negative",
      sql`${table.maxPositionSeconds} >= 0`
    ),
    check(
      "lesson_watch_progress_percent_bounds",
      sql`${table.watchedPercent} >= 0 and ${table.watchedPercent} <= 100`
    ),
  ]
);

export const lessonComments = pgTable(
  "lesson_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => lessonComments.id,
      { onDelete: "cascade" }
    ),
    body: text("body").notNull(),
    status: lessonCommentStatusEnum("status").default("visible").notNull(),
    hiddenByUserId: text("hidden_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    hiddenAt: timestamp("hidden_at", tz),
    ...timestamps,
  },
  (table) => [
    index("lesson_comments_lesson_created_idx").on(
      table.lessonId,
      table.createdAt
    ),
    index("lesson_comments_parent_created_idx").on(
      table.parentId,
      table.createdAt
    ),
    index("lesson_comments_author_idx").on(table.authorUserId),
  ]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id),
    provider: text("provider").default("abacatepay").notNull(),
    providerOrderId: text("provider_order_id").notNull(),
    externalId: text("external_id").notNull(),
    status: orderStatusEnum("status").default("pending").notNull(),
    amountInCents: integer("amount_in_cents").default(0).notNull(),
    accessDurationMonths: integer("access_duration_months"),
    paidAmountInCents: integer("paid_amount_in_cents"),
    paymentMethod: text("payment_method"),
    receiptUrl: text("receipt_url"),
    paidAt: timestamp("paid_at", tz),
    refundedAt: timestamp("refunded_at", tz),
    customerEmail: text("customer_email"),
    customerName: text("customer_name"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_provider_order_unique_idx").on(
      table.provider,
      table.providerOrderId
    ),
    uniqueIndex("orders_external_unique_idx").on(table.externalId),
    index("orders_course_status_idx").on(table.courseId, table.status),
    check(
      "orders_access_duration_positive",
      sql`${table.accessDurationMonths} is null or ${table.accessDurationMonths} > 0`
    ),
  ]
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").default("abacatepay").notNull(),
    eventKey: text("event_key").notNull(),
    eventName: text("event_name").notNull(),
    status: webhookStatusEnum("status").default("received").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", tz),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("webhook_events_provider_key_unique_idx").on(
      table.provider,
      table.eventKey
    ),
    index("webhook_events_status_idx").on(table.status),
  ]
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    studentNameSnapshot: text("student_name_snapshot").notNull(),
    courseTitleSnapshot: text("course_title_snapshot").notNull(),
    workloadHoursSnapshot: integer("workload_hours_snapshot")
      .default(0)
      .notNull(),
    issuedAt: timestamp("issued_at", tz).defaultNow().notNull(),
    pdfUrl: text("pdf_url"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("certificates_user_course_unique_idx").on(
      table.userId,
      table.courseId
    ),
  ]
);

export const faqItems = pgTable(
  "faq_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isPublished: boolean("is_published").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("faq_items_sort_idx").on(table.sortOrder)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
  ]
);

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  certificateSignerName: text("certificate_signer_name"),
  certificateSignerRole: text("certificate_signer_role"),
  ...timestamps,
});
