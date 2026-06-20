export type JmvstreamUploadProxyMode = "development" | "disabled" | "enabled";

export const isJmvstreamUploadProxyEnabled = ({
  isVercel,
  mode,
  nodeEnv,
}: {
  isVercel: boolean;
  mode: JmvstreamUploadProxyMode;
  nodeEnv: "development" | "production" | "test";
}): boolean => {
  if (isVercel || mode === "disabled") {
    return false;
  }

  if (mode === "enabled") {
    return true;
  }

  return nodeEnv !== "production";
};
