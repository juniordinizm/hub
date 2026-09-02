import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
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
export const courseCatalogVisibilityEnum = pgEnum("course_catalog_visibility", [
  "listed",
  "hidden",
]);
export const courseSalesStatusEnum = pgEnum("course_sales_status", [
  "open",
  "closed",
]);
export const coursePublicationStatusEnum = pgEnum("course_publication_status", [
  "draft",
  "published",
  "retired",
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
  ["paid_order", "manual"]
);
export const enrollmentAdjustmentTypeEnum = pgEnum(
  "enrollment_adjustment_type",
  ["extend_days", "extend_months", "set_exact_expiration", "reversal"]
);
export const enrollmentEventTypeEnum = pgEnum("enrollment_event_type", [
  "access_manual_block_removed",
  "access_manually_blocked",
  "manual_access_granted",
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
export const buyerIdentityStatusEnum = pgEnum("buyer_identity_status", [
  "pending",
  "resolved",
  "review_required",
]);
export const checkoutStatusEnum = pgEnum("checkout_status", [
  "pending",
  "creating",
  "active",
  "failed",
  "uncertain",
  "cancelled",
  "expired",
]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processing",
  "processed",
  "ignored",
  "retryable",
  "failed",
]);
export const paymentReviewTypeEnum = pgEnum("payment_review_type", [
  "amount_mismatch",
  "terminal_conflict",
  "event_anomaly",
  "partial_refund",
  "uncertain_result",
  "buyer_identity",
]);
export const paymentReviewStatusEnum = pgEnum("payment_review_status", [
  "pending",
  "approved",
  "rejected",
]);
export const refundRequestStatusEnum = pgEnum("refund_request_status", [
  "requested",
  "processing",
  "uncertain",
  "failed",
  "confirmed",
]);
export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "retrying",
  "delivered",
  "dead_letter",
  "superseded",
]);
export const emailMessageStatusEnum = pgEnum("email_message_status", [
  "sending",
  "acceptance_unknown",
  "accepted",
  "delayed",
  "delivered",
  "failed",
  "suppressed",
  "bounced",
  "complained",
]);
export const emailDeliveryTopicEnum = pgEnum("email_delivery_topic", [
  "auth.account-activation",
  "auth.password-reset",
  "email.access-released",
  "email.access-expiry-warning",
  "email.certificate-issued",
  "email.course-sales-opened",
  "email.support-request",
]);
export const emailTemplateAliasEnum = pgEnum("email_template_alias", [
  "auth-password-reset",
  "access-released",
  "access-expiry-warning",
  "certificate-issued",
  "course-sales-opened",
  "support-request",
]);
export const resendWebhookEventStatusEnum = pgEnum(
  "resend_webhook_event_status",
  ["received", "processing", "processed", "ignored", "retrying", "dead_letter"]
);
export const certificateStatusEnum = pgEnum("certificate_status", [
  "valid",
  "revoked",
]);
export const certificateRenderStatusEnum = pgEnum("certificate_render_status", [
  "pending",
  "ready",
  "failed",
]);
export const certificateTemplateStatusEnum = pgEnum(
  "certificate_template_status",
  ["draft", "published", "superseded"]
);
export const lessonCommentStatusEnum = pgEnum("lesson_comment_status", [
  "visible",
  "hidden",
]);
export const learningAnalyticsEventTypeEnum = pgEnum(
  "learning_analytics_event_type",
  [
    "lesson_started",
    "watch_checkpoint",
    "lesson_completed",
    "resource_open_failed",
    "player_error",
  ]
);
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

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    // Legacy columns retained so future migration diffs do not propose a drop.
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_lower_unique_idx").on(sql`lower(${table.email})`),
  ]
);

