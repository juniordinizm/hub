export type CourseDeliveryStatus = "active" | "archived" | "draft";
export type CourseCatalogVisibility = "hidden" | "listed";
export type CourseSalesStatus = "closed" | "open";
export type CourseAvailabilityPreset =
  | "available"
  | "coming_soon"
  | "draft"
  | "sales_paused";
export type ResolvedCourseAvailabilityPreset =
  | CourseAvailabilityPreset
  | "archived";

export interface CourseAvailabilityInput {
  catalogVisibility: CourseCatalogVisibility;
  deliveryStatus: CourseDeliveryStatus;
  salesStatus: CourseSalesStatus;
}

export interface ResolvedCourseAvailability {
  acceptsInterest: boolean;
  canAccess: boolean;
  canSell: boolean;
  isListed: boolean;
  preset: ResolvedCourseAvailabilityPreset;
}

export interface CourseAvailabilityOption {
  disabled: boolean;
  label: string;
  value: CourseAvailabilityPreset;
}

const COURSE_AVAILABILITY_OPTION_DEFINITIONS: readonly Omit<
  CourseAvailabilityOption,
  "disabled"
>[] = [
  { label: "Rascunho", value: "draft" },
  { label: "Em breve", value: "coming_soon" },
  { label: "Disponível", value: "available" },
  { label: "Vendas pausadas", value: "sales_paused" },
];

export const getCourseAvailabilityOptions = ({
  hasCommercialHistory,
}: {
  hasCommercialHistory: boolean;
}): CourseAvailabilityOption[] =>
  COURSE_AVAILABILITY_OPTION_DEFINITIONS.map((option) => ({
    ...option,
    disabled:
      hasCommercialHistory &&
      (option.value === "draft" || option.value === "coming_soon"),
  }));

const TRAILING_SLASH_PATTERN = /\/$/;

const invalidAvailability = (): never => {
  throw new Error("Combinação de disponibilidade do Curso inválida.");
};

export const resolveCourseAvailability = ({
  catalogVisibility,
  deliveryStatus,
  salesStatus,
}: CourseAvailabilityInput): ResolvedCourseAvailability => {
  if (deliveryStatus === "archived") {
    if (catalogVisibility !== "hidden" || salesStatus !== "closed") {
      return invalidAvailability();
    }
    return {
      acceptsInterest: false,
      canAccess: false,
      canSell: false,
      isListed: false,
      preset: "archived",
    };
  }

  if (deliveryStatus === "draft") {
    if (salesStatus !== "closed") {
      return invalidAvailability();
    }
    const isListed = catalogVisibility === "listed";
    return {
      acceptsInterest: isListed,
      canAccess: false,
      canSell: false,
      isListed,
      preset: isListed ? "coming_soon" : "draft",
    };
  }

  if (salesStatus === "open") {
    if (catalogVisibility !== "listed") {
      return invalidAvailability();
    }
    return {
      acceptsInterest: false,
      canAccess: true,
      canSell: true,
      isListed: true,
      preset: "available",
    };
  }

  return {
    acceptsInterest: true,
    canAccess: true,
    canSell: false,
    isListed: catalogVisibility === "listed",
    preset: "sales_paused",
  };
};

const getSelfPurchaseUrl = ({
  applicationUrl,
  courseSlug,
}: {
  applicationUrl: string;
  courseSlug: string;
}): URL =>
  new URL(`/comprar/${encodeURIComponent(courseSlug)}`, applicationUrl);

export const parseCourseLaunchLandingUrl = ({
  applicationUrl,
  courseSlug,
  landingUrl,
}: {
  applicationUrl: string;
  courseSlug: string;
  landingUrl: string;
}): string | null => {
  const normalized = landingUrl.trim();
  if (!normalized) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Landing externa inválida.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Landing externa inválida.");
  }

  const selfPurchaseUrl = getSelfPurchaseUrl({ applicationUrl, courseSlug });
  const normalizedPathname = parsed.pathname.replace(
    TRAILING_SLASH_PATTERN,
    ""
  );
  const selfPathname = selfPurchaseUrl.pathname.replace(
    TRAILING_SLASH_PATTERN,
    ""
  );
  if (
    parsed.origin === selfPurchaseUrl.origin &&
    normalizedPathname === selfPathname
  ) {
    throw new Error("Landing externa inválida.");
  }

  return parsed.toString();
};
