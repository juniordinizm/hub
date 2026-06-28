import { NextResponse } from "next/server";
import {
  createPublicCourseCheckout,
  PublicCheckoutRateLimitError,
} from "@/features/payments/public-checkout";

const readIpAddress = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
};

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = (await request.json().catch(() => null)) as {
    courseId?: unknown;
    courseSlug?: unknown;
  } | null;
  const courseId = readOptionalString(body?.courseId);
  const courseSlug = readOptionalString(body?.courseSlug);

  try {
    const checkout = await createPublicCourseCheckout({
      ...(courseId ? { courseId } : {}),
      ...(courseSlug ? { courseSlug } : {}),
      ipAddress: readIpAddress(request),
    });

    return NextResponse.json(checkout);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel iniciar o checkout.",
      },
      { status: error instanceof PublicCheckoutRateLimitError ? 429 : 400 }
    );
  }
};
