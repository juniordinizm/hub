"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/db";
import {
  createCoursePublicationDraft,
  createLessonDraft,
  publishCoursePublication,
  removeLessonVideo,
  saveCourse,
  saveLesson,
  saveModule,
} from "@/features/admin/authoring";
import {
  parseAdjustEnrollmentExpirationInput,
  parseEnrollmentAccessInput,
  parseExpirationDateSelection,
  parseExtendEnrollmentExpirationInput,
  parseSetEnrollmentExpirationInput,
  parseStudentPlatformAccessInput,
} from "@/features/admin/enrollment-command-input";
import { buildAdminLessonEditPath } from "@/features/admin/lesson-drafts";
import {
  disableCertificateForCourse,
  publishCertificateTemplate,
  saveCertificateTemplateDraft,
  uploadCertificateBackground,
  uploadCertificateSignature,
} from "@/features/certificates/templates";
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
import { rolesForPermission } from "@/lib/auth-policy";
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
  targetId,
  targetType,
}: {
  action: string;
  actorUserId: string;
  targetId?: string | undefined;
  targetType: string;
}) => {
  await getPool().query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id)
      values ($1, $2, $3, $4)
    `,
    [actorUserId, action, targetType, targetId ?? null]
  );
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

const revalidateEnrollmentAdminPaths = (userId: string): void => {
  revalidateAdmin();

  if (userId) {
    revalidatePath(`/admin/alunos/${userId}`);
  }
};

export const saveCourseAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  await saveCourse({ actorUserId: session.user.id, formData });
  revalidateAdmin();
};

export const createCoursePublicationDraftAction = async (
  courseId: string
): Promise<void> => {
  const session = await requireRole(["admin"]);
  await createCoursePublicationDraft({
    actorUserId: session.user.id,
    courseId,
  });
  revalidateAdmin();
};

export const publishCoursePublicationAction = async (
  courseId: string
): Promise<void> => {
  const session = await requireRole(["admin"]);
  await publishCoursePublication({ actorUserId: session.user.id, courseId });
  revalidateAdmin();
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

export const saveLessonAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const { courseId, lessonId } = await saveLesson({
    actorUserId: session.user.id,
    formData,
  });

  revalidateAdmin();
  if (lessonId && courseId) {
    revalidatePath(buildAdminLessonEditPath({ courseId, lessonId }));
  }
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
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const { days, enrollmentId, months, reason, userId } =
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

  if (userId) {
    revalidatePath(`/admin/alunos/${userId}`);
  }
};

export const setEnrollmentExpirationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const { enrollmentId, newExpiresAt, reason, userId } =
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

  if (userId) {
    revalidatePath(`/admin/alunos/${userId}`);
  }
};

export const adjustEnrollmentExpirationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const { adjustment, enrollmentId, newExpiresAtValue, reason, userId } =
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
    revalidateEnrollmentAdminPaths(userId);
    return;
  }

  throw new Error("Escolha uma nova data de expiracao.");
};

export const blockEnrollmentAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const { enrollmentId, reason, userId } = parseEnrollmentAccessInput(formData);

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
  revalidateEnrollmentAdminPaths(userId);
};

export const restoreEnrollmentAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const { enrollmentId, reason, userId } = parseEnrollmentAccessInput(formData);

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
  revalidateEnrollmentAdminPaths(userId);
};

export const blockStudentPlatformAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
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
  revalidateEnrollmentAdminPaths(userId);
};

export const restoreStudentPlatformAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
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
  revalidateEnrollmentAdminPaths(userId);
};

export const saveFaqAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const faqId = readString(formData, "faqId");
  const values = [
    readString(formData, "question"),
    readString(formData, "answer"),
    readNumber(formData, "sortOrder"),
    readCheckbox(formData, "isPublished"),
  ];

  if (faqId) {
    await getPool().query(
      `
        update faq_items
        set question = $1,
            answer = $2,
            sort_order = $3,
            is_published = $4,
            updated_at = now()
        where id = $5
      `,
      [...values, faqId]
    );
  } else {
    await getPool().query(
      `
        insert into faq_items (question, answer, sort_order, is_published)
        values ($1, $2, $3, $4)
      `,
      values
    );
  }

  await audit({
    action: "faq.saved",
    actorUserId: session.user.id,
    targetId: faqId || undefined,
    targetType: "faq",
  });
  revalidateAdmin();
};

export const deleteFaqAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const faqId = readString(formData, "faqId");

  if (!faqId) {
    throw new Error("FAQ invalido.");
  }

  await getPool().query("delete from faq_items where id = $1", [faqId]);
  await audit({
    action: "faq.deleted",
    actorUserId: session.user.id,
    targetId: faqId,
    targetType: "faq",
  });
  revalidateAdmin();
};

export const reorderFaqsAction = async (
  orderedFaqIds: string[]
): Promise<void> => {
  const session = await requireRole(["admin"]);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await audit({
    action: "faq.reordered",
    actorUserId: session.user.id,
    targetType: "faq",
  });
  revalidateAdmin();
};

export const saveSettingsAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  await getPool().query(
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
    [
      readString(formData, "certificateSignerName") || null,
      readString(formData, "certificateSignerRole") || null,
    ]
  );
  const legalName = readString(formData, "issuerLegalName");
  const displayName = readString(formData, "issuerDisplayName");
  const cnpj = readString(formData, "issuerCnpj");
  const courseFreeStatement = readString(formData, "issuerCourseFreeStatement");
  if (legalName && cnpj) {
    await getPool().query(
      `insert into certificate_issuer_profiles (id, legal_name, cnpj, display_name, course_free_statement)
     values ('global', $1, $2, $3, $4)
     on conflict (id) do update set legal_name = excluded.legal_name, cnpj = excluded.cnpj, display_name = excluded.display_name, course_free_statement = excluded.course_free_statement, updated_at = now()`,
      [
        legalName,
        cnpj,
        displayName || legalName,
        courseFreeStatement || "Certificado de conclusao de curso livre.",
      ]
    );
  }
  await audit({
    action: "settings.updated",
    actorUserId: session.user.id,
    targetId: "global",
    targetType: "settings",
  });
  revalidateAdmin();
};

export const saveCertificateTemplateDraftAction = async (
  formData: FormData
): Promise<void> => {
  await requireRole(["admin"]);
  const courseId = readString(formData, "courseId");
  const specValue = readString(formData, "spec");
  const background = formData.get("background") as File | null;
  const signature = formData.get("signature") as File | null;
  if (!(courseId && specValue)) {
    throw new Error("Template de certificado invalido.");
  }
  const spec = JSON.parse(
    specValue
  ) as import("@/features/certificates/template-rules").CertificateTemplateSpec;
  if (background?.size) {
    spec.backgroundKey = await uploadCertificateBackground({
      courseId,
      file: background,
    });
  }
  const signatureKey = signature?.size
    ? await uploadCertificateSignature({ courseId, file: signature })
    : readString(formData, "signatureKey") || null;
  await saveCertificateTemplateDraft({
    courseId,
    signerName: readString(formData, "signerName") || null,
    signerRole: readString(formData, "signerRole") || null,
    signatureKey,
    spec,
  });
  revalidateAdmin();
};

export const publishCertificateTemplateAction = async (
  courseId: string
): Promise<void> => {
  await requireRole(["admin"]);
  await publishCertificateTemplate(courseId);
  revalidateAdmin();
};

export const disableCertificateForCourseAction = async (
  courseId: string
): Promise<void> => {
  await requireRole(["admin"]);
  await disableCertificateForCourse(courseId);
  revalidateAdmin();
};

export const reorderModulesAction = async (
  courseId: string,
  orderedModuleIds: string[]
): Promise<void> => {
  const session = await requireRole(["admin"]);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pass 1: Set to temporary negative order to avoid unique constraint violations
    for (let i = 0; i < orderedModuleIds.length; i++) {
      await client.query(
        "update modules set sort_order = $1 where id = $2 and course_id = $3",
        [-(i + 1), orderedModuleIds[i], courseId]
      );
    }

    // Pass 2: Set to final correct order
    for (let i = 0; i < orderedModuleIds.length; i++) {
      await client.query(
        "update modules set sort_order = $1, updated_at = now() where id = $2 and course_id = $3",
        [i + 1, orderedModuleIds[i], courseId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await audit({
    action: "modules.reordered",
    actorUserId: session.user.id,
    targetId: courseId,
    targetType: "course",
  });
  revalidateAdmin();
};

export const reorderLessonsAction = async (
  moduleId: string,
  orderedLessonIds: string[]
): Promise<void> => {
  const session = await requireRole(["admin"]);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pass 1: Set to temporary negative order to avoid unique constraint violations
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await client.query("update lessons set sort_order = $1 where id = $2", [
        -(i + 1),
        orderedLessonIds[i],
      ]);
    }

    // Pass 2: Set to final correct order AND update module_id
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await client.query(
        "update lessons set sort_order = $1, module_id = $3, updated_at = now() where id = $2",
        [i + 1, orderedLessonIds[i], moduleId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await audit({
    action: "lessons.reordered",
    actorUserId: session.user.id,
    targetId: moduleId,
    targetType: "module",
  });
  revalidateAdmin();
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

export const saveBannerAction = async (
  formData: FormData
): Promise<{ bannerId?: string } | undefined> => {
  const session = await requireRole(["admin", "support"]);
  let bannerId = readString(formData, "bannerId");
  const linkUrl = readString(formData, "linkUrl") || null;
  const buttonText = readString(formData, "buttonText") || null;
  const isActive = readCheckbox(formData, "isActive");
  const imageFile = formData.get("imageFile") as File | null;

  assertBannerLink({ buttonText, linkUrl });

  const pool = getPool();
  let previousBlurDataUrl: string | null = null;
  let previousImageKey: string | null = null;
  let nextBlurDataUrl: string | null = null;
  let nextImageKey: string | null = null;

  if (bannerId) {
    const previous = await pool.query<{
      blur_data_url: string | null;
      image_url: string;
    }>(
      "select image_url, blur_data_url from dashboard_banners where id = $1 limit 1",
      [bannerId]
    );
    previousImageKey = previous.rows[0]?.image_url ?? null;
    previousBlurDataUrl = previous.rows[0]?.blur_data_url ?? null;

    if (!previousImageKey) {
      throw new Error("Banner inválido.");
    }

    if (imageFile && imageFile.size > 0) {
      const uploadedBanner = await uploadDashboardBannerFile({
        file: imageFile,
      });
      nextImageKey = uploadedBanner.key;
      nextBlurDataUrl = uploadedBanner.blurDataUrl;
      await pool.query(
        "update dashboard_banners set image_url = $1, blur_data_url = $2, link_url = $3, button_text = $4, is_active = $5, updated_at = now() where id = $6",
        [nextImageKey, nextBlurDataUrl, linkUrl, buttonText, isActive, bannerId]
      );
    } else {
      nextImageKey = previousImageKey;
      nextBlurDataUrl = previousBlurDataUrl;
      await pool.query(
        "update dashboard_banners set link_url = $1, button_text = $2, is_active = $3, updated_at = now() where id = $4",
        [linkUrl, buttonText, isActive, bannerId]
      );
    }
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
        insert into dashboard_banners (image_url, blur_data_url, link_url, button_text, is_active, sort_order)
        values ($1, $2, $3, $4, $5, $6)
        returning id
      `,
      [
        nextImageKey,
        nextBlurDataUrl,
        linkUrl,
        buttonText,
        isActive,
        nextSortOrder,
      ]
    );
    bannerId = insertRes.rows[0].id;
  }

  await synchronizeBannerObjects({
    isActive,
    nextImageKey,
    previousImageKey,
  });

  await audit({
    action: "banner.saved",
    actorUserId: session.user.id,
    targetId: bannerId || undefined,
    targetType: "banner",
  });
  revalidateAdmin();
  return { bannerId };
};

export const deleteBannerAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin", "support"]);
  const bannerId = readString(formData, "bannerId");

  if (!bannerId) {
    throw new Error("Banner inválido.");
  }

  const pool = getPool();
  const previous = await pool.query<{ image_url: string }>(
    "select image_url from dashboard_banners where id = $1 limit 1",
    [bannerId]
  );
  const imageKey = previous.rows[0]?.image_url;

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
    targetId: bannerId,
    targetType: "banner",
  });
  revalidateAdmin();
};

export const reorderBannersAction = async (
  orderedBannerIds: string[]
): Promise<void> => {
  const session = await requireRole(["admin", "support"]);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await audit({
    action: "banners.reordered",
    actorUserId: session.user.id,
    targetType: "banner",
  });
  revalidateAdmin();
};
