"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPool } from "@/db";
import {
  type AuditLogQueryClient,
  writeAuditLog,
} from "@/features/admin/audit-log";
import type {
  AuditMetadata,
  AuditMetadataValue,
} from "@/features/admin/audit-types";
import {
  createCoursePublicationDraft,
  createLessonDraft,
  publishCoursePublication,
  removeLessonVideo,
  saveCourse,
  saveLesson,
  saveModule,
} from "@/features/admin/authoring";
import type { CertificateTemplateActionState } from "@/features/admin/certificate-template-action-state";
import {
  getExpectedCertificateTemplateActionMessage,
  saveAndPublishCertificateTemplate,
} from "@/features/admin/certificate-template-actions";
import {
  parseAdjustEnrollmentExpirationInput,
  parseEnrollmentAccessInput,
  parseExpirationDateSelection,
  parseExtendEnrollmentExpirationInput,
  parseGrantEnrollmentFullContentAccessInput,
  parseSetEnrollmentExpirationInput,
  parseStudentPlatformAccessInput,
} from "@/features/admin/enrollment-command-input";
import {
  getLessonSaveActionFailure,
  type LessonSaveActionResult,
} from "@/features/admin/lesson-authoring-errors";
import { buildAdminLessonEditPath } from "@/features/admin/lesson-drafts";
import { parseCertificateTemplateSubmission } from "@/features/certificates/render-snapshot";
import { CertificateTemplateDomainError } from "@/features/certificates/template-errors";
import {
  disableCertificateForCourse,
  enableCertificateForCourse,
  publishCertificateTemplate,
  runCertificateTemplateAssetMutation,
  saveCertificateTemplateDraft,
  uploadCertificateBackground,
  uploadCertificateSignature,
} from "@/features/certificates/templates";
import { lockCourseContentRelease } from "@/features/courses/content-release-lock";
import type { ExpirationChangeResult } from "@/features/enrollments/server";
import {
  completeJmvstreamUpload,
  discardJmvstreamUpload,
  ensureJmvstreamCourseFolder,
  initJmvstreamUpload,
  markJmvstreamUploadFailed,
  retryJmvstreamAssetDelete,
  syncJmvstreamLessonPlayer,
} from "@/features/jmvstream/server";
import {
  deletePublicR2Objects,
  deleteR2Objects,
  publishR2Object,
  uploadDashboardBannerFile,
} from "@/features/storage/r2";
import {
  parseStagedAdminImageReference,
  type StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import {
  consumeStagedAdminImageUpload,
  consumeStagedAdminImageUploads,
} from "@/features/storage/staged-image-upload-registry";
import { requirePermission } from "@/lib/auth-permissions";
import { normalizeCnpj } from "@/lib/cnpj";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";
import { requireRole } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readNumber = (formData: FormData, key: string, fallback = 0): number => {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
};

const readCheckbox = (formData: FormData, key: string): boolean =>
  formData.get(key) === "on";

const revalidateAdmin = (): void => {
  for (const path of [
    "/admin",
    "/admin/cursos",
    "/admin/alunas",
    "/admin/alunos",
    "/admin/financeiro",
    "/admin/faq",
    "/admin/configuracoes",
    "/app",
  ]) {
    revalidatePath(path);
  }
  revalidatePath("/admin", "layout");
};

const audit = async ({
  action,
  actorUserId,
  client,
  metadata,
  targetId,
  targetType,
}: {
  action: string;
  actorUserId: string;
  client?: AuditLogQueryClient;
  metadata?: AuditMetadata;
  targetId?: string | undefined;
  targetType: string;
}) => {
  await writeAuditLog({
    action,
    actorUserId,
    client,
    metadata,
    targetId,
    targetType,
  });
};

const maskCnpjForAudit = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : "••••";
};

const getAuditChanges = (
  before: Record<string, AuditMetadataValue>,
  after: Record<string, AuditMetadataValue>
): NonNullable<AuditMetadata["changes"]> =>
  Object.fromEntries(
    Object.keys(before).flatMap((key) => {
      const beforeValue = before[key] ?? null;
      const afterValue = after[key] ?? null;
      return JSON.stringify(beforeValue) === JSON.stringify(afterValue)
        ? []
        : [[key, { after: afterValue, before: beforeValue }]];
    })
  );

const truncateAuditText = (value: string | null): string | null =>
  value && value.length > 500 ? `${value.slice(0, 500)}…` : value;

export interface LessonReorderGroup {
  lessonIds: string[];
  moduleId: string;
}

export type CourseContentReorderResult =
  | { ok: true }
  | { message: string; ok: false };

const REORDER_FAILURE_MESSAGE =
  "Nao foi possivel salvar a nova ordem. Tente novamente.";

const hasExactlyTheSameIds = (
  actualIds: string[],
  expectedIds: string[]
): boolean =>
  actualIds.length === expectedIds.length &&
  new Set(actualIds).size === actualIds.length &&
  actualIds.every((id) => expectedIds.includes(id));

const getActionCorrelationId = async (): Promise<string> =>
  createCorrelationId((await headers()).get(CORRELATION_ID_HEADER));

const rollbackTransaction = async (client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> => {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The transaction may have failed before BEGIN completed.
  }
};

