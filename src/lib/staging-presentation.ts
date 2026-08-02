import type { Metadata } from "next";

type Environment = Readonly<Record<string, string | undefined>>;

export const getStagingPresentation = (
  environment: Environment
): {
  headers: Array<{ key: string; value: string }>;
  isStaging: boolean;
  robots?: Metadata["robots"];
} => {
  const isStaging = environment.VERCEL_TARGET_ENV?.trim() === "staging";
  return {
    headers: isStaging
      ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
      : [],
    isStaging,
    ...(isStaging ? { robots: { follow: false, index: false } } : {}),
  };
};
