import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface CronEntry {
  path: string;
  schedule: string;
}

interface VercelConfiguration {
  crons: CronEntry[];
}

const repositoryRoot = resolve(import.meta.dirname, "../..");
const readText = (fileName: string): string =>
  readFileSync(resolve(repositoryRoot, fileName), "utf8");

const vercelConfiguration = JSON.parse(
  readText("vercel.json")
) as VercelConfiguration;
const architecture = readText("docs/architecture.md");
const releaseFlow = readText("docs/operations/release-flow.md");
const jmvstream = readText("docs/integrations/jmvstream.md");
const commerceAndAccess = readText("docs/domain/commerce-and-access.md");
const product = readText("PRODUCT.md");
const observability = readText("docs/operations/observability-and-recovery.md");
const readme = readText("README.md");
const releaseState = readText("docs/operations/release-state.md");
const externalChecklist = readText(
  "docs/operations/external-readiness-checklist.md"
);
const currentRequalification = readText(
  "docs/reviews/2026-09-03-readiness-remediation-requalification.md"
);
const readinessReview = readText(
  "docs/reviews/2026-09-01-production-readiness-requalification.md"
);
const backupRunbook = readText("docs/operations/production-backup-restore.md");
const resendIntegration = readText("docs/integrations/resend.md");

const scheduleDescription: Record<string, string> = {
  "*/15 * * * *": "a cada quinze minutos;",
  "0 10 * * *": "diariamente \u00e0s 10:00 UTC;",
  "0 4 * * *": "diariamente \u00e0s 04:00 UTC.",
};

const markdownCode = String.fromCharCode(96);
const documentedCronLine = (path: string, description: string): string =>
  ["- ", markdownCode, path, markdownCode, " ", description].join("");
const documentedJmvstreamCron = [
  "cron ",
  markdownCode,
  "/api/cron/jmvstream",
  markdownCode,
  " chama ",
  markdownCode,
  "syncPendingJmvstreamPlayers",
  markdownCode,
  " a cada quinze minutos",
].join("");
const releaseFlowFrequentCronPattern =
  /Asaas, JMVStream, outbox e\s+Resend a cada quinze minutos/;
const releaseFlowEnrollmentCronPattern =
  /matr\u00edculas diariamente \u00e0s 10:00 UTC/;
const releaseFlowMaintenanceCronPattern =
  /manuten\u00e7\u00e3o\s+diariamente \u00e0s 04:00 UTC/;
const currentMainShaPattern =
  /O commit atual de \x60main\x60 \u00e9 \x60([0-9a-f]{40})\x60/u;
const releaseMetadataCommitPattern =
  /^(?:last_verified_commit|documented_commit): [0-9a-f]{40}$/gmu;
const workflowEvidencePattern =
  /(?:CI|Sentry|Backup Production database|verify-resend-lifecycle)[\s\S]{0,160}\b\d{11}\b/iu;
const productCutoverPattern =
  /corte\s+controlado\s+de Production\s+(?:j\u00e1\s+)?foi executado/;
const externalConfirmationPattern =
  /R2 restore, lock\/lifecycle, restore Neon,\s+cabe\u00e7alhos Production e rota\u00e7\u00e3o de\s+secrets Resend\s+est\u00e3o confirmados/u;
const dmarcObservationPattern =
  /em observa\u00e7\u00e3o\s+at\u00e9 2026-09-12/u;
const currentReleaseSection =
  releaseState.split("## Hist\u00f3rico operacional")[0] ?? "";
const currentObservabilitySection =
  observability.split("## Hist\u00f3rico de evid\u00eancias")[0] ?? "";

describe("Operational documentation contracts", () => {
  it("documents every Vercel cron with its runtime cadence", () => {
    expect(vercelConfiguration.crons).toHaveLength(6);

    for (const cron of vercelConfiguration.crons) {
      const description = scheduleDescription[cron.schedule];
      expect(description).toBeDefined();
      expect(architecture).toContain(
        documentedCronLine(cron.path, description ?? "")
      );
    }

    expect(releaseFlow).toMatch(releaseFlowFrequentCronPattern);
    expect(releaseFlow).toMatch(releaseFlowEnrollmentCronPattern);
    expect(releaseFlow).toMatch(releaseFlowMaintenanceCronPattern);
    expect(jmvstream).toContain(documentedJmvstreamCron);
  });

  it("documents the implemented support enrollment capability", () => {
    expect(commerceAndAccess).toContain("manageEnrollmentSupport");
    expect(commerceAndAccess).toContain("DEC-DISC-014");
    expect(commerceAndAccess).toContain("permanece exclusiva de Admin");
    expect(commerceAndAccess).not.toContain(
      "separa\u00e7\u00e3o ainda n\u00e3o est\u00e1 implementada"
    );
  });

  it("records current remote evidence without retaining a pending CI claim", () => {
    const currentMainSha = releaseState.match(currentMainShaPattern)?.[1];

    expect(readme).not.toContain(
      "A execu\u00e7\u00e3o da CI para este commit permanece pendente"
    );
    expect(currentMainSha).toBeDefined();
    if (!currentMainSha) {
      throw new Error("release-state is missing its current main SHA");
    }
    for (const field of ["deployed_commit", "verified_commit"]) {
      expect(releaseState).toContain([field, ": ", currentMainSha].join(""));
    }
    expect(releaseState.match(releaseMetadataCommitPattern)).toHaveLength(2);
    expect(currentReleaseSection).toContain("Checkpoint operacional atual");
    expect(currentReleaseSection).toMatch(workflowEvidencePattern);
    expect(readinessReview).toContain(currentMainSha);
    expect(readinessReview).toMatch(workflowEvidencePattern);
    expect(backupRunbook).toContain(currentMainSha);
    expect(backupRunbook).toMatch(workflowEvidencePattern);
    expect(resendIntegration).toContain(currentMainSha);
    expect(resendIntegration).toMatch(workflowEvidencePattern);
  });

  it("does not present historical operational gaps as current", () => {
    expect(product).not.toContain(
      "corte controlado de Production permanece pendente"
    );
    expect(product).toMatch(productCutoverPattern);
    expect(observability).toContain("Evid\u00eancia operacional atual");
    expect(currentObservabilitySection).toMatch(workflowEvidencePattern);
    expect(observability).not.toContain("### Evid\u00eancia atual");
    expect(backupRunbook).not.toContain("## Estado atual \u2014 2026-08-27");
  });

  it("records the operator-confirmed external closure except for DMARC", () => {
    expect(releaseState).toMatch(externalConfirmationPattern);
    expect(releaseState).not.toContain(
      "a propriedade/escopo da credencial R2 de restore"
    );
    expect(externalChecklist).toContain(
      "itens externos 1 a 8 est\u00e3o confirmados"
    );
    expect(currentRequalification).toContain(
      "GO para receber novas features e para novas promo\u00e7\u00f5es Production"
    );
    expect(currentRequalification).toMatch(dmarcObservationPattern);
    expect(observability).not.toContain(
      "escopo efetivo da credencial R2 de restore e os cabe\u00e7alhos"
    );
  });
});