const auditEnrollmentExpirationChange = async ({
  actorUserId,
  enrollmentId,
  result,
}: {
  actorUserId: string;
  enrollmentId: string;
  result: ExpirationChangeResult;
}): Promise<void> => {
  const actionByChangeType: Record<
    ExpirationChangeResult["changeType"],
    string
  > = {
    extension: "enrollment.expiration_extended",
    reduction: "enrollment.expiration_reduced",
    unchanged: "enrollment.expiration_set",
  };

  await audit({
    action: actionByChangeType[result.changeType],
    actorUserId,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
};

const revalidateEnrollmentAdminPaths = (): void => {
  revalidateAdmin();
};

export const saveCourseAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const { courseId } = await saveCourse({
    actorUserId: session.user.id,
    formData,
  });
  revalidateAdmin();
  revalidatePath(`/app/cursos/${courseId}`);
};

export type CoursePublicationActionResult =
  | { ok: true }
  | { message: string; ok: false };

const getCoursePublicationActionError = (
  error: unknown,
  fallback: string
): CoursePublicationActionResult => ({
  message: error instanceof Error ? error.message : fallback,
  ok: false,
});

export const createCoursePublicationDraftAction = async (
  courseId: string
): Promise<CoursePublicationActionResult> => {
  try {
    const session = await requireRole(["admin"]);
    await createCoursePublicationDraft({
      actorUserId: session.user.id,
      courseId,
    });
    revalidateAdmin();
    return { ok: true };
  } catch (error) {
    return getCoursePublicationActionError(
      error,
      "Não foi possível preparar as alterações. Tente novamente."
    );
  }
};

export const publishCoursePublicationAction = async (
  courseId: string
): Promise<CoursePublicationActionResult> => {
  try {
    const session = await requireRole(["admin"]);
    const result = await publishCoursePublication({
      actorUserId: session.user.id,
      courseId,
    });

    if (result === "no_draft") {
      return {
        message: "Não há alterações em preparo para publicar.",
        ok: false,
      };
    }

    revalidateAdmin();
    return { ok: true };
  } catch (error) {
    return getCoursePublicationActionError(
      error,
      "Não foi possível publicar as alterações. Tente novamente."
    );
  }
};

export const saveModuleAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  await saveModule({ actorUserId: session.user.id, formData });
  revalidateAdmin();
};

export const createLessonDraftAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(["admin"]);
  const { courseId, lessonId } = await createLessonDraft({
    actorUserId: session.user.id,
    formData,
  });
  revalidateAdmin();

  // biome-ignore lint/suspicious/noExplicitAny: Next.js typed routes workaround
  redirect(buildAdminLessonEditPath({ courseId, lessonId }) as any);
};

export const saveLessonAction = async (
  formData: FormData
): Promise<LessonSaveActionResult> => {
  const correlationId = await getActionCorrelationId();
  const submittedLessonId = String(formData.get("lessonId") ?? "").trim();

  try {
    const saved = await observeOperation({
      ...(submittedLessonId ? { aggregateId: submittedLessonId } : {}),
      correlationId,
      execute: async () => {
        const session = await requireRole(["admin"]);
        return await saveLesson({ actorUserId: session.user.id, formData });
      },
      failureErrorCode: "lesson_save_failed",
      operation: "admin.lesson.save",
      provider: "database",
    });

    revalidateAdmin();
    if (saved.lessonId && saved.courseId) {
      revalidatePath(
        buildAdminLessonEditPath({
          courseId: saved.courseId,
          lessonId: saved.lessonId,
        })
      );
    }
    return { ok: true };
  } catch (error) {
    return getLessonSaveActionFailure(error, correlationId);
  }
};

export const saveLessonFormAction = async (
  formData: FormData
): Promise<void> => {
  await saveLessonAction(formData);
};

export const ensureJmvstreamCourseFolderAction = async (
  courseId: string
): Promise<void> => {
  await requireRole(["admin"]);
  await ensureJmvstreamCourseFolder(courseId);
  revalidateAdmin();
};

export const initJmvstreamUploadAction = async (input: {
  fileName: string;
  fileSize: number;
  lessonId: string;
  uploadType: "direct" | "multipart";
}): Promise<
  | { data: Awaited<ReturnType<typeof initJmvstreamUpload>>; ok: true }
  | { error: string; ok: false }
> => {
  await requireRole(["admin"]);

  try {
    return {
      data: await initJmvstreamUpload(input),
      ok: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar o upload JMVStream.",
      ok: false,
    };
  }
};

export const completeJmvstreamUploadAction = async (input: {
  filename: string;
  lessonId: string;
  objectName: string;
  parts: Array<{
    ETag?: string;
    PartNumber?: number;
    etag?: string;
    partNumber?: number;
  }>;
  size: number;
  uploadSessionId: string;
  uploadId: string;
  videoHash: string;
}): Promise<void> => {
  await requireRole(["admin"]);
  await completeJmvstreamUpload(input);
  revalidateAdmin();
};

export const syncJmvstreamLessonPlayerAction = async (input: {
  lessonId: string;
}): Promise<{ playerUrl: null | string; ready: boolean }> => {
  await requireRole(["admin"]);
  const result = await syncJmvstreamLessonPlayer(input.lessonId);

  if (result.ready) {
    revalidateAdmin();
  }

  return result;
};

export const removeJmvstreamVideoFromLessonAction = async (input: {
  lessonId: string;
}): Promise<{ deletePending: boolean }> => {
  const session = await requireRole(["admin"]);
  const { courseId, deletePending } = await removeLessonVideo({
    actorUserId: session.user.id,
    lessonId: input.lessonId,
  });
  revalidateAdmin();
  revalidatePath(
    buildAdminLessonEditPath({ courseId, lessonId: input.lessonId.trim() })
  );

  return { deletePending };
};

export const markJmvstreamUploadFailedAction = async (input: {
  lastError: string;
  videoHash: string;
}): Promise<void> => {
  await requireRole(["admin"]);
  await markJmvstreamUploadFailed(input);
  revalidateAdmin();
};

export const discardJmvstreamUploadAction = async (input: {
  assetId: string;
}): Promise<void> => {
  await requireRole(["admin"]);
  await discardJmvstreamUpload(input);
  revalidateAdmin();
};

export const retryJmvstreamDeleteAction = async ({
  assetId,
}: {
  assetId: string;
}): Promise<{ error: string; ok: false } | { ok: true }> => {
  await requireRole(["admin"]);
  try {
    await retryJmvstreamAssetDelete(assetId);
    revalidateAdmin();
    return { ok: true };
  } catch (error) {
    revalidateAdmin();
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel apagar o video na JMVStream.",
    };
  }
};

