import {
  isScheduledJobName,
  type ScheduledJobName,
  scheduledJobs,
} from "./scheduled-jobs";

type FetchImplementation = (
  input: string,
  init: RequestInit
) => Promise<Response>;

interface ScheduledJobInvocation {
  environment: Readonly<Record<string, string | undefined>>;
  fetchImpl?: FetchImplementation;
  jobName: string;
}

export interface ScheduledJobResult {
  durationMs: number;
  jobName: ScheduledJobName;
  status: number;
}

const getRequiredValue = (
  environment: Readonly<Record<string, string | undefined>>,
  key: "CRON_SECRET" | "NEXT_PUBLIC_APP_URL"
): string => {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required to invoke scheduled jobs.`);
  }
  return value;
};

export const invokeScheduledJob = async ({
  environment,
  fetchImpl = fetch,
  jobName,
}: ScheduledJobInvocation): Promise<ScheduledJobResult> => {
  if (!isScheduledJobName(jobName)) {
    throw new Error(`Unknown scheduled job: ${jobName}`);
  }

  const appUrl = getRequiredValue(environment, "NEXT_PUBLIC_APP_URL");
  const secret = getRequiredValue(environment, "CRON_SECRET");
  const job = scheduledJobs[jobName];
  const target = new URL(job.path, appUrl).toString();
  const startedAt = Date.now();

  const response = await fetchImpl(target, {
    headers: { authorization: `Bearer ${secret}` },
    redirect: "error",
    signal: AbortSignal.timeout(job.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `Scheduled job ${jobName} failed with HTTP ${response.status}.`
    );
  }

  return {
    durationMs: Date.now() - startedAt,
    jobName,
    status: response.status,
  };
};
