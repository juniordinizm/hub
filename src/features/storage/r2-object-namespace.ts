const SAFE_PREFIX = /^[a-z0-9][a-z0-9_-]*$/;

export const parseR2ObjectPrefix = (
  value: string | undefined
): string | undefined => {
  const prefix = value?.trim();
  if (!prefix) {
    return;
  }
  if (!SAFE_PREFIX.test(prefix)) {
    throw new Error("R2_OBJECT_PREFIX is invalid.");
  }
  return prefix;
};

export const createR2ObjectNamespace = (value: string | undefined) => {
  const prefix = parseR2ObjectPrefix(value);
  const physicalPrefix = prefix ? `${prefix}/` : "";
  return {
    toLogicalKey(key: string): string {
      if (!physicalPrefix) {
        return key;
      }
      if (!key.startsWith(physicalPrefix)) {
        throw new Error("R2 object escaped its namespace.");
      }
      return key.slice(physicalPrefix.length);
    },
    toPhysicalKey(key: string): string {
      return `${physicalPrefix}${key}`;
    },
    toPhysicalPrefix(keyPrefix: string): string {
      return `${physicalPrefix}${keyPrefix}`;
    },
  };
};