export const extendEnrollmentExpirationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentSupport");
  const { days, enrollmentId, months, reason } =
    parseExtendEnrollmentExpirationInput(formData);
  const { extendEnrollmentExpiration } = await import(
    "@/features/enrollments/server"
  );

  await extendEnrollmentExpiration({
    actorUserId: session.user.id,
    enrollmentId,
    reason,
    ...(days === null ? {} : { days }),
    ...(months === null ? {} : { months }),
  });
  await audit({
    action: "enrollment.expiration_extended",
    actorUserId: session.user.id,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
  revalidateAdmin();
};

export const setEnrollmentExpirationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentSupport");
  const { enrollmentId, newExpiresAt, reason } =
    parseSetEnrollmentExpirationInput(formData);
  const { setEnrollmentExpiration } = await import(
    "@/features/enrollments/server"
  );

  const result = await setEnrollmentExpiration({
    actorUserId: session.user.id,
    enrollmentId,
    newExpiresAt,
    reason,
  });
  await auditEnrollmentExpirationChange({
    actorUserId: session.user.id,
    enrollmentId,
    result,
  });
  revalidateAdmin();
};

export const adjustEnrollmentExpirationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentSupport");
  const { adjustment, enrollmentId, newExpiresAtValue, reason } =
    parseAdjustEnrollmentExpirationInput(formData);

  if (adjustment === "set_exact") {
    const newExpiresAt = parseExpirationDateSelection(newExpiresAtValue);
    const { setEnrollmentExpiration } = await import(
      "@/features/enrollments/server"
    );
    const result = await setEnrollmentExpiration({
      actorUserId: session.user.id,
      enrollmentId,
      newExpiresAt,
      reason,
    });
    await auditEnrollmentExpirationChange({
      actorUserId: session.user.id,
      enrollmentId,
      result,
    });
    revalidateEnrollmentAdminPaths();
    return;
  }

  throw new Error("Escolha uma nova data de expiracao.");
};

export const blockEnrollmentAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentSupport");
  const { enrollmentId, reason } = parseEnrollmentAccessInput(formData);

  const { blockEnrollmentAccess } = await import(
    "@/features/enrollments/server"
  );
  await blockEnrollmentAccess({
    actorUserId: session.user.id,
    enrollmentId,
    reason,
  });
  await audit({
    action: "enrollment.access_blocked",
    actorUserId: session.user.id,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
  revalidateEnrollmentAdminPaths();
};

export const grantEnrollmentFullContentAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentAccess");
  const input = parseGrantEnrollmentFullContentAccessInput(formData);
  const { grantEnrollmentFullContentAccess } = await import(
    "@/features/enrollments/server"
  );
  await grantEnrollmentFullContentAccess({
    actorUserId: session.user.id,
    ...input,
  });
  revalidateEnrollmentAdminPaths();
};

export const restoreEnrollmentAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentSupport");
  const { enrollmentId, reason } = parseEnrollmentAccessInput(formData);

  const { restoreEnrollmentAccess } = await import(
    "@/features/enrollments/server"
  );
  await restoreEnrollmentAccess({
    actorUserId: session.user.id,
    enrollmentId,
    reason,
  });
  await audit({
    action: "enrollment.access_restored",
    actorUserId: session.user.id,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
  revalidateEnrollmentAdminPaths();
};

export const blockStudentPlatformAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentAccess");
  const { reason, userId } = parseStudentPlatformAccessInput(
    formData,
    "Informe o motivo do bloqueio."
  );

  await getPool().query(
    `
      update profiles
      set platform_blocked_at = now(),
          platform_blocked_reason = $2,
          updated_at = now()
      where user_id = $1
        and role = 'student'
    `,
    [userId, reason]
  );
  await audit({
    action: "student.platform_blocked",
    actorUserId: session.user.id,
    targetId: userId,
    targetType: "student",
  });
  revalidateEnrollmentAdminPaths();
};

export const restoreStudentPlatformAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentAccess");
  const { userId } = parseStudentPlatformAccessInput(
    formData,
    "Informe o motivo da restauracao."
  );

  await getPool().query(
    `
      update profiles
      set platform_blocked_at = null,
          platform_blocked_reason = null,
          updated_at = now()
      where user_id = $1
        and role = 'student'
    `,
    [userId]
  );
  await audit({
    action: "student.platform_restored",
    actorUserId: session.user.id,
    targetId: userId,
    targetType: "student",
  });
  revalidateEnrollmentAdminPaths();
};

export const saveFaqAction = async (formData: FormData): Promise<void> => {
  const session = await requirePermission("manageContent");
  const faqId = readString(formData, "faqId");
  const question = readString(formData, "question");
  const answer = readString(formData, "answer");
  const sortOrder = readNumber(formData, "sortOrder");
  const isPublished = readCheckbox(formData, "isPublished");

  if (!(question && answer)) {
    throw new Error("Informe a pergunta e a resposta da FAQ.");
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const previous = faqId
      ? await client.query<{
          answer: string;
          is_published: boolean;
          question: string;
          sort_order: number;
        }>(
          `
            select question, answer, sort_order, is_published
            from faq_items
            where id = $1
            for update
          `,
          [faqId]
        )
      : { rows: [] };
    const previousFaq = previous.rows[0];
    if (faqId && !previousFaq) {
      throw new Error("FAQ invalido.");
    }

    let savedFaqId = faqId;
    if (faqId) {
      await client.query(
        `
          update faq_items
          set question = $1,
              answer = $2,
              sort_order = $3,
              is_published = $4,
              updated_at = now()
          where id = $5
        `,
        [question, answer, sortOrder, isPublished, faqId]
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        `
          insert into faq_items (question, answer, sort_order, is_published)
          values ($1, $2, $3, $4)
          returning id
        `,
        [question, answer, sortOrder, isPublished]
      );
      savedFaqId = inserted.rows[0]?.id ?? "";
      if (!savedFaqId) {
        throw new Error("Não foi possível criar a FAQ.");
      }
    }

    const before = {
      answer: truncateAuditText(previousFaq?.answer ?? null),
      isPublished: previousFaq?.is_published ?? null,
      question: truncateAuditText(previousFaq?.question ?? null),
      sortOrder: previousFaq?.sort_order ?? null,
    };
    const after = {
      answer: truncateAuditText(answer),
      isPublished,
      question: truncateAuditText(question),
      sortOrder,
    };
    await audit({
      action: faqId ? "faq.updated" : "faq.created",
      actorUserId: session.user.id,
      client,
      metadata: {
        changes: getAuditChanges(before, after),
        targetLabelAfter: question,
        ...(previousFaq ? { targetLabelBefore: previousFaq.question } : {}),
      },
      targetId: savedFaqId,
      targetType: "faq",
    });
    await client.query("COMMIT");
  } catch (error) {
    await rollbackTransaction(client);
    throw error;
  } finally {
    client.release();
  }
  revalidateAdmin();
};

