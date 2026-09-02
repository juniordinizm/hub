const APPLICATION_ENVIRONMENT_PREFIXES = [
  "APPLICATION_",
  "ASAAS_",
  "AUTH_",
  "BACKUP_",
  "BETTER_AUTH_",
  "CERTIFICATE_",
  "CLIENT_",
  "CRON_",
  "DATABASE_",
  "DEVELOPMENT_",
  "E2E_",
  "EXPIRY_",
  "GITHUB_",
  "HEALTHCHECK_",
  "INTERNAL_",
  "JMVSTREAM_",
  "LOCAL_",
  "NEXT_",
  "PAYMENTS_",
  "PGSSLROOTCERT",
  "PRIVILEGED_",
  "PRODUCTION_",
  "PROTECTED_",
  "R2_",
  "RECOVERY_",
  "RESEND_",
  "RESTORE_",
  "SCHEDULED_",
  "SENTRY_",
  "SHARED_DEVELOPMENT_",
  "SMOKE_",
  "STAGING_",
  "SUPPORT_",
  "VERCEL_",
] as const;

const isApplicationEnvironmentKey = (name: string): boolean =>
  APPLICATION_ENVIRONMENT_PREFIXES.some((prefix) => name.startsWith(prefix));

export const createHermeticTestEnvironment = (
  environment: NodeJS.ProcessEnv
): NodeJS.ProcessEnv => {
  const result: NodeJS.ProcessEnv = { ...environment };

  for (const name of Object.keys(result)) {
    if (isApplicationEnvironmentKey(name)) {
      delete result[name];
    }
  }

  return result;
};
