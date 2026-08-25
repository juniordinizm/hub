import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (fileName: string): string =>
  readFileSync(
    resolve(import.meta.dirname, `../../.github/workflows/${fileName}`),
    "utf8"
  );

const readAction = (actionPath: string): string =>
  readFileSync(
    resolve(import.meta.dirname, `../../.github/${actionPath}`),
    "utf8"
  );

const githubExpression = (expression: string): string =>
  ["$", "{{ ", expression, " }}"].join("");

const shellVariable = (name: string): string => ["$", "{", name, "}"].join("");

describe("Development migration workflow", () => {
  it("migrates only the protected Development target from an approved main SHA", () => {
    const workflow = readWorkflow("migrate-development.yml");

    expect(workflow).toContain("confirm_development:");
    expect(workflow).toContain("group: neon-development-migrations");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("name: neon-development");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain('release_sha="$(git rev-parse HEAD)"');
    expect(workflow).toContain(
      `${shellVariable("GITHUB_REF")}" != "refs/heads/main"`
    );
    expect(workflow).toContain(
      `DATABASE_URL_DIRECT: ${githubExpression("secrets.DATABASE_URL_DIRECT")}`
    );
    expect(workflow).toContain(
      `DEVELOPMENT_DATABASE_HOST: ${githubExpression(
        "vars.DEVELOPMENT_DATABASE_HOST"
      )}`
    );
    expect(workflow).toContain("bun run db:migrate:development");
    expect(workflow).toContain(
      "bun run db:migrations:inspect -- --environment=neon-development"
    );
    expect(workflow).toContain(
      "No successful CI run exists for the current main SHA."
    );
  });
});

describe("Production cleanup workflow", () => {
  it("plans or executes cleanup without deploying or migrating", () => {
    const workflow = readWorkflow("cleanup-production-test-data.yml");

    expect(workflow).toContain("mode:");
    expect(workflow).toContain("fingerprint:");
    expect(workflow).toContain("confirm_cleanup:");
    expect(workflow).toContain("DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN");
    expect(workflow).toContain("name: vercel-production");
    expect(workflow).toContain("group: production-test-data-cleanup");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain(
      `PRODUCTION_DATABASE_HOST: ${githubExpression(
        "vars.PRODUCTION_DATABASE_HOST"
      )}`
    );
    expect(workflow).toContain(
      `PRODUCTION_NEON_PROJECT_ID: ${githubExpression(
        "vars.PRODUCTION_NEON_PROJECT_ID"
      )}`
    );
    expect(workflow).toContain(
      `PRODUCTION_NEON_BRANCH_ID: ${githubExpression(
        "vars.PRODUCTION_NEON_BRANCH_ID"
      )}`
    );
    expect(workflow).toContain(
      `NEON_API_KEY: ${githubExpression("secrets.NEON_API_KEY")}`
    );
    expect(workflow).toContain("bun run db:cleanup:production");
    expect(workflow).toContain(
      "No successful CI run exists for the current main SHA."
    );
    expect(workflow).not.toContain("db:migrate:production");
    expect(workflow).not.toContain("vercel deploy");
    expect(workflow).not.toContain("expires_at");
  });

  it("creates and confirms a backup only for execute mode", () => {
    const workflow = readWorkflow("cleanup-production-test-data.yml");

    expect(workflow).toContain("if: inputs.mode == 'execute'");
    expect(workflow).toContain("https://console.neon.tech/api/v2/projects/");
    expect(workflow).toContain(".branch.parent_id == $parent");
    expect(workflow).toContain('.branch.current_state == "ready"');
    expect(workflow).toContain("backup_branch_id=");
  });
});