// Legacy Better Auth storage retained for migration history; not registered by the app.
export const twoFactors = pgTable(
  "two_factors",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true).notNull(),
    failedVerificationCount: integer("failed_verification_count")
      .default(0)
      .notNull(),
    lockedUntil: timestamp("locked_until", tz),
  },
  (table) => [index("two_factors_secret_idx").on(table.secret)]
);

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
    workloadHoursOverride: integer("workload_hours_override"),
    priceInCents: integer("price_in_cents").default(0).notNull(),
    paymentAllowPix: boolean("payment_allow_pix").default(true).notNull(),
    paymentAllowCreditCard: boolean("payment_allow_credit_card")
      .default(true)
      .notNull(),
    paymentMaxInstallmentCount: integer("payment_max_installment_count")
      .default(3)
      .notNull(),
    thumbnailUrl: text("thumbnail_url"),
    coverImageJson: jsonb("cover_image_json"),
    accessDurationMonths: integer("access_duration_months")
      .default(12)
      .notNull(),
    status: courseStatusEnum("status").default("draft").notNull(),
    catalogVisibility: courseCatalogVisibilityEnum("catalog_visibility")
      .default("hidden")
      .notNull(),
    salesStatus: courseSalesStatusEnum("sales_status")
      .default("closed")
      .notNull(),
    launchDate: date("launch_date"),
    launchLandingUrl: text("launch_landing_url"),
    interestNotificationsSent: integer("interest_notifications_sent")
      .default(0)
      .notNull(),
    certificateEnabled: boolean("certificate_enabled").default(false).notNull(),
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
      "courses_workload_hours_override_non_negative",
      sql`${table.workloadHoursOverride} is null or ${table.workloadHoursOverride} >= 0`
    ),
    check(
      "courses_price_in_cents_zero_or_minimum",
      sql`${table.priceInCents} = 0 or ${table.priceInCents} >= 1000`
    ),
    check(
      "courses_payment_method_required",
      sql`${table.paymentAllowPix} or ${table.paymentAllowCreditCard}`
    ),
    check(
      "courses_payment_installment_count_valid",
      sql`${table.paymentMaxInstallmentCount} between 1 and 12`
    ),
    check(
      "courses_payment_installment_requires_card",
      sql`${table.paymentAllowCreditCard} or ${table.paymentMaxInstallmentCount} = 1`
    ),
    check(
      "courses_availability_combination_valid",
      sql`(
        ${table.salesStatus} = 'open'
        and ${table.status} = 'active'
        and ${table.catalogVisibility} = 'listed'
      ) or (
        ${table.salesStatus} = 'closed'
        and ${table.status} in ('draft', 'active')
      ) or (
        ${table.salesStatus} = 'closed'
        and ${table.status} = 'archived'
        and ${table.catalogVisibility} = 'hidden'
      )`
    ),
    check(
      "courses_interest_notifications_sent_non_negative",
      sql`${table.interestNotificationsSent} >= 0`
    ),
    check(
      "courses_launch_fields_only_for_coming_soon",
      sql`(
        ${table.launchDate} is null and ${table.launchLandingUrl} is null
      ) or (
        ${table.status} = 'draft'
        and ${table.catalogVisibility} = 'listed'
        and ${table.salesStatus} = 'closed'
      ) or (
        ${table.launchDate} is null
        and ${table.status} = 'active'
        and ${table.salesStatus} = 'closed'
      )`
    ),
  ]
);

export const courseSaleInterests = pgTable(
  "course_sale_interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationEnqueuedAt: timestamp("notification_enqueued_at", tz),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_sale_interests_course_user_unique_idx").on(
      table.courseId,
      table.userId
    ),
    index("course_sale_interests_notification_idx").on(
      table.courseId,
      table.notificationEnqueuedAt
    ),
  ]
);