export const deleteFaqAction = async (formData: FormData): Promise<void> => {
  const session = await requirePermission("manageContent");
  const faqId = readString(formData, "faqId");

  if (!faqId) {
    throw new Error("FAQ invalido.");
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query<{
      answer: string;
      is_published: boolean;
      question: string;
      sort_order: number;
    }>(
      `
        select question, answer, sort_order, is_published
        from faq_items
        where id = $1
        for update
      `,
      [faqId]
    );
    const previousFaq = previous.rows[0];
    if (!previousFaq) {
      throw new Error("FAQ invalido.");
    }
    await client.query("delete from faq_items where id = $1", [faqId]);
    await audit({
      action: "faq.deleted",
      actorUserId: session.user.id,
      client,
      metadata: {
        changes: getAuditChanges(
          {
            answer: truncateAuditText(previousFaq.answer),
            isPublished: previousFaq.is_published,
            question: truncateAuditText(previousFaq.question),
            sortOrder: previousFaq.sort_order,
          },
          {
            answer: null,
            isPublished: null,
            question: null,
            sortOrder: null,
          }
        ),
        targetLabelBefore: previousFaq.question,
      },
      targetId: faqId,
      targetType: "faq",
    });
    await client.query("COMMIT");
  } catch (error) {
    await rollbackTransaction(client);
    throw error;
  } finally {
    client.release();
  }
  revalidateAdmin();
};

export const reorderFaqsAction = async (
  orderedFaqIds: string[]
): Promise<void> => {
  const session = await requirePermission("manageContent");

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentFaqs = await client.query<{
      id: string;
      question: string;
      sort_order: number;
    }>(
      `
        select id, question, sort_order
        from faq_items
        order by sort_order, id
        for update
      `
    );
    if (
      !hasExactlyTheSameIds(
        orderedFaqIds,
        currentFaqs.rows.map((faq) => faq.id)
      )
    ) {
      throw new Error("Ordem de FAQ inválida.");
    }

    // Pass 1: Set to temporary negative order to avoid unique constraint violations
    for (let i = 0; i < orderedFaqIds.length; i++) {
      await client.query("update faq_items set sort_order = $1 where id = $2", [
        -(i + 1),
        orderedFaqIds[i],
      ]);
    }

    // Pass 2: Set to final correct order
    for (let i = 0; i < orderedFaqIds.length; i++) {
      await client.query(
        "update faq_items set sort_order = $1, updated_at = now() where id = $2",
        [i + 1, orderedFaqIds[i]]
      );
    }

    const questionById = new Map(
      currentFaqs.rows.map((faq) => [faq.id, faq.question])
    );
    await audit({
      action: "faq.reordered",
      actorUserId: session.user.id,
      client,
      metadata: {
        changes: getAuditChanges(
          {
            order: currentFaqs.rows.map((faq) => faq.question),
          },
          {
            order: orderedFaqIds.map(
              (faqId) => questionById.get(faqId) ?? faqId
            ),
          }
        ),
      },
      targetType: "faq",
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidateAdmin();
};

export const saveSettingsAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);

  const certificateSignerName =
    readString(formData, "certificateSignerName") || null;
  const certificateSignerRole =
    readString(formData, "certificateSignerRole") || null;
  const legalName = readString(formData, "issuerLegalName");
  const displayName = readString(formData, "issuerDisplayName");
  const cnpjInput = readString(formData, "issuerCnpj");

  if (Boolean(legalName) !== Boolean(cnpjInput)) {
    throw new Error(
      "Preencha razão social e CNPJ para manter o perfil emissor completo."
    );
  }
  if (!(legalName && cnpjInput)) {
    throw new Error(
      "Informe razão social e CNPJ para salvar o perfil emissor."
    );
  }
  const cnpj = normalizeCnpj(cnpjInput);
  if (!cnpj) {
    throw new Error("Informe um CNPJ válido com 14 dígitos.");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const settingsResult = await client.query<{
      certificate_signer_name: string | null;
      certificate_signer_role: string | null;
    }>(
      `
        select certificate_signer_name, certificate_signer_role
        from app_settings
        where id = 'global'
        for update
      `
    );
    const issuerResult = await client.query<{
      cnpj: string;
      display_name: string;
      legal_name: string;
    }>(
      `
        select cnpj, display_name, legal_name
        from certificate_issuer_profiles
        where id = 'global'
        for update
      `
    );

    const currentSettings = settingsResult.rows[0];
    const currentIssuer = issuerResult.rows[0];
    const before = {
      certificateSignerName: currentSettings?.certificate_signer_name ?? null,
      certificateSignerRole: currentSettings?.certificate_signer_role ?? null,
      issuerCnpj: maskCnpjForAudit(currentIssuer?.cnpj ?? null),
      issuerDisplayName: currentIssuer?.display_name ?? null,
      issuerLegalName: currentIssuer?.legal_name ?? null,
    };

    await client.query(
      `
        insert into app_settings (
          id,
          certificate_signer_name,
          certificate_signer_role
        )
        values ('global', $1, $2)
        on conflict (id) do update set
          certificate_signer_name = excluded.certificate_signer_name,
          certificate_signer_role = excluded.certificate_signer_role,
          updated_at = now()
      `,
      [certificateSignerName, certificateSignerRole]
    );

    await client.query(
      `
        insert into certificate_issuer_profiles (
          id,
          legal_name,
          cnpj,
          display_name
        )
        values ('global', $1, $2, $3)
        on conflict (id) do update set
          legal_name = excluded.legal_name,
          cnpj = excluded.cnpj,
          display_name = excluded.display_name,
          updated_at = now()
      `,
      [legalName, cnpj, displayName || legalName]
    );

    const after = {
      certificateSignerName,
      certificateSignerRole,
      issuerCnpj: maskCnpjForAudit(cnpj || null),
      issuerDisplayName: displayName || legalName,
      issuerLegalName: legalName,
    };

    await audit({
      action: "settings.updated",
      actorUserId: session.user.id,
      client,
      metadata: {
        changes: getAuditChanges(before, after),
        targetLabelAfter: "Configurações globais",
        targetLabelBefore: "Configurações globais",
      },
      targetId: "global",
      targetType: "settings",
    });

    await client.query("COMMIT");
  } catch (error) {
    await rollbackTransaction(client);
    throw error;
  } finally {
    client.release();
  }

  revalidateAdmin();
};