describe("CI workflow", () => {
  it("deletes ephemeral branches through the bounded local Neon API action", () => {
    const workflow = readWorkflow("ci.yml");
    const deleteAction = readAction("actions/delete-neon-branch/action.yml");

    expect(
      workflow.match(/uses: \.\/\.github\/actions\/delete-neon-branch/g)
    ).toHaveLength(2);
    expect(workflow).not.toContain("neondatabase/delete-branch-action");
    expect(deleteAction).toContain("for attempt in 1 2 3");
    expect(deleteAction).toContain("--request DELETE");
    expect(deleteAction).toContain(
      `Authorization: Bearer ${shellVariable("NEON_API_KEY")}`
    );
    expect(deleteAction).toContain('"200"|"204"|"404"');
    expect(deleteAction).toContain(
      `Neon branch deletion failed with HTTP ${shellVariable("status")}.`
    );
    expect(deleteAction).not.toContain("response_body");
  });

  it("prepares inherited data only inside the two ephemeral test branches", () => {
    const workflow = readWorkflow("ci.yml");
    const neonAction = readAction("actions/create-neon-branch/action.yml");

    expect(workflow).toContain("NEON_CI_PROJECT_ID");
    expect(workflow).toContain("NEON_CI_API_KEY");
    expect(workflow).not.toContain("secrets.NEON_API_KEY");
    expect(workflow).not.toContain("vars.NEON_PROJECT_ID");
    expect(workflow.match(/bun run db:prepare:ci-migration/g)).toHaveLength(2);
    expect(workflow.match(/CI_NEON_BRANCH_ID:/g)).toHaveLength(2);
    expect(
      workflow.match(
        /parent_branch: \$\{\{ vars\.NEON_CI_PARENT_BRANCH_ID \}\}/g
      )
    ).toHaveLength(2);
    expect(workflow).toContain("is required for isolated CI databases.");
    expect(neonAction).toContain("parent_branch:");
    expect(neonAction).toContain("required: true");
    expect(
      neonAction.match(/parent_branch: \$\{\{ inputs\.parent_branch \}\}/g)
    ).toHaveLength(3);
    expect(workflow).toContain(
      `CI_NEON_BRANCH_ID: ${githubExpression("steps.neon.outputs.branch_id")}`
    );

    for (const job of ["integration-db:", "e2e:"]) {
      const jobStart = workflow.indexOf(job);
      const prepare = workflow.indexOf(
        "bun run db:prepare:ci-migration",
        jobStart
      );
      const migrate = workflow.indexOf("name: Apply migrations", jobStart);
      expect(jobStart).toBeGreaterThanOrEqual(0);
      expect(prepare).toBeGreaterThan(jobStart);
      expect(migrate).toBeGreaterThan(prepare);
    }
  });

  it("keeps deployment out of CI and delegates Staging to its workflow", () => {
    const workflow = readWorkflow("ci.yml");
    const stagingWorkflow = readWorkflow("deploy-staging.yml");

    expect(workflow).not.toContain("vercel-preview:");
    expect(workflow).not.toContain("vercel deploy");
    expect(stagingWorkflow).toContain("workflow_run:");
    expect(stagingWorkflow).toContain("branches: [staging]");
    expect(stagingWorkflow).toContain(
      "github.event.workflow_run.event == 'push'"
    );
    expect(stagingWorkflow).toContain(
      `ref: ${githubExpression(
        "github.event.workflow_run.head_sha || 'staging'"
      )}`
    );
    expect(stagingWorkflow).toContain(
      `CI_HEAD_SHA: ${githubExpression("github.event.workflow_run.head_sha")}`
    );
    expect(stagingWorkflow).toContain(
      `[[ -n "${shellVariable("CI_HEAD_SHA")}" &&`
    );
    expect(stagingWorkflow).toContain("db:migrate:staging");
    expect(stagingWorkflow).toContain("--target=staging");
    const neonProjectExpression = ["$", "{STAGING_NEON_PROJECT_ID}"].join("");
    const branchOutputExpression = [
      'echo "branch_id=',
      "$",
      '{branch_id}" >> "',
      "$",
      '{GITHUB_OUTPUT}"',
    ].join("");
    expect(stagingWorkflow).toContain(
      `https://console.neon.tech/api/v2/projects/${neonProjectExpression}/branches`
    );
    expect(stagingWorkflow).toContain(
      "branch:{name:$branch_name,parent_id:$parent_branch,expires_at:$expires_at},endpoints:[]"
    );
    expect(stagingWorkflow).toContain(branchOutputExpression);
    expect(stagingWorkflow).toContain('--write-out "%{http_code}"');
    expect(stagingWorkflow).toContain(
      "Neon branch backup request failed with HTTP"
    );
    expect(stagingWorkflow).not.toContain("neondatabase/create-branch-action");
    expect(stagingWorkflow).not.toContain(
      `${githubExpression("steps.deploy.outputs.url")}/api/health/ready`
    );
    expect(stagingWorkflow).toContain(
      `DEPLOYMENT_URL: ${githubExpression("steps.deployment.outputs.url")}`
    );
    expect(stagingWorkflow).toContain(
      `smoke_origin "${shellVariable("DEPLOYMENT_URL")}"`
    );
    expect(stagingWorkflow).toContain(
      'stable_origin="https://preview.neurocapacitar.com.br"'
    );
    expect(stagingWorkflow).toContain(".aliases | index($alias) != null");
  });

  it("gives Knip a synthetic E2E database and declares the CI cleanup script", () => {
    const workflow = readWorkflow("ci.yml");
    const cleanupWorkflow = readWorkflow("cleanup-ci-neon-branches.yml");

    expect(workflow).toContain(
      "E2E_DATABASE_URL: postgresql://verification:verification@e2e-verification.invalid/hub"
    );
    expect(cleanupWorkflow).toContain(
      "bun run ops:cleanup:ci-neon -- --execute"
    );
  });

  it("uses direct E2E credentials for mutators and pooled credentials only for runtime", () => {
    const workflow = readWorkflow("ci.yml");
    const playwrightStepStart = workflow.indexOf(
      "name: Run Chromium desktop and critical mobile journeys"
    );
    const playwrightStepEnd = workflow.indexOf(
      "name: Report E2E duration and retries",
      playwrightStepStart
    );
    const playwrightStep = workflow.slice(
      playwrightStepStart,
      playwrightStepEnd
    );

    expect(playwrightStepStart).toBeGreaterThan(-1);
    expect(playwrightStepEnd).toBeGreaterThan(playwrightStepStart);
    expect(playwrightStep).toContain(
      `DATABASE_URL: ${githubExpression("steps.neon.outputs.db_url")}`
    );
    expect(playwrightStep).toContain(
      `E2E_DATABASE_URL: ${githubExpression("steps.neon.outputs.db_url")}`
    );
    expect(playwrightStep).toContain(
      `E2E_RUNTIME_DATABASE_URL: ${githubExpression(
        "steps.neon.outputs.db_url_pooled"
      )}`
    );
  });
});

