"use server";

import { revalidatePath } from "next/cache";
import type { CourseAvailabilityPreset } from "@/features/courses/availability";
import {
  archiveCourse,
  restoreCourse,
  setCourseAvailability,
} from "@/features/courses/availability-server";
import { requireRole } from "@/lib/session";

const PRESETS = new Set<CourseAvailabilityPreset>([
  "available",
  "coming_soon",
  "draft",
  "sales_paused",
]);

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const revalidateCourseAvailability = (courseId: string): void => {
  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath("/app");
  revalidatePath("/comprar/[slug]", "page");
};

export type CourseAvailabilityActionResult =
  | {
      checkoutCancellationsEnqueued: number;
      notificationsEnqueued: number;
      ok: true;
    }
  | { message: string; ok: false };

export const saveCourseAvailabilityAction = async (
  formData: FormData
): Promise<CourseAvailabilityActionResult> => {
  try {
    const session = await requireRole(["admin"]);
    const courseId = readString(formData, "courseId");
    const preset = readString(formData, "preset") as CourseAvailabilityPreset;
    if (!(courseId && PRESETS.has(preset))) {
      throw new Error("Disponibilidade do Curso inválida.");
    }
    const result = await setCourseAvailability({
      actorUserId: session.user.id,
      courseId,
      launchDate: readString(formData, "launchDate") || null,
      launchLandingUrl: readString(formData, "launchLandingUrl") || null,
      preset,
      showInCatalog: formData.get("showInCatalog") === "on",
    });
    revalidateCourseAvailability(courseId);
    return {
      checkoutCancellationsEnqueued: result.checkoutCancellationsEnqueued,
      notificationsEnqueued: result.notificationsEnqueued,
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a disponibilidade.",
      ok: false,
    };
  }
};

export const archiveCourseAction = async (courseId: string): Promise<void> => {
  const session = await requireRole(["admin"]);
  await archiveCourse({ actorUserId: session.user.id, courseId });
  revalidateCourseAvailability(courseId);
};

export const restoreCourseAction = async (courseId: string): Promise<void> => {
  const session = await requireRole(["admin"]);
  await restoreCourse({ actorUserId: session.user.id, courseId });
  revalidateCourseAvailability(courseId);
};