const readStagedImageReference = (
  formData: FormData,
  key: string
): ReturnType<typeof parseStagedAdminImageReference> => {
  const value = readString(formData, key);
  if (!value) {
    return null;
  }

  try {
    const reference = parseStagedAdminImageReference(
      JSON.parse(value) as unknown
    );
    if (reference) {
      return reference;
    }
  } catch {
    // The domain error below is intentionally stable for malformed JSON.
  }

  throw new CertificateTemplateDomainError("Upload temporario invalido.");
};

const persistCertificateTemplateDraft = async ({
  actorUserId,
  formData,
}: {
  actorUserId: string;
  formData: FormData;
}): Promise<void> => {
  const courseId = readString(formData, "courseId");
  const specValue = readString(formData, "spec");
  const backgroundUpload = readStagedImageReference(
    formData,
    "backgroundUpload"
  );
  const signatureUpload = readStagedImageReference(formData, "signatureUpload");
  if (!(courseId && specValue)) {
    throw new CertificateTemplateDomainError(
      "Template de certificado invalido."
    );
  }
  const spec = parseCertificateTemplateSubmission(specValue);
  let signatureKey = readString(formData, "signatureKey") || null;
  const persistWithFiles = async (
    background: File | null,
    signature: File | null
  ): Promise<void> => {
    await runCertificateTemplateAssetMutation({
      courseId,
      operation: async (trackUploadedKey) => {
        if (background?.size) {
          spec.backgroundKey = await uploadCertificateBackground({
            courseId,
            file: background,
          });
          trackUploadedKey(spec.backgroundKey);
        }
        const nextSignatureKey = signature?.size
          ? await uploadCertificateSignature({ courseId, file: signature })
          : signatureKey;
        if (signature?.size && nextSignatureKey) {
          trackUploadedKey(nextSignatureKey);
        }
        signatureKey = nextSignatureKey;
        return await saveCertificateTemplateDraft({
          actorUserId,
          courseId,
          signerName: readString(formData, "signerName") || null,
          signerRole: readString(formData, "signerRole") || null,
          signatureKey: nextSignatureKey,
          spec,
        });
      },
    });
  };

  const uploads = [
    ...(backgroundUpload
      ? [
          {
            purpose: "certificate-background" as const,
            reference: backgroundUpload,
          },
        ]
      : []),
    ...(signatureUpload
      ? [
          {
            purpose: "certificate-signature" as const,
            reference: signatureUpload,
          },
        ]
      : []),
  ];
  if (uploads.length > 0) {
    await consumeStagedAdminImageUploads({
      actorUserId,
      aggregateId: courseId,
      operation: async (files) => {
        const background = backgroundUpload ? (files.shift() ?? null) : null;
        const signature = signatureUpload ? (files.shift() ?? null) : null;
        await persistWithFiles(background, signature);
      },
      uploads,
    });
  } else {
    await persistWithFiles(null, null);
  }
};

export const saveCertificateTemplateDraftFormAction = async (
  _previousState: CertificateTemplateActionState,
  formData: FormData
): Promise<CertificateTemplateActionState> => {
  try {
    const session = await requireRole(["admin"]);
    await persistCertificateTemplateDraft({
      actorUserId: session.user.id,
      formData,
    });
    return { message: "Rascunho salvo.", status: "success" };
  } catch (error) {
    const message = getExpectedCertificateTemplateActionMessage(error);
    if (!message) {
      throw error;
    }
    return {
      fieldErrors: { template: "Revise os campos destacados." },
      message,
      status: "error",
    };
  }
};

export const publishCertificateTemplateFormAction = async (
  _previousState: CertificateTemplateActionState,
  formData: FormData
): Promise<CertificateTemplateActionState> => {
  try {
    const session = await requireRole(["admin"]);
    await saveAndPublishCertificateTemplate({
      formData,
      publishDraft: (courseId) =>
        publishCertificateTemplate(courseId, session.user.id),
      saveDraft: async (draftFormData) => {
        await persistCertificateTemplateDraft({
          actorUserId: session.user.id,
          formData: draftFormData,
        });
      },
    });
    return {
      message: "Alteracoes salvas e certificado publicado.",
      status: "success",
    };
  } catch (error) {
    const message = getExpectedCertificateTemplateActionMessage(error);
    if (!message) {
      throw error;
    }
    return {
      message,
      status: "error",
    };
  }
};

export const disableCertificateForCourseAction = async (
  courseId: string
): Promise<void> => {
  const session = await requireRole(["admin"]);
  await disableCertificateForCourse(courseId, session.user.id);
  revalidateAdmin();
};

export const enableCertificateForCourseAction = async (
  courseId: string
): Promise<void> => {
  const session = await requireRole(["admin"]);
  await enableCertificateForCourse(courseId, session.user.id);
  revalidateAdmin();
};

