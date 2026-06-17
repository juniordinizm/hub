"use server";

import { redirect } from "next/navigation";
import { createCourseCheckout } from "@/features/payments/server";
import { requireSession } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const startCourseCheckoutAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();
  const courseId = readString(formData, "courseId");

  if (!courseId) {
    throw new Error("Curso invalido.");
  }

  const { redirectUrl } = await createCourseCheckout({
    courseId,
    user: session.user,
  });

  redirect(redirectUrl as Parameters<typeof redirect>[0]);
};
