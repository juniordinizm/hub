const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHECKOUT_ATTEMPT_KEY = "checkoutAttemptId";
const COURSE_ID_KEY = "courseId";
const COURSE_SLUG_KEY = "courseSlug";
const ALLOWED_KEYS = new Set([
  CHECKOUT_ATTEMPT_KEY,
  COURSE_ID_KEY,
  COURSE_SLUG_KEY,
]);

export interface PublicCheckoutBody {
  checkoutAttemptId: string;
  courseId?: string;
  courseSlug?: string;
}

export type CheckoutApiResponse =
  | {
      orderId: string;
      redirectUrl: string;
      retryAllowed: false;
      status: "ready";
    }
  | { orderId: string; retryAllowed: false; status: "processing" }
  | { orderId: string; retryAllowed: true; status: "failed" }
  | {
      error: string;
      retryAllowed: false;
      status: "unavailable";
    };

const readOwnValue = (value: Record<string, unknown>, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
};

export const parseCheckoutRequest = (
  value: unknown
): PublicCheckoutBody | null => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    keys.some((key) => typeof key !== "string" || !ALLOWED_KEYS.has(key))
  ) {
    return null;
  }

  const hasCourseId = Object.hasOwn(value, COURSE_ID_KEY);
  const hasCourseSlug = Object.hasOwn(value, COURSE_SLUG_KEY);
  if (hasCourseId === hasCourseSlug) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const checkoutAttemptId = readOwnValue(body, CHECKOUT_ATTEMPT_KEY);
  if (typeof checkoutAttemptId !== "string") {
    return null;
  }

  const normalizedAttemptId = checkoutAttemptId.trim();
  if (!UUID_PATTERN.test(normalizedAttemptId)) {
    return null;
  }

  if (hasCourseId) {
    const courseId = readOwnValue(body, COURSE_ID_KEY);
    if (typeof courseId !== "string") {
      return null;
    }
    const normalizedCourseId = courseId.trim();
    return UUID_PATTERN.test(normalizedCourseId)
      ? {
          checkoutAttemptId: normalizedAttemptId,
          courseId: normalizedCourseId,
        }
      : null;
  }

  const courseSlug = readOwnValue(body, COURSE_SLUG_KEY);
  if (typeof courseSlug !== "string") {
    return null;
  }
  const normalizedCourseSlug = courseSlug.trim().toLowerCase();
  return COURSE_SLUG_PATTERN.test(normalizedCourseSlug)
    ? {
        checkoutAttemptId: normalizedAttemptId,
        courseSlug: normalizedCourseSlug,
      }
    : null;
};