export const reorderModulesAction = async (
  courseId: string,
  orderedModuleIds: string[]
): Promise<CourseContentReorderResult> => {
  const correlationId = await getActionCorrelationId();

  try {
    await observeOperation({
      aggregateId: courseId,
      correlationId,
      execute: async () => {
        const session = await requireRole(["admin"]);
        const client = await getPool().connect();
        try {
          await client.query("BEGIN");
          await lockCourseContentRelease(client, courseId);
          const expectedModules = await client.query<{
            id: string;
            sort_order: number;
            title: string;
          }>(
            `
              select m.id, m.title, m.sort_order
              from modules m
              inner join course_publications cp on cp.id = m.course_publication_id
              where m.course_id = $1 and cp.status = 'draft'
              order by m.sort_order
              for update
            `,
            [courseId]
          );

          if (
            !hasExactlyTheSameIds(
              orderedModuleIds,
              expectedModules.rows.map((module) => module.id)
            )
          ) {
            throw new Error("Invalid module order.");
          }

          for (let i = 0; i < orderedModuleIds.length; i++) {
            await client.query(
              "update modules set sort_order = $1 where id = $2 and course_id = $3",
              [-(i + 1), orderedModuleIds[i], courseId]
            );
          }

          for (let i = 0; i < orderedModuleIds.length; i++) {
            await client.query(
              "update modules set sort_order = $1, updated_at = now() where id = $2 and course_id = $3",
              [i + 1, orderedModuleIds[i], courseId]
            );
          }

          const moduleTitleById = new Map(
            expectedModules.rows.map((module) => [module.id, module.title])
          );
          await audit({
            action: "modules.reordered",
            actorUserId: session.user.id,
            client,
            metadata: {
              changes: {
                order: {
                  after: orderedModuleIds.map(
                    (moduleId) => moduleTitleById.get(moduleId) ?? moduleId
                  ),
                  before: [...expectedModules.rows]
                    .sort((left, right) => left.sort_order - right.sort_order)
                    .map((module) => module.title),
                },
              },
              targetLabelAfter: "Conteúdo do Curso",
            },
            targetId: courseId,
            targetType: "course",
          });
          await client.query("COMMIT");
          revalidateAdmin();
        } catch (error) {
          await rollbackTransaction(client);
          throw error;
        } finally {
          client.release();
        }
      },
      failureErrorCode: "course_module_reorder_failed",
      operation: "course_content.reorder_modules",
      provider: "database",
    });
    return { ok: true };
  } catch {
    return { message: REORDER_FAILURE_MESSAGE, ok: false };
  }
};

export const reorderLessonsAction = async (
  courseId: string,
  reorderGroups: LessonReorderGroup[]
): Promise<CourseContentReorderResult> => {
  const correlationId = await getActionCorrelationId();

  try {
    await observeOperation({
      aggregateId: courseId,
      correlationId,
      execute: async () => {
        const session = await requireRole(["admin"]);
        const client = await getPool().connect();
        try {
          await client.query("BEGIN");
          await lockCourseContentRelease(client, courseId);
          const moduleIds = reorderGroups.map((group) => group.moduleId);
          const orderedLessonIds = reorderGroups.flatMap(
            (group) => group.lessonIds
          );

          if (
            moduleIds.length === 0 ||
            new Set(moduleIds).size !== moduleIds.length ||
            new Set(orderedLessonIds).size !== orderedLessonIds.length
          ) {
            throw new Error("Invalid lesson order.");
          }

          const modules = await client.query<{
            course_publication_id: string;
            id: string;
            title: string;
          }>(
            `
              select m.id, m.course_publication_id, m.title
              from modules m
              inner join course_publications cp on cp.id = m.course_publication_id
              where m.course_id = $1 and m.id = any($2::uuid[]) and cp.status = 'draft'
              for update
            `,
            [courseId, moduleIds]
          );

          if (modules.rows.length !== moduleIds.length) {
            throw new Error("Invalid lesson module.");
          }

          const coursePublicationId = modules.rows[0]?.course_publication_id;
          if (
            !coursePublicationId ||
            modules.rows.some(
              (module) => module.course_publication_id !== coursePublicationId
            )
          ) {
            throw new Error("Invalid lesson publication.");
          }

          const expectedLessons = await client.query<{
            id: string;
            module_title: string;
            sort_order: number;
            title: string;
          }>(
            `
              select l.id, l.title, l.sort_order, m.title as module_title
              from lessons l
              join modules m on m.id = l.module_id
              where l.module_id = any($1::uuid[])
              order by m.sort_order, l.sort_order
              for update of l
            `,
            [moduleIds]
          );

          if (
            !hasExactlyTheSameIds(
              orderedLessonIds,
              expectedLessons.rows.map((lesson) => lesson.id)
            )
          ) {
            throw new Error("Invalid lesson order.");
          }

          let temporaryOrder = -1;
          for (const lessonId of orderedLessonIds) {
            await client.query(
              "update lessons set sort_order = $1 where id = $2",
              [temporaryOrder, lessonId]
            );
            temporaryOrder--;
          }

          for (const group of reorderGroups) {
            for (let i = 0; i < group.lessonIds.length; i++) {
              await client.query(
                "update lessons set sort_order = $1, module_id = $3, updated_at = now() where id = $2",
                [i + 1, group.lessonIds[i], group.moduleId]
              );
            }
          }

          const lessonTitleById = new Map(
            expectedLessons.rows.map((lesson) => [lesson.id, lesson.title])
          );
          const moduleTitleById = new Map(
            modules.rows.map((module) => [module.id, module.title])
          );
          const formatLessonOrder = (moduleId: string, lessonId: string) =>
            `${moduleTitleById.get(moduleId) ?? "Módulo"} · ${lessonTitleById.get(lessonId) ?? lessonId}`;
          await audit({
            action: "lessons.reordered",
            actorUserId: session.user.id,
            client,
            metadata: {
              changes: {
                order: {
                  after: reorderGroups.flatMap((group) =>
                    group.lessonIds.map((lessonId) =>
                      formatLessonOrder(group.moduleId, lessonId)
                    )
                  ),
                  before: expectedLessons.rows.map(
                    (lesson) => `${lesson.module_title} · ${lesson.title}`
                  ),
                },
              },
              targetLabelAfter: "Conteúdo do Curso",
            },
            targetId: courseId,
            targetType: "course",
          });
          await client.query("COMMIT");
          revalidateAdmin();
        } catch (error) {
          await rollbackTransaction(client);
          throw error;
        } finally {
          client.release();
        }
      },
      failureErrorCode: "course_lesson_reorder_failed",
      operation: "course_content.reorder_lessons",
      provider: "database",
    });
    return { ok: true };
  } catch {
    return { message: REORDER_FAILURE_MESSAGE, ok: false };
  }
};