export const coursePublications = pgTable(
  "course_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    publicationNumber: integer("publication_number").notNull(),
    status: coursePublicationStatusEnum("status").default("draft").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    workloadHoursSnapshot: integer("workload_hours_snapshot")
      .default(0)
      .notNull(),
    publishedAt: timestamp("published_at", tz),
    retiredAt: timestamp("retired_at", tz),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_publications_course_number_unique_idx").on(
      table.courseId,
      table.publicationNumber
    ),
    uniqueIndex("course_publications_one_published_per_course_idx")
      .on(table.courseId)
      .where(sql`${table.status} = 'published'`),
    uniqueIndex("course_publications_one_draft_per_course_idx")
      .on(table.courseId)
      .where(sql`${table.status} = 'draft'`),
    index("course_publications_course_status_idx").on(
      table.courseId,
      table.status
    ),
    check(
      "course_publications_number_positive",
      sql`${table.publicationNumber} > 0`
    ),
    check(
      "course_publications_workload_non_negative",
      sql`${table.workloadHoursSnapshot} >= 0`
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
    coursePublicationId: uuid("course_publication_id")
      .notNull()
      .references(() => coursePublications.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
    status: courseStatusEnum("status").default("draft").notNull(),
    ...timestamps,
  },
  (table) => [
    index("modules_course_sort_idx").on(table.courseId, table.sortOrder),
    index("modules_course_publication_sort_idx").on(
      table.coursePublicationId,
      table.sortOrder
    ),
    uniqueIndex("modules_course_publication_sort_unique_idx").on(
      table.coursePublicationId,
      table.sortOrder
    ),
  ]
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    curriculumKey: uuid("curriculum_key").defaultRandom().notNull(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    coursePublicationId: uuid("course_publication_id")
      .notNull()
      .references(() => coursePublications.id, { onDelete: "cascade" }),
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
    isRequired: boolean("is_required").default(true).notNull(),
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
    index("lessons_course_publication_idx").on(table.coursePublicationId),
    index("lessons_curriculum_key_idx").on(table.curriculumKey),
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
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    manualReference: text("manual_reference"),
    status: enrollmentGrantStatusEnum("status").default("active").notNull(),
    startsAt: timestamp("starts_at", tz).notNull(),
    baseExpiresAt: timestamp("base_expires_at", tz).notNull(),
    effectiveExpiresAt: timestamp("effective_expires_at", tz).notNull(),
    revokedAt: timestamp("revoked_at", tz),
    revokedReason: text("revoked_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("enrollment_grants_order_unique_idx").on(table.orderId),
    uniqueIndex("enrollment_grants_manual_reference_unique_idx").on(
      table.manualReference
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
    check(
      "enrollment_grants_source_shape_check",
      sql`(${table.sourceType} = 'paid_order' and ${table.orderId} is not null and ${table.manualReference} is null) or (${table.sourceType} = 'manual' and ${table.orderId} is null and ${table.manualReference} is not null)`
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

/** Default-enabled analytics preference; a disabled value opts the student out. */
export const learningAnalyticsPreferences = pgTable(
  "learning_analytics_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    enabledAt: timestamp("enabled_at", tz),
    disabledAt: timestamp("disabled_at", tz),
    policyVersion: text("policy_version").notNull(),
    ...timestamps,
  }
);

export const learningAnalyticsEvents = pgTable(
  "learning_analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: learningAnalyticsEventTypeEnum("event_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    coursePublicationId: uuid("course_publication_id")
      .notNull()
      .references(() => coursePublications.id, { onDelete: "restrict" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    checkpointPercent: integer("checkpoint_percent"),
    errorCode: text("error_code"),
    occurredAt: timestamp("occurred_at", tz).defaultNow().notNull(),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("learning_analytics_events_idempotency_unique_idx").on(
      table.idempotencyKey
    ),
    index("learning_analytics_events_publication_lesson_occurred_idx").on(
      table.coursePublicationId,
      table.lessonId,
      table.occurredAt
    ),
    index("learning_analytics_events_enrollment_occurred_idx").on(
      table.enrollmentId,
      table.occurredAt
    ),
    check(
      "learning_analytics_events_checkpoint_percent_bounds",
      sql`${table.checkpointPercent} is null or (${table.checkpointPercent} >= 0 and ${table.checkpointPercent} <= 100)`
    ),
  ]
);

/** Aggregates contain no user or enrollment identifier and preserve trend history. */
export const learningAnalyticsDailyMetrics = pgTable(
  "learning_analytics_daily_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metricDate: date("metric_date").notNull(),
    eventType: learningAnalyticsEventTypeEnum("event_type").notNull(),
    coursePublicationId: uuid("course_publication_id")
      .notNull()
      .references(() => coursePublications.id, { onDelete: "restrict" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    eventCount: integer("event_count").notNull(),
    uniqueEnrollmentCount: integer("unique_enrollment_count").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("learning_analytics_daily_metrics_unique_idx").on(
      table.metricDate,
      table.eventType,
      table.coursePublicationId,
      table.lessonId
    ),
    index("learning_analytics_daily_metrics_publication_lesson_date_idx").on(
      table.coursePublicationId,
      table.lessonId,
      table.metricDate
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
    buyerIdentityStatus: buyerIdentityStatusEnum(
      "buyer_identity_status"
    ).notNull(),
    provider: text("provider").notNull(),
    providerCheckoutId: text("provider_checkout_id"),
    providerPaymentId: text("provider_payment_id"),
    providerInstallmentId: text("provider_installment_id"),
    providerCustomerId: text("provider_customer_id"),
    externalId: text("external_id").notNull(),
    status: orderStatusEnum("status").default("pending").notNull(),
    checkoutStatus: checkoutStatusEnum("checkout_status")
      .default("pending")
      .notNull(),
    checkoutUrl: text("checkout_url"),
    checkoutAttemptCount: integer("checkout_attempt_count")
      .default(0)
      .notNull(),
    checkoutLastAttemptAt: timestamp("checkout_last_attempt_at", tz),
    checkoutNextAttemptAt: timestamp("checkout_next_attempt_at", tz),
    checkoutErrorMessage: text("checkout_error_message"),
    providerCheckoutStatus: text("provider_checkout_status"),
    providerPaymentStatus: text("provider_payment_status"),
    providerRiskStatus: text("provider_risk_status"),
    providerSettlementStatus: text("provider_settlement_status"),
    providerRefundStatus: text("provider_refund_status"),
    providerDisputeStatus: text("provider_dispute_status"),
    amountInCents: integer("amount_in_cents").default(0).notNull(),
    paymentAllowPix: boolean("payment_allow_pix").default(true).notNull(),
    paymentAllowCreditCard: boolean("payment_allow_credit_card")
      .default(true)
      .notNull(),
    paymentMaxInstallmentCount: integer("payment_max_installment_count")
      .default(1)
      .notNull(),
    accessDurationMonths: integer("access_duration_months"),
    paidAmountInCents: integer("paid_amount_in_cents"),
    netAmountInCents: integer("net_amount_in_cents"),
    feeAmountInCents: integer("fee_amount_in_cents"),
    paymentMethod: text("payment_method"),
    receiptUrl: text("receipt_url"),
    paidAt: timestamp("paid_at", tz),
    refundedAt: timestamp("refunded_at", tz),
    customerEmail: text("customer_email"),
    customerName: text("customer_name"),
    checkoutCourseSlug: text("checkout_course_slug").notNull(),
    checkoutItemName: text("checkout_item_name").notNull(),
    checkoutItemDescription: text("checkout_item_description").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_provider_checkout_unique_idx")
      .on(table.provider, table.providerCheckoutId)
      .where(sql`${table.providerCheckoutId} is not null`),
    uniqueIndex("orders_provider_payment_unique_idx")
      .on(table.provider, table.providerPaymentId)
      .where(sql`${table.providerPaymentId} is not null`),
    uniqueIndex("orders_provider_installment_unique_idx")
      .on(table.provider, table.providerInstallmentId)
      .where(sql`${table.providerInstallmentId} is not null`),
    index("orders_checkout_retry_idx").on(
      table.checkoutStatus,
      table.checkoutNextAttemptAt
    ),
    uniqueIndex("orders_external_unique_idx").on(table.externalId),
    index("orders_course_status_idx").on(table.courseId, table.status),
    check(
      "orders_access_duration_positive",
      sql`${table.accessDurationMonths} is null or ${table.accessDurationMonths} > 0`
    ),
    check(
      "orders_payment_method_required",
      sql`${table.paymentAllowPix} or ${table.paymentAllowCreditCard}`
    ),
    check(
      "orders_payment_installment_count_valid",
      sql`${table.paymentMaxInstallmentCount} between 1 and 21`
    ),
    check(
      "orders_payment_installment_requires_card",
      sql`${table.paymentAllowCreditCard} or ${table.paymentMaxInstallmentCount} = 1`
    ),
    check(
      "orders_amount_in_cents_non_negative",
      sql`${table.amountInCents} >= 0`
    ),
    check(
      "orders_checkout_attempt_count_non_negative",
      sql`${table.checkoutAttemptCount} >= 0`
    ),
    check(
      "orders_financial_amounts_non_negative",
      sql`(${table.paidAmountInCents} is null or ${table.paidAmountInCents} >= 0)
        and (${table.netAmountInCents} is null or ${table.netAmountInCents} >= 0)
        and (${table.feeAmountInCents} is null or ${table.feeAmountInCents} >= 0)`
    ),
    check(
      "orders_paid_evidence_consistent",
      sql`${table.status} <> 'paid'
        or (
          ${table.paidAt} is not null
          and ${table.paidAmountInCents} is not null
          and (${table.providerPaymentId} is not null or ${table.providerInstallmentId} is not null)
        )`
    ),
    check(
      "orders_refunded_evidence_consistent",
      sql`${table.status} <> 'refunded'
        or (${table.refundedAt} is not null and ${table.providerRefundStatus} is not null)`
    ),
  ]
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventKey: text("event_key").notNull(),
    eventName: text("event_name").notNull(),
    status: webhookStatusEnum("status").default("received").notNull(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", tz),
    nextAttemptAt: timestamp("next_attempt_at", tz),
    lockedAt: timestamp("locked_at", tz),
    lockedBy: text("locked_by"),
    payloadExpiresAt: timestamp("payload_expires_at", tz)
      .default(sql`now() + interval '30 days'`)
      .notNull(),
    payloadSanitizedAt: timestamp("payload_sanitized_at", tz),
    processedAt: timestamp("processed_at", tz),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("webhook_events_provider_key_unique_idx").on(
      table.provider,
      table.eventKey
    ),
    index("webhook_events_status_retry_idx").on(
      table.status,
      table.nextAttemptAt
    ),
    index("webhook_events_order_idx").on(table.orderId),
  ]
);

export const paymentReviews = pgTable(
  "payment_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    webhookEventId: uuid("webhook_event_id").references(
      () => webhookEvents.id,
      {
        onDelete: "set null",
      }
    ),
    type: paymentReviewTypeEnum("type").notNull(),
    status: paymentReviewStatusEnum("status").default("pending").notNull(),
    reason: text("reason").notNull(),
    decisionReason: text("decision_reason"),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", tz),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", tz),
    executedByUserId: text("executed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    executedAt: timestamp("executed_at", tz),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_reviews_webhook_event_unique_idx")
      .on(table.webhookEventId)
      .where(sql`${table.webhookEventId} is not null`),
    index("payment_reviews_order_status_idx").on(table.orderId, table.status),
    index("payment_reviews_status_idx").on(table.status),
  ]
);

export const refundRequests = pgTable(
  "refund_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: refundRequestStatusEnum("status").default("requested").notNull(),
    providerRefundStatus: text("provider_refund_status"),
    providerRefundCreatedAt: text("provider_refund_created_at"),
    providerRefundEndToEndId: text("provider_refund_end_to_end_id"),
    providerRefundReceiptUrl: text("provider_refund_receipt_url"),
    providerRefundedAmountInCents: integer("provider_refunded_amount_in_cents"),
    errorMessage: text("error_message"),
    confirmedAt: timestamp("confirmed_at", tz),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("refund_requests_order_unique_idx").on(table.orderId),
    index("refund_requests_status_idx").on(table.status),
    check(
      "refund_requests_provider_amount_positive",
      sql`${table.providerRefundedAmountInCents} is null or ${table.providerRefundedAmountInCents} > 0`
    ),
    check(
      "refund_requests_confirmed_evidence_consistent",
      sql`${table.status} <> 'confirmed'
        or (
          ${table.confirmedAt} is not null
          and ${table.providerRefundStatus} is not null
          and ${table.providerRefundedAmountInCents} > 0
        )`
    ),
  ]
);

export const asaasFinancialTransactions = pgTable(
  "asaas_financial_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerTransactionId: text("provider_transaction_id").notNull(),
    transactionDate: text("transaction_date").notNull(),
    transactionType: text("transaction_type").notNull(),
    valueInCents: integer("value_in_cents").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("asaas_financial_transactions_provider_id_unique_idx").on(
      table.providerTransactionId
    ),
    index("asaas_financial_transactions_date_idx").on(table.transactionDate),
  ]
);

export const asaasStatementImportCursors = pgTable(
  "asaas_statement_import_cursors",
  {
    rangeKey: text("range_key").primaryKey(),
    startDate: text("start_date").notNull(),
    finishDate: text("finish_date").notNull(),
    nextOffset: integer("next_offset").default(0).notNull(),
    status: text("status").default("running").notNull(),
    startedByUserId: text("started_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", tz),
    ...timestamps,
  },
  (table) => [
    check(
      "asaas_statement_import_cursor_offset_non_negative",
      sql`${table.nextOffset} >= 0`
    ),
    check(
      "asaas_statement_import_cursor_status_valid",
      sql`${table.status} in ('running', 'completed')`
    ),
    check(
      "asaas_statement_import_cursor_completion_consistent",
      sql`(${table.status} = 'completed') = (${table.completedAt} is not null)`
    ),
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
      .references(() => courses.id, { onDelete: "restrict" }),
    coursePublicationId: uuid("course_publication_id")
      .notNull()
      .references(() => coursePublications.id, { onDelete: "restrict" }),
    certificateTemplateId: uuid("certificate_template_id").references(
      () => certificateTemplates.id,
      { onDelete: "set null" }
    ),
    code: text("code").notNull().unique(),
    studentNameSnapshot: text("student_name_snapshot").notNull(),
    courseTitleSnapshot: text("course_title_snapshot").notNull(),
    workloadHoursSnapshot: integer("workload_hours_snapshot")
      .default(0)
      .notNull(),
    issuedAt: timestamp("issued_at", tz).defaultNow().notNull(),
    pdfStorageKey: text("pdf_storage_key"),
    pdfSha256: text("pdf_sha256"),
    previewSha256: text("preview_sha256"),
    renderedAt: timestamp("rendered_at", tz),
    renderStatus: certificateRenderStatusEnum("render_status")
      .default("pending")
      .notNull(),
    renderSnapshot: jsonb("render_snapshot"),
    renderClaimToken: uuid("render_claim_token"),
    renderClaimedAt: timestamp("render_claimed_at", tz),
    status: certificateStatusEnum("status").default("valid").notNull(),
    revokedAt: timestamp("revoked_at", tz),
    revokedReason: text("revoked_reason"),
    revokedReasonCategory: text("revoked_reason_category"),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    replacesCertificateId: uuid("replaces_certificate_id").references(
      (): AnyPgColumn => certificates.id,
      { onDelete: "set null" }
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("certificates_user_course_active_unique_idx")
      .on(table.userId, table.courseId)
      .where(sql`${table.status} = 'valid'`),
    index("certificates_user_course_history_idx").on(
      table.userId,
      table.courseId
    ),
    index("certificates_status_idx").on(table.status),
    index("certificates_course_publication_idx").on(table.coursePublicationId),
    check(
      "certificates_render_claim_pair_check",
      sql`(${table.renderClaimToken} is null) = (${table.renderClaimedAt} is null)`
    ),
    check(
      "certificates_ready_artifact_check",
      sql`${table.renderStatus} <> 'ready' or (${table.pdfStorageKey} is not null and ${table.pdfSha256} is not null and ${table.renderedAt} is not null and ${table.renderClaimToken} is null)`
    ),
    check(
      "certificates_revocation_state_check",
      sql`(${table.status} = 'revoked') = (${table.revokedAt} is not null)`
    ),
    check(
      "certificates_revoked_reason_category_check",
      sql`${table.revokedReasonCategory} is null or ${table.revokedReasonCategory} in ('identity_correction', 'course_snapshot_correction', 'eligibility_correction', 'duplicate_or_technical_issue', 'integrity_review', 'legal_or_compliance', 'other')`
    ),
    check(
      "certificates_valid_revocation_fields_check",
      sql`${table.status} = 'revoked' or (${table.revokedReason} is null and ${table.revokedReasonCategory} is null and ${table.revokedByUserId} is null)`
    ),
  ]
);

export const certificateIssuerProfiles = pgTable(
  "certificate_issuer_profiles",
  {
    id: text("id").primaryKey(),
    legalName: text("legal_name").notNull(),
    cnpj: text("cnpj").notNull(),
    displayName: text("display_name").notNull(),
    ...timestamps,
  }
);

export const certificateTemplates = pgTable(
  "certificate_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: certificateTemplateStatusEnum("status").default("draft").notNull(),
    backgroundKey: text("background_key").notNull(),
    spec: jsonb("spec").notNull(),
    signerName: text("signer_name"),
    signerRole: text("signer_role"),
    signatureKey: text("signature_key"),
    publishedAt: timestamp("published_at", tz),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("certificate_templates_course_version_unique_idx").on(
      table.courseId,
      table.version
    ),
    uniqueIndex("certificate_templates_one_published_per_course_idx")
      .on(table.courseId)
      .where(sql`${table.status} = 'published'`),
    uniqueIndex("certificate_templates_one_draft_per_course_idx")
      .on(table.courseId)
      .where(sql`${table.status} = 'draft'`),
  ]
);

/** The first known conclusion is historical and is not reopened by later publications. */
export const courseCompletions = pgTable(
  "course_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    coursePublicationId: uuid("course_publication_id")
      .notNull()
      .references(() => coursePublications.id, { onDelete: "restrict" }),
    completedAt: timestamp("completed_at", tz).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_completions_user_course_unique_idx").on(
      table.userId,
      table.courseId
    ),
    index("course_completions_course_publication_idx").on(
      table.coursePublicationId
    ),
    index("course_completions_course_reconciliation_idx").on(
      table.courseId,
      table.completedAt,
      table.id,
      table.userId
    ),
  ]
);

