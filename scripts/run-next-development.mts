type MutableEnvironment = Record<string, string | undefined>;

export const prepareNextDevelopmentEnvironment = (
  environment: MutableEnvironment
): void => {
  Reflect.deleteProperty(environment, "ASAAS_API_KEY");
};

if (import.meta.main) {
  prepareNextDevelopmentEnvironment(process.env);
  await import("next/dist/bin/next");
}