const assertBannerLink = ({
  buttonText,
  linkUrl,
}: {
  buttonText: string | null;
  linkUrl: string | null;
}): void => {
  if ((linkUrl && !buttonText) || (!linkUrl && buttonText)) {
    throw new Error(
      "Se você informar um link, o texto do botão é obrigatório, e vice-versa."
    );
  }
};

const synchronizeBannerObjects = async ({
  isActive,
  nextImageKey,
  previousImageKey,
}: {
  isActive: boolean;
  nextImageKey: string | null;
  previousImageKey: string | null;
}): Promise<void> => {
  if (!nextImageKey) {
    throw new Error("Imagem do banner indisponível.");
  }

  if (isActive) {
    await publishR2Object(nextImageKey);
  } else {
    await deletePublicR2Objects([nextImageKey]);
  }

  if (previousImageKey && previousImageKey !== nextImageKey) {
    await Promise.all([
      deleteR2Objects([previousImageKey]),
      deletePublicR2Objects([previousImageKey]),
    ]);
  }
};

const parseOptionalStagedImageUpload = (
  value: string
): StagedAdminImageReference | null => {
  if (!value) {
    return null;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value) as unknown;
  } catch {
    throw new Error("Upload temporario invalido.");
  }

  const reference = parseStagedAdminImageReference(parsedValue);
  if (!reference) {
    throw new Error("Upload temporario invalido.");
  }

  return reference;
};

const persistDashboardBanner = async ({
  actorUserId,
  buttonText,
  existingBannerId,
  imageFile,
  isActive,
  linkUrl,
  newBannerId,
}: {
  actorUserId: string;
  buttonText: string | null;
  existingBannerId: string;
  imageFile: File | null;
  isActive: boolean;
  linkUrl: string | null;
  newBannerId: string;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: banner persistence coordinates database, storage, and audit lifecycle
}): Promise<{ bannerId: string }> => {
  assertBannerLink({ buttonText, linkUrl });

  const pool = getPool();
  let bannerId = existingBannerId || newBannerId;
  let previousBlurDataUrl: string | null = null;
  let previousImageKey: string | null = null;
  let nextBlurDataUrl: string | null = null;
  let nextImageKey: string | null = null;
  let auditBefore: Record<string, AuditMetadataValue> = {};
  let auditAfter: Record<string, AuditMetadataValue> = {};
  let auditTargetLabelBefore: string | null = null;

  if (existingBannerId) {
    const previous = await pool.query<{
      blur_data_url: string | null;
      button_text: string | null;
      image_url: string;
      is_active: boolean;
      link_url: string | null;
      sort_order: number;
    }>(
      "select image_url, blur_data_url, link_url, button_text, is_active, sort_order from dashboard_banners where id = $1 limit 1",
      [existingBannerId]
    );
    const previousBanner = previous.rows[0];
    previousImageKey = previousBanner?.image_url ?? null;
    previousBlurDataUrl = previousBanner?.blur_data_url ?? null;

    if (!previousImageKey) {
      throw new Error("Banner inválido.");
    }
    auditBefore = {
      buttonText: previousBanner?.button_text ?? null,
      imageReplaced: false,
      isActive: previousBanner?.is_active ?? false,
      linkUrl: previousBanner?.link_url ?? null,
      sortOrder: previousBanner?.sort_order ?? null,
    };
    auditTargetLabelBefore =
      previousBanner?.button_text ?? "Banner do Dashboard";

    if (imageFile && imageFile.size > 0) {
      const uploadedBanner = await uploadDashboardBannerFile({
        file: imageFile,
      });
      nextImageKey = uploadedBanner.key;
      nextBlurDataUrl = uploadedBanner.blurDataUrl;
      await pool.query(
        "update dashboard_banners set image_url = $1, blur_data_url = $2, link_url = $3, button_text = $4, is_active = $5, updated_at = now() where id = $6",
        [
          nextImageKey,
          nextBlurDataUrl,
          linkUrl,
          buttonText,
          isActive,
          existingBannerId,
        ]
      );
    } else {
      nextImageKey = previousImageKey;
      nextBlurDataUrl = previousBlurDataUrl;
      await pool.query(
        "update dashboard_banners set link_url = $1, button_text = $2, is_active = $3, updated_at = now() where id = $4",
        [linkUrl, buttonText, isActive, existingBannerId]
      );
    }
    auditAfter = {
      buttonText,
      imageReplaced: Boolean(imageFile && imageFile.size > 0),
      isActive,
      linkUrl,
      sortOrder: previousBanner?.sort_order ?? null,
    };
  } else {
    if (!imageFile || imageFile.size === 0) {
      throw new Error("A imagem do banner é obrigatória.");
    }

    const countRes = await pool.query("select count(*) from dashboard_banners");
    if (Number(countRes.rows[0].count) >= 5) {
      throw new Error(
        "Limite de 5 banners atingido. Remova um antes de adicionar outro."
      );
    }

    const uploadedBanner = await uploadDashboardBannerFile({
      file: imageFile,
    });
    nextImageKey = uploadedBanner.key;
    nextBlurDataUrl = uploadedBanner.blurDataUrl;
    const maxSortRes = await pool.query(
      "select coalesce(max(sort_order), 0) as max_sort from dashboard_banners"
    );
    const nextSortOrder = Number(maxSortRes.rows[0].max_sort) + 1;

    const insertRes = await pool.query(
      `
        insert into dashboard_banners (id, image_url, blur_data_url, link_url, button_text, is_active, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id
      `,
      [
        newBannerId,
        nextImageKey,
        nextBlurDataUrl,
        linkUrl,
        buttonText,
        isActive,
        nextSortOrder,
      ]
    );
    bannerId = insertRes.rows[0].id;
    auditBefore = {
      buttonText: null,
      isActive: null,
      linkUrl: null,
      sortOrder: null,
    };
    auditAfter = {
      buttonText,
      isActive,
      linkUrl,
      sortOrder: nextSortOrder,
    };
  }

  await synchronizeBannerObjects({
    isActive,
    nextImageKey,
    previousImageKey,
  });

  await audit({
    action: existingBannerId ? "banner.updated" : "banner.created",
    actorUserId,
    metadata: {
      changes: getAuditChanges(auditBefore, auditAfter),
      targetLabelAfter: buttonText ?? "Banner do Dashboard",
      ...(auditTargetLabelBefore
        ? { targetLabelBefore: auditTargetLabelBefore }
        : {}),
    },
    targetId: bannerId || undefined,
    targetType: "banner",
  });
  revalidateAdmin();
  return { bannerId };
};