export const publicCertificateRateLimits = pgTable(
  "public_certificate_rate_limits",
  {
    keyHash: text("key_hash").primaryKey(),
    windowStartedAt: timestamp("window_started_at", tz).defaultNow().notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    expiresAt: timestamp("expires_at", tz).notNull(),
    ...timestamps,
  },
  (table) => [
    index("public_certificate_rate_limits_expires_at_idx").on(table.expiresAt),
  ]
);

export const publicCheckoutRateLimits = pgTable(
  "public_checkout_rate_limits",
  {
    keyHash: text("key_hash").primaryKey(),
    windowStartedAt: timestamp("window_started_at", tz).defaultNow().notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    expiresAt: timestamp("expires_at", tz).notNull(),
    ...timestamps,
  },
  (table) => [
    index("public_checkout_rate_limits_expires_at_idx").on(table.expiresAt),
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

export const supportRequests = pgTable(
  "support_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    courseTitle: text("course_title"),
    ...timestamps,
  },
  (table) => [index("support_requests_user_idx").on(table.userId)]
);

export const outboxMessages = pgTable(
  "outbox_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadVersion: integer("payload_version").notNull(),
    payload: jsonb("payload").default(sql`'{}'::jsonb`).notNull(),
    status: outboxStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", tz).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", tz),
    lockedBy: text("locked_by"),
    lastErrorCode: text("last_error_code"),
    lastErrorAt: timestamp("last_error_at", tz),
    deliveredAt: timestamp("delivered_at", tz),
    supersededAt: timestamp("superseded_at", tz),
    manualReprocessCount: integer("manual_reprocess_count")
      .default(0)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("outbox_messages_idempotency_key_unique_idx").on(
      table.idempotencyKey
    ),
    index("outbox_messages_available_idx").on(table.status, table.availableAt),
    index("outbox_messages_locked_idx").on(table.status, table.lockedAt),
    index("outbox_messages_superseded_idx").on(table.supersededAt),
  ]
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").default("resend").notNull(),
    providerMessageId: text("provider_message_id").unique(),
    outboxMessageId: uuid("outbox_message_id")
      .unique()
      .references(() => outboxMessages.id, { onDelete: "set null" }),
    correlationId: uuid("correlation_id").notNull().unique(),
    topic: emailDeliveryTopicEnum("topic").notNull(),
    templateAlias: emailTemplateAliasEnum("template_alias").notNull(),
    status: emailMessageStatusEnum("status").default("sending").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    firstProviderAttemptAt: timestamp("first_provider_attempt_at", tz),
    acceptanceUnknownAt: timestamp("acceptance_unknown_at", tz),
    automaticRetryDeadlineAt: timestamp("automatic_retry_deadline_at", tz),
    acceptedAt: timestamp("accepted_at", tz),
    latestEventAt: timestamp("latest_event_at", tz),
    delayedAt: timestamp("delayed_at", tz),
    deliveredAt: timestamp("delivered_at", tz),
    failedAt: timestamp("failed_at", tz),
    suppressedAt: timestamp("suppressed_at", tz),
    bouncedAt: timestamp("bounced_at", tz),
    complainedAt: timestamp("complained_at", tz),
    lastErrorCode: text("last_error_code"),
    deliveryEventConflict: boolean("delivery_event_conflict")
      .default(false)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("email_messages_status_updated_idx").on(
      table.status,
      table.updatedAt
    ),
    check("email_messages_provider_resend", sql`${table.provider} = 'resend'`),
    check(
      "email_messages_request_fingerprint_sha256",
      sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`
    ),
  ]
);

export const resendWebhookEvents = pgTable(
  "resend_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerEventId: text("provider_event_id").notNull().unique(),
    providerMessageId: text("provider_message_id"),
    correlationId: uuid("correlation_id"),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", tz).notNull(),
    receivedAt: timestamp("received_at", tz).defaultNow().notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    status: resendWebhookEventStatusEnum("status")
      .default("received")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", tz).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", tz),
    lockedBy: text("locked_by"),
    processedAt: timestamp("processed_at", tz),
    lastErrorCode: text("last_error_code"),
    emailMessageId: uuid("email_message_id").references(
      () => emailMessages.id,
      { onDelete: "set null" }
    ),
    ...timestamps,
  },
  (table) => [
    index("resend_webhook_events_available_idx").on(
      table.status,
      table.availableAt
    ),
    index("resend_webhook_events_provider_message_idx").on(
      table.providerMessageId
    ),
    index("resend_webhook_events_timeline_idx").on(
      table.emailMessageId,
      table.occurredAt
    ),
    index("resend_webhook_events_correlation_idx").on(table.correlationId),
    check(
      "resend_webhook_events_payload_sha256",
      sql`${table.payloadSha256} ~ '^[0-9a-f]{64}$'`
    ),
  ]
);

export const scheduledJobLeases = pgTable("scheduled_job_leases", {
  jobName: text("job_name").primaryKey(),
  ownerToken: uuid("owner_token").notNull(),
  lockedUntil: timestamp("locked_until", tz).notNull(),
  ...timestamps,
});

export const certificateTemplateAssetCleanup = pgTable(
  "certificate_template_asset_cleanup",
  {
    objectKey: text("object_key").primaryKey(),
    courseId: uuid("course_id").notNull(),
    status: text("status").default("pending").notNull(),
    notBefore: timestamp("not_before", tz).defaultNow().notNull(),
    ownerToken: uuid("owner_token"),
    lockedAt: timestamp("locked_at", tz),
    attempts: integer("attempts").default(0).notNull(),
    lastErrorCode: text("last_error_code"),
    lastErrorAt: timestamp("last_error_at", tz),
    deletedAt: timestamp("deleted_at", tz),
    ...timestamps,
  },
  (table) => [
    check(
      "certificate_template_asset_cleanup_status_check",
      sql`${table.status} in ('pending', 'processing', 'deleted')`
    ),
    index("certificate_template_asset_cleanup_due_idx").on(
      table.status,
      table.notBefore
    ),
    index("certificate_template_asset_cleanup_locked_idx").on(
      table.status,
      table.lockedAt
    ),
  ]
);

export const stagedAdminImageUploads = pgTable(
  "staged_admin_image_uploads",
  {
    objectKey: text("object_key").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    purpose: text("purpose").notNull(),
    contentType: text("content_type").notNull(),
    fileName: text("file_name").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status").default("prepared").notNull(),
    ownerToken: uuid("owner_token"),
    lockedAt: timestamp("locked_at", tz),
    confirmedAt: timestamp("confirmed_at", tz),
    consumedAt: timestamp("consumed_at", tz),
    expiresAt: timestamp("expires_at", tz)
      .default(sql`now() + interval '24 hours'`)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "staged_admin_image_uploads_status_check",
      sql`${table.status} in ('prepared', 'ready', 'processing', 'consumed')`
    ),
    index("staged_admin_image_uploads_expiry_idx").on(
      table.status,
      table.expiresAt
    ),
    index("staged_admin_image_uploads_actor_idx").on(
      table.actorUserId,
      table.aggregateType,
      table.aggregateId
    ),
  ]
);

export const stagedLessonResourceUploads = pgTable(
  "staged_lesson_resource_uploads",
  {
    resourceId: text("resource_id").primaryKey(),
    objectKey: text("object_key").notNull().unique(),
    previewObjectKey: text("preview_object_key"),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    fileName: text("file_name").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    previewContentType: text("preview_content_type"),
    previewSizeBytes: integer("preview_size_bytes"),
    previewWidth: integer("preview_width"),
    previewHeight: integer("preview_height"),
    status: text("status").default("prepared").notNull(),
    expiresAt: timestamp("expires_at", tz)
      .default(sql`now() + interval '24 hours'`)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "staged_lesson_resource_uploads_status_check",
      sql`${table.status} in ('prepared', 'uploaded', 'cleaning', 'consumed')`
    ),
    check(
      "staged_lesson_resource_uploads_size_check",
      sql`${table.sizeBytes} > 0`
    ),
    check(
      "staged_lesson_resource_uploads_preview_check",
      sql`(
        ${table.previewObjectKey} is null
        and ${table.previewContentType} is null
        and ${table.previewSizeBytes} is null
        and ${table.previewWidth} is null
        and ${table.previewHeight} is null
      ) or (
        ${table.previewObjectKey} is not null
        and ${table.previewContentType} = 'image/webp'
        and ${table.previewSizeBytes} > 0
        and ${table.previewWidth} > 0
        and ${table.previewHeight} > 0
      )`
    ),
    index("staged_lesson_resource_uploads_expiry_idx").on(
      table.status,
      table.expiresAt
    ),
    index("staged_lesson_resource_uploads_lesson_actor_idx").on(
      table.lessonId,
      table.actorUserId
    ),
  ]
);

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  certificateSignerName: text("certificate_signer_name"),
  certificateSignerRole: text("certificate_signer_role"),
  ...timestamps,
});

export const dashboardBanners = pgTable("dashboard_banners", {
  blurDataUrl: text("blur_data_url"),
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  buttonText: text("button_text"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").notNull(),
  ...timestamps,
});