describe("CI Neon branch cleanup workflow", () => {
  it("runs a bounded allowlisted cleanup with dry-run and confirmation modes", () => {
    const workflow = readWorkflow("cleanup-ci-neon-branches.yml");

    expect(workflow).toContain('cron: "17 * * * *"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("default: dry-run");
    expect(workflow).toContain("cleanup-ci-neon");
    expect(workflow).toContain("bun run ops:cleanup:ci-neon -- --execute");
    expect(workflow).toContain("bun run ops:cleanup:ci-neon -- --dry-run");
    expect(workflow).toContain('CI_NEON_BRANCH_STALE_AFTER_HOURS: "26"');
    expect(workflow).not.toContain("staging-release-");
  });
});

describe("Release backup cleanup workflow", () => {
  it("runs scheduled dry-runs for both environments and gates manual execution", () => {
    const workflow = readWorkflow("cleanup-neon-release-backups.yml");

    expect(workflow).toContain('cron: "37 3 * * *"');
    expect(workflow).toContain("scheduled-staging:");
    expect(workflow).toContain("scheduled-production:");
    expect(workflow).toContain("manual:");
    expect(workflow).toContain("default: dry-run");
    expect(workflow).toContain("cleanup-release-backups");
    expect(workflow).toContain(
      "bun run ops:cleanup:release-backups -- --environment=staging --dry-run"
    );
    expect(workflow).toContain(
      "bun run ops:cleanup:release-backups -- --environment=production --dry-run"
    );
    expect(workflow).toContain(
      `"--environment=${shellVariable("TARGET_ENVIRONMENT")}"`
    );
    expect(workflow).toContain(`"--${shellVariable("CLEANUP_MODE")}"`);
    expect(workflow).toContain("NEON_RELEASE_PARENT_BRANCH_ID");
    expect(workflow).toContain("NEON_RELEASE_PROJECT_ID");
    expect(workflow).toContain("RELEASE_BACKUP_CLEANUP_CONFIRMATION");
  });
});

describe("Release backup ancestry", () => {
  it("fails closed when a Staging backup does not descend from Staging", () => {
    const workflow = readWorkflow("deploy-staging.yml");

    expect(workflow).toContain("name: Verify Staging Neon backup ancestry");
    expect(workflow).toContain("BACKUP_BRANCH_ID:");
    expect(workflow).toContain(".branch.parent_id");
    expect(workflow).toContain(
      `[[ "${shellVariable("actual_parent")}" == "${shellVariable(
        "STAGING_NEON_BRANCH_ID"
      )}" ]]`
    );
  });

  it("creates and verifies a Production backup from Production", () => {
    const workflow = readWorkflow("deploy-vercel.yml");

    expect(workflow).toContain(
      `parent_branch: ${githubExpression("vars.PRODUCTION_NEON_BRANCH_ID")}`
    );
    expect(workflow).not.toContain("\n          parent:");
    expect(workflow).toContain("name: Verify Production Neon backup ancestry");
    expect(workflow).toContain("BACKUP_BRANCH_ID:");
    expect(workflow).toContain(".branch.parent_id");
    expect(workflow).toContain(
      `[[ "${shellVariable("actual_parent")}" == "${shellVariable(
        "PRODUCTION_NEON_BRANCH_ID"
      )}" ]]`
    );
  });

  it("creates and verifies a Staging reset backup from Staging", () => {
    const workflow = readWorkflow("reset-staging.yml");

    expect(workflow).toContain(
      `parent_branch: ${githubExpression("vars.STAGING_NEON_BRANCH_ID")}`
    );
    expect(workflow).not.toContain("\n          parent:");
    expect(workflow).toContain("name: Verify Staging backup ancestry");
    expect(workflow).toContain("BACKUP_BRANCH_ID:");
    expect(workflow).toContain(".branch.parent_id");
    expect(workflow).toContain(
      `[[ "${shellVariable("actual_parent")}" == "${shellVariable(
        "STAGING_NEON_BRANCH_ID"
      )}" ]]`
    );
  });
});