export const saveBannerAction = async (
  formData: FormData
): Promise<{ bannerId?: string } | undefined> => {
  const session = await requirePermission("manageSettings");
  const existingBannerId = readString(formData, "bannerId");
  const linkUrl = readString(formData, "linkUrl") || null;
  const buttonText = readString(formData, "buttonText") || null;
  const isActive = readCheckbox(formData, "isActive");
  const imageUpload = parseOptionalStagedImageUpload(
    readString(formData, "imageUpload")
  );
  const newBannerId =
    imageUpload?.aggregateId || readString(formData, "newBannerId");
  const persist = async (imageFile: File | null) =>
    await persistDashboardBanner({
      actorUserId: session.user.id,
      buttonText,
      existingBannerId,
      imageFile,
      isActive,
      linkUrl,
      newBannerId,
    });

  if (!imageUpload) {
    return await persist(null);
  }

  return await consumeStagedAdminImageUpload({
    actorUserId: session.user.id,
    aggregateId: existingBannerId || newBannerId,
    operation: persist,
    purpose: "dashboard-banner",
    reference: imageUpload,
  });
};

export const deleteBannerAction = async (formData: FormData): Promise<void> => {
  const session = await requirePermission("manageSettings");
  const bannerId = readString(formData, "bannerId");

  if (!bannerId) {
    throw new Error("Banner inválido.");
  }

  const pool = getPool();
  const previous = await pool.query<{
    button_text: string | null;
    image_url: string;
    is_active: boolean;
    link_url: string | null;
    sort_order: number;
  }>(
    "select image_url, link_url, button_text, is_active, sort_order from dashboard_banners where id = $1 limit 1",
    [bannerId]
  );
  const previousBanner = previous.rows[0];
  const imageKey = previousBanner?.image_url;

  if (!imageKey) {
    throw new Error("Banner inválido.");
  }

  await pool.query("delete from dashboard_banners where id = $1", [bannerId]);
  await Promise.all([
    deleteR2Objects([imageKey]),
    deletePublicR2Objects([imageKey]),
  ]);
  await audit({
    action: "banner.deleted",
    actorUserId: session.user.id,
    metadata: {
      changes: getAuditChanges(
        {
          buttonText: previousBanner?.button_text ?? null,
          image: true,
          isActive: previousBanner?.is_active ?? false,
          linkUrl: previousBanner?.link_url ?? null,
          sortOrder: previousBanner?.sort_order ?? null,
        },
        {
          buttonText: null,
          image: false,
          isActive: null,
          linkUrl: null,
          sortOrder: null,
        }
      ),
      targetLabelBefore: previousBanner?.button_text ?? "Banner do Dashboard",
    },
    targetId: bannerId,
    targetType: "banner",
  });
  revalidateAdmin();
};

export const reorderBannersAction = async (
  orderedBannerIds: string[]
): Promise<void> => {
  const session = await requirePermission("manageSettings");

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentBanners = await client.query<{
      button_text: string | null;
      id: string;
      link_url: string | null;
      sort_order: number;
    }>(
      `
        select id, button_text, link_url, sort_order
        from dashboard_banners
        order by sort_order, id
        for update
      `
    );
    if (
      !hasExactlyTheSameIds(
        orderedBannerIds,
        currentBanners.rows.map((banner) => banner.id)
      )
    ) {
      throw new Error("Ordem de banner inválida.");
    }

    for (let i = 0; i < orderedBannerIds.length; i++) {
      await client.query(
        "update dashboard_banners set sort_order = $1 where id = $2",
        [-(i + 1), orderedBannerIds[i]]
      );
    }

    for (let i = 0; i < orderedBannerIds.length; i++) {
      await client.query(
        "update dashboard_banners set sort_order = $1, updated_at = now() where id = $2",
        [i + 1, orderedBannerIds[i]]
      );
    }

    const bannerLabel = (banner: {
      button_text: string | null;
      id: string;
      link_url: string | null;
      sort_order: number;
    }): string =>
      banner.button_text ?? banner.link_url ?? `Banner ${banner.sort_order}`;
    const bannerById = new Map(
      currentBanners.rows.map((banner) => [banner.id, banner])
    );
    await audit({
      action: "banners.reordered",
      actorUserId: session.user.id,
      client,
      metadata: {
        changes: getAuditChanges(
          { order: currentBanners.rows.map((banner) => bannerLabel(banner)) },
          {
            order: orderedBannerIds.map((bannerId) => {
              const banner = bannerById.get(bannerId);
              return banner ? bannerLabel(banner) : bannerId;
            }),
          }
        ),
      },
      targetType: "banner",
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidateAdmin();
};
